import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchGiteaSite } from './site-credential-store'
import type { GiteaRepoRef } from './repository-ref'

describe('matchGiteaSite', () => {
  it('matches by origin with longest-prefix win', () => {
    const sites = [
      { id: 'a', baseUrl: 'https://git.example.com/api/v1' },
      { id: 'b', baseUrl: 'https://git.example.com/sub/api/v1' }
    ]
    expect(matchGiteaSite('https://git.example.com/sub/o/r', sites)?.id).toBe('b')
  })

  it('returns null when no site shares the URL origin', () => {
    const sites = [{ id: 'a', baseUrl: 'https://git.example.com/api/v1' }]
    expect(matchGiteaSite('https://other.example.com/o/r', sites)).toBeNull()
  })

  it('matches a repo apiBaseUrl against its own site', () => {
    const sites = [
      { id: 'a', baseUrl: 'https://git.example.com/api/v1' },
      { id: 'b', baseUrl: 'https://git.example.com/sub/api/v1' }
    ]
    expect(matchGiteaSite('https://git.example.com/api/v1', sites)?.id).toBe('a')
  })
})

const OLD_ENV = process.env
let tempHome = ''

function mkdtempLike(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

function repoRef(apiBaseUrl: string, webBaseUrl: string): GiteaRepoRef {
  return { host: 'git.example.com', owner: 'o', repo: 'r', apiBaseUrl, webBaseUrl }
}

/** Fresh store instance per test so site-file/token caches never leak. */
async function loadStoreModule(options: { encryptionAvailable?: boolean } = {}) {
  vi.resetModules()
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => options.encryptionAvailable ?? false,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString('utf-8'),
    describeProtectionGap: () => null
  })
  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof Os>('os')
    return { ...actual, homedir: () => tempHome }
  })
  return import('./site-credential-store')
}

function seedSiteFiles(siteId: string, baseUrl: string, token: string | Buffer): void {
  const orcaDir = join(tempHome, '.orca')
  mkdirSync(join(orcaDir, 'gitea-tokens'), { recursive: true })
  writeFileSync(
    join(orcaDir, 'gitea-sites.json'),
    JSON.stringify(
      { version: 1, activeSiteId: siteId, sites: [{ id: siteId, baseUrl, account: 'ada' }] },
      null,
      2
    ),
    { encoding: 'utf-8' }
  )
  writeFileSync(
    join(orcaDir, 'gitea-tokens', `${Buffer.from(siteId).toString('base64url')}.enc`),
    token
  )
}

describe('gitea site credential store', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.ORCA_GITEA_TOKEN
    delete process.env.ORCA_GITEA_API_BASE_URL
    tempHome = mkdtempLike('orca-gitea-site-store-')
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    process.env = OLD_ENV
    vi.unstubAllGlobals()
  })

  it('validates the token via GET /user on save and surfaces the account', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://git.example.com/api/v1/user')
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBe('token tok-123')
      return Response.json({ login: 'ada' })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = await loadStoreModule()

    const result = await store.saveGiteaSite('https://git.example.com', 'tok-123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.site.account).toBe('ada')
      expect(result.site.baseUrl).toBe('https://git.example.com/api/v1')
    }
    expect(store.getGiteaConnectionStatus()).toMatchObject({ connected: true })
  })

  it('surfaces the server message when token validation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'bad credentials' }, { status: 401 }))
    )
    const store = await loadStoreModule()

    const result = await store.saveGiteaSite('https://git.example.com', 'bogus')

    expect(result).toEqual({ ok: false, error: 'bad credentials' })
    expect(store.getGiteaConnectionStatus()).toMatchObject({ connected: false })
  })

  it('records a decrypt failure as credentialError on status', async () => {
    seedSiteFiles('site-alpha', 'https://git.example.com/api/v1', Buffer.from([0xff, 0xfe, 0x00]))
    const store = await loadStoreModule()
    const { credentialDecryptionMessage } =
      await import('../../shared/integration-credential-errors')

    await expect(async () =>
      store.resolveGiteaAuth(repoRef('https://git.example.com/api/v1', 'https://git.example.com'))
    ).rejects.toThrow(credentialDecryptionMessage('Gitea'))
    expect(store.getGiteaConnectionStatus().credentialError).toBe(
      credentialDecryptionMessage('Gitea')
    )
  })

  it('prefers the matched site over env, then env, then anonymous', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ login: 'ada' }))
    )
    const store = await loadStoreModule()
    const saved = await store.saveGiteaSite('https://git.example.com', 'site-token')
    expect(saved.ok).toBe(true)
    process.env.ORCA_GITEA_TOKEN = 'env-token'

    const siteRepo = repoRef('https://git.example.com/api/v1', 'https://git.example.com')
    expect(store.resolveGiteaAuth(siteRepo)).toEqual({
      baseUrl: 'https://git.example.com/api/v1',
      token: 'site-token',
      source: 'site'
    })

    const otherRepo = repoRef('https://other.example.com/api/v1', 'https://other.example.com')
    expect(store.resolveGiteaAuth(otherRepo)).toEqual({
      baseUrl: 'https://other.example.com/api/v1',
      token: 'env-token',
      source: 'env'
    })

    delete process.env.ORCA_GITEA_TOKEN
    expect(store.resolveGiteaAuth(otherRepo)).toEqual({
      baseUrl: 'https://other.example.com/api/v1',
      token: null,
      source: 'anonymous'
    })
  })

  it('uses the env API base URL override for env-source auth', async () => {
    const store = await loadStoreModule()
    process.env.ORCA_GITEA_TOKEN = 'env-token'
    process.env.ORCA_GITEA_API_BASE_URL = 'https://git.example.com/custom'

    expect(
      store.resolveGiteaAuth(
        repoRef('https://other.example.com/api/v1', 'https://other.example.com')
      )
    ).toEqual({
      baseUrl: 'https://git.example.com/custom/api/v1',
      token: 'env-token',
      source: 'env'
    })
  })

  it('matches the longest-prefix site for subpath deployments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ login: 'ada' }))
    )
    const store = await loadStoreModule()
    await store.saveGiteaSite('https://git.example.com', 'root-token')
    await store.saveGiteaSite('https://git.example.com/sub', 'sub-token')

    const subRepo = repoRef('https://git.example.com/sub/api/v1', 'https://git.example.com/sub/o/r')
    expect(store.getGiteaSiteForRepo(subRepo)?.baseUrl).toBe('https://git.example.com/sub/api/v1')
    expect(store.resolveGiteaAuth(subRepo)).toMatchObject({
      token: 'sub-token',
      source: 'site'
    })
  })

  it('removes the site and its token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ login: 'ada' }))
    )
    const store = await loadStoreModule()
    const saved = await store.saveGiteaSite('https://git.example.com', 'tok-123')
    expect(saved.ok).toBe(true)
    if (!saved.ok) {
      return
    }

    store.removeGiteaSite(saved.site.id)

    expect(store.getGiteaConnectionStatus()).toMatchObject({ connected: false, sites: [] })
    expect(
      store.resolveGiteaAuth(repoRef('https://git.example.com/api/v1', 'https://git.example.com'))
        .source
    ).toBe('anonymous')
  })

  it('tests a stored site with its saved token', async () => {
    const fetchMock = vi.fn(async () => Response.json({ login: 'ada' }))
    vi.stubGlobal('fetch', fetchMock)
    const store = await loadStoreModule()
    const { testGiteaSite } = await import('./site-validation')
    const saved = await store.saveGiteaSite('https://git.example.com', 'tok-123')
    expect(saved.ok).toBe(true)
    if (!saved.ok) {
      return
    }

    await expect(testGiteaSite(saved.site.id)).resolves.toEqual({
      ok: true,
      account: 'ada'
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports unknown sites and missing tokens on test', async () => {
    await loadStoreModule()
    const { testGiteaSite } = await import('./site-validation')

    await expect(testGiteaSite('nope')).resolves.toEqual({
      ok: false,
      error: expect.any(String)
    })
  })
})
