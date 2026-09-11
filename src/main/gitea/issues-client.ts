import type { ClassifiedError } from '../../shared/classified-error'
import type { GiteaIssueInfo, GiteaSite } from '../../shared/gitea-types'
import { normalizeGiteaApiBaseUrl } from './client'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import { isGiteaIssue, mapGiteaIssue, type RawGiteaIssue } from './issue-mappers'
import type { GiteaRepoRef } from './repository-ref'

const REQUEST_TIMEOUT_MS = 5000
const ISSUE_PAGE_LIMIT = 50

export class GiteaApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.status = status
  }
}

// Why: multi-host Tasks calls resolve the per-site credential in Task 3's
// resolveGiteaAuth and thread it here — this client never reads env itself.
// The token is the already-resolved credential, never persisted.
export type GiteaCallAuth = {
  site: GiteaSite
  token: string | null
}

export type GiteaIssueListResult = {
  items: GiteaIssueInfo[]
  /** 0 when the listing failed — the caller keeps its current pager instead of collapsing it. */
  totalPages: number
  error?: ClassifiedError
}

export type GiteaIssueListOptions = {
  state?: 'open' | 'closed' | 'all'
  labels?: string[]
  milestone?: string | number
  page?: number
  limit?: number
}

export type GiteaIssueCreateInput = {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
  milestone?: string | number
}

export type GiteaIssueUpdatePatch = {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  labels?: string[]
  assignees?: string[]
  milestone?: string | number
}

export type GiteaIssueComment = {
  id: number
  body: string
  author: string
  createdAt: string
  url: string
}

type RawGiteaIssueComment = {
  id?: number
  body?: string | null
  html_url?: string | null
  created_at?: string | null
  user?: { login?: string | null; username?: string | null; full_name?: string | null } | null
}

type RequestOptions = {
  searchParams?: Record<string, string | number>
  timeoutMs?: number
  method?: string
  body?: unknown
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `token ${token}` } : {}
}

function apiBaseUrl(site: GiteaSite, repo: GiteaRepoRef): string {
  const base = site.baseUrl?.trim() ? site.baseUrl : repo.apiBaseUrl
  return normalizeGiteaApiBaseUrl(base)
}

function apiUrl(baseUrl: string, path: string, searchParams?: RequestOptions['searchParams']): URL {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

function encodedRepoPath(repo: GiteaRepoRef): string {
  return `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`
}

function redactToken(message: string, token: string | null): string {
  return token ? message.split(token).join('[REDACTED]') : message
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `Gitea request failed (HTTP ${response.status})`
}

async function requestJson<T>(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetch(apiUrl(apiBaseUrl(auth.site, repo), path, options.searchParams), {
    ...(options.method ? { method: options.method } : {}),
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(auth.token)
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    const message = await readErrorMessage(response)
    await cancelUnreadResponseBody(response)
    throw new GiteaApiError(redactToken(message, auth.token), response.status)
  }
  if (response.status === 204) {
    return null as T
  }
  return (await response.json()) as T
}

function classifyListError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error)
  const status = error instanceof GiteaApiError ? error.status : null
  if (status === 401 || status === 403) {
    return { type: 'permission_denied', message }
  }
  if (status === 404) {
    return { type: 'not_found', message }
  }
  return { type: 'unknown', message }
}

function mapGiteaIssueComment(raw: RawGiteaIssueComment): GiteaIssueComment {
  return {
    id: raw.id ?? 0,
    body: raw.body ?? '',
    author: raw.user?.login ?? raw.user?.username ?? raw.user?.full_name ?? '',
    createdAt: raw.created_at ?? '',
    url: raw.html_url ?? ''
  }
}

export async function listGiteaIssues(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  opts: GiteaIssueListOptions = {}
): Promise<GiteaIssueListResult> {
  const page = Number.isFinite(opts.page) ? Math.max(1, Math.trunc(opts.page as number)) : 1
  const limit = Number.isFinite(opts.limit)
    ? Math.max(1, Math.trunc(opts.limit as number))
    : ISSUE_PAGE_LIMIT
  const searchParams: Record<string, string | number> = {
    state: opts.state ?? 'open',
    page,
    limit
  }
  if (opts.labels && opts.labels.length > 0) {
    searchParams.labels = opts.labels.join(',')
  }
  if (opts.milestone !== undefined) {
    searchParams.milestone = opts.milestone
  }
  try {
    const raw = await requestJson<RawGiteaIssue[]>(
      auth,
      repo,
      `/repos/${encodedRepoPath(repo)}/issues`,
      { searchParams }
    )
    const items = (Array.isArray(raw) ? raw : []).filter(isGiteaIssue).map(mapGiteaIssue)
    return { items, totalPages: items.length < limit ? page : page + 1 }
  } catch (error) {
    return { items: [], totalPages: 0, error: classifyListError(error) }
  }
}

export async function getGiteaIssue(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  index: number
): Promise<GiteaIssueInfo | null> {
  try {
    const raw = await requestJson<RawGiteaIssue>(
      auth,
      repo,
      `/repos/${encodedRepoPath(repo)}/issues/${encodeURIComponent(String(index))}`
    )
    if (!raw || !isGiteaIssue(raw)) {
      return null
    }
    return mapGiteaIssue(raw)
  } catch {
    return null
  }
}

export async function createGiteaIssue(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  input: GiteaIssueCreateInput
): Promise<GiteaIssueInfo> {
  const raw = await requestJson<RawGiteaIssue>(
    auth,
    repo,
    `/repos/${encodedRepoPath(repo)}/issues`,
    {
      method: 'POST',
      body: {
        title: input.title,
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.labels !== undefined ? { labels: input.labels } : {}),
        ...(input.assignees !== undefined ? { assignees: input.assignees } : {}),
        ...(input.milestone !== undefined ? { milestone: input.milestone } : {})
      }
    }
  )
  return mapGiteaIssue(raw)
}

export async function updateGiteaIssue(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  index: number,
  patch: GiteaIssueUpdatePatch
): Promise<GiteaIssueInfo> {
  const raw = await requestJson<RawGiteaIssue>(
    auth,
    repo,
    `/repos/${encodedRepoPath(repo)}/issues/${encodeURIComponent(String(index))}`,
    { method: 'PATCH', body: patch }
  )
  return mapGiteaIssue(raw)
}

export async function addGiteaIssueComment(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  index: number,
  body: string
): Promise<GiteaIssueComment> {
  const raw = await requestJson<RawGiteaIssueComment>(
    auth,
    repo,
    `/repos/${encodedRepoPath(repo)}/issues/${encodeURIComponent(String(index))}/comments`,
    { method: 'POST', body: { body } }
  )
  return mapGiteaIssueComment(raw)
}

export async function listGiteaIssueComments(
  auth: GiteaCallAuth,
  repo: GiteaRepoRef,
  index: number
): Promise<GiteaIssueComment[]> {
  const raw = await requestJson<RawGiteaIssueComment[]>(
    auth,
    repo,
    `/repos/${encodedRepoPath(repo)}/issues/${encodeURIComponent(String(index))}/comments`
  )
  return (Array.isArray(raw) ? raw : []).map(mapGiteaIssueComment)
}
