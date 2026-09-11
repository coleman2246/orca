import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import type { GiteaConnectionStatus, GiteaSite } from '../../shared/gitea-types'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken
} from '../integration-credential-file'
import { normalizeGiteaApiBaseUrl } from './client'
import type { GiteaRepoRef } from './repository-ref'

export type GiteaSiteFile = {
  version: 1
  activeSiteId: string | null
  sites: GiteaSite[]
}

export type GiteaAuthSource = 'site' | 'env' | 'anonymous'

export type ResolvedGiteaAuth = {
  baseUrl: string
  token: string | null
  source: GiteaAuthSource
}

let cachedSiteFile: GiteaSiteFile | null = null
let siteFileLoaded = false
const cachedTokens = new Map<string, string>()
// Why: decrypt failures are recorded per site so getStatus can explain
// failing reads without re-touching the keychain on every status poll.
export const credentialErrors = new Map<string, string>()

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function getSiteFilePath(): string {
  return join(getOrcaDir(), 'gitea-sites.json')
}

function getTokenDir(): string {
  return join(getOrcaDir(), 'gitea-tokens')
}

function getTokenPath(siteId: string): string {
  return join(getTokenDir(), `${Buffer.from(siteId).toString('base64url')}.enc`)
}

function ensureStoreDirs(): void {
  for (const dir of [getOrcaDir(), getTokenDir()]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

function emptySiteFile(): GiteaSiteFile {
  return { version: 1, activeSiteId: null, sites: [] }
}

export function hasStoredToken(siteId: string): boolean {
  return cachedTokens.has(siteId) || credentialFileHasContent(getTokenPath(siteId))
}

function getSiteId(baseUrl: string, account: string | null): string {
  const input = `${baseUrl}\n${(account ?? '').toLowerCase()}`
  return createHash('sha256').update(input).digest('base64url').slice(0, 24)
}

function normalizeSite(input: unknown): GiteaSite | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const record = input as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.baseUrl !== 'string') {
    return null
  }
  return {
    id: record.id,
    baseUrl: normalizeGiteaApiBaseUrl(record.baseUrl),
    ...(typeof record.account === 'string' ? { account: record.account } : {})
  }
}

function readSiteFileFromDisk(): GiteaSiteFile {
  const path = getSiteFilePath()
  if (!existsSync(path)) {
    return emptySiteFile()
  }
  try {
    const parsed = JSON.parse(readFileSync(path, { encoding: 'utf-8' })) as Partial<GiteaSiteFile>
    const sites = Array.isArray(parsed.sites)
      ? parsed.sites
          .map((site) => normalizeSite(site))
          .filter((site): site is GiteaSite => site !== null)
          .filter((site) => hasStoredToken(site.id))
      : []
    const active = typeof parsed.activeSiteId === 'string' ? parsed.activeSiteId : null
    const activeSiteId =
      active && sites.some((site) => site.id === active) ? active : (sites[0]?.id ?? null)
    return { version: 1, activeSiteId, sites }
  } catch {
    return emptySiteFile()
  }
}

export function getSiteFile(): GiteaSiteFile {
  if (!siteFileLoaded || !cachedSiteFile) {
    cachedSiteFile = readSiteFileFromDisk()
    siteFileLoaded = true
  }
  return cachedSiteFile
}

export function writeSiteFile(file: GiteaSiteFile): void {
  ensureStoreDirs()
  const sites = file.sites.filter((site) => hasStoredToken(site.id))
  const active = file.activeSiteId
  const activeSiteId =
    active && sites.some((site) => site.id === active) ? active : (sites[0]?.id ?? null)

  cachedSiteFile = { version: 1, activeSiteId, sites }
  siteFileLoaded = true
  writeFileSync(getSiteFilePath(), JSON.stringify(cachedSiteFile, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  })
}

function writeEncryptedToken(path: string, token: string): void {
  if (getSecretStore().isEncryptionAvailable()) {
    writeFileSync(path, getSecretStore().encryptString(token), { mode: 0o600 })
    return
  }
  console.warn('[gitea] secret encryption unavailable — storing token in plaintext')
  writeFileSync(path, token, { encoding: 'utf-8', mode: 0o600 })
}

export function readToken(siteId: string): string | null {
  const cached = cachedTokens.get(siteId)
  if (cached !== undefined) {
    return cached
  }
  const path = getTokenPath(siteId)
  if (!existsSync(path)) {
    return null
  }
  try {
    const raw = readFileSync(path)
    const token = readStoredCredentialToken('Gitea', raw)
    if (token) {
      cachedTokens.set(siteId, token)
    }
    credentialErrors.delete(siteId)
    return token
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      credentialErrors.set(siteId, error.message)
      throw error
    }
    return null
  }
}

export function saveToken(siteId: string, token: string): void {
  ensureStoreDirs()
  writeEncryptedToken(getTokenPath(siteId), token)
  cachedTokens.set(siteId, token)
  credentialErrors.delete(siteId)
}

export function deleteToken(siteId: string): void {
  cachedTokens.delete(siteId)
  credentialErrors.delete(siteId)
  try {
    unlinkSync(getTokenPath(siteId))
  } catch {
    // Token may not exist — safe to ignore.
  }
}

function redactToken(message: string, token: string | null): string {
  return token ? message.split(token).join('[REDACTED]') : message
}

function stripApiSuffix(value: string): string {
  return value.replace(/\/api\/v1$/i, '')
}

/** Match a repo URL (web or API base) against stored sites by origin with longest-prefix win. */
export function matchGiteaSite<T extends { baseUrl: string }>(url: string, sites: T[]): T | null {
  let input: URL
  try {
    input = new URL(url)
  } catch {
    return null
  }
  const inputBase = stripApiSuffix(`${input.origin}${input.pathname}`.replace(/\/+$/, ''))
  let best: T | null = null
  let bestLength = -1
  for (const site of sites) {
    let siteUrl: URL
    try {
      siteUrl = new URL(site.baseUrl)
    } catch {
      continue
    }
    if (siteUrl.origin !== input.origin) {
      continue
    }
    const siteBase = stripApiSuffix(`${siteUrl.origin}${siteUrl.pathname}`.replace(/\/+$/, ''))
    if (inputBase === siteBase || inputBase.startsWith(`${siteBase}/`)) {
      if (siteBase.length > bestLength) {
        best = site
        bestLength = siteBase.length
      }
    }
  }
  return best
}

export function getGiteaSiteForRepo(repo: GiteaRepoRef): GiteaSite | null {
  const sites = getSiteFile().sites
  return matchGiteaSite(repo.apiBaseUrl, sites) ?? matchGiteaSite(repo.webBaseUrl, sites)
}

export function getGiteaConnectionStatus(): GiteaConnectionStatus {
  const file = getSiteFile()
  const sites = file.sites.filter((site) => hasStoredToken(site.id))
  const activeSite = sites.find((site) => site.id === file.activeSiteId) ?? sites[0] ?? null
  const credentialError = sites.map((s) => credentialErrors.get(s.id)).find((m) => m !== undefined)
  return {
    connected: sites.length > 0,
    sites,
    activeSiteId: activeSite?.id ?? null,
    ...(credentialError ? { credentialError } : {})
  }
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export async function readUserAccount(
  baseUrl: string,
  token: string
): Promise<{ ok: true; account: string | null } | { ok: false; error: string }> {
  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/user`, {
      headers: { Accept: 'application/json', Authorization: `token ${token}` },
      signal: AbortSignal.timeout(4000)
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Connection failed.' }
  }
  if (!response.ok) {
    let message = response.statusText || `Gitea request failed (HTTP ${response.status})`
    try {
      const data = (await response.json()) as { message?: unknown }
      if (typeof data.message === 'string' && data.message.trim()) {
        message = data.message
      }
    } catch {
      // Fall through to status text.
    }
    return { ok: false, error: redactToken(message, token) }
  }
  const user = (await response.json()) as {
    login?: string | null
    username?: string | null
    full_name?: string | null
  }
  return { ok: true, account: user?.login ?? user?.username ?? user?.full_name ?? null }
}

export async function saveGiteaSite(
  baseUrl: string,
  token: string
): Promise<{ ok: true; site: GiteaSite } | { ok: false; error: string }> {
  const normalizedBaseUrl = normalizeGiteaApiBaseUrl(baseUrl)
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    return { ok: false, error: 'Personal access token is required.' }
  }
  const validated = await readUserAccount(normalizedBaseUrl, trimmedToken)
  if (!validated.ok) {
    return { ok: false, error: validated.error }
  }
  // Key on the verified account (not the host alone) so distinct PATs on one
  // host stay distinct instead of silently overwriting each other.
  const id = getSiteId(normalizedBaseUrl, validated.account)
  const site: GiteaSite = {
    id,
    baseUrl: normalizedBaseUrl,
    ...(validated.account ? { account: validated.account } : {})
  }
  saveToken(id, trimmedToken)
  const file = getSiteFile()
  writeSiteFile({
    version: 1,
    activeSiteId: id,
    sites: [site, ...file.sites.filter((entry) => entry.id !== id)]
  })
  return { ok: true, site }
}

export function removeGiteaSite(id: string): void {
  deleteToken(id)
  const file = getSiteFile()
  writeSiteFile({ ...file, sites: file.sites.filter((site) => site.id !== id) })
}

/**
 * Tasks auth resolution order: matched Settings site by repo host → env
 * fallback (legacy single host) → anonymous for public repos.
 */
export function resolveGiteaAuth(repo: GiteaRepoRef): ResolvedGiteaAuth {
  const site = getGiteaSiteForRepo(repo)
  if (site) {
    const token = readToken(site.id)
    if (token) {
      return { baseUrl: normalizeGiteaApiBaseUrl(site.baseUrl), token, source: 'site' }
    }
  }
  const envToken = envValue('ORCA_GITEA_TOKEN')
  if (envToken) {
    const envBaseUrl = envValue('ORCA_GITEA_API_BASE_URL')
    const baseUrl = envBaseUrl ? normalizeGiteaApiBaseUrl(envBaseUrl) : repo.apiBaseUrl
    return { baseUrl, token: envToken, source: 'env' }
  }
  return { baseUrl: repo.apiBaseUrl, token: null, source: 'anonymous' }
}
