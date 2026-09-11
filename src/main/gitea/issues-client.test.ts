import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiteaSite } from '../../shared/gitea-types'
import type { GiteaRepoRef } from './repository-ref'
import { GiteaApiError, type GiteaCallAuth } from './issues-client'

const OLD_ENV = process.env

const site: GiteaSite = { id: 'site-1', baseUrl: 'https://git.example.com' }
const repo: GiteaRepoRef = {
  host: 'git.example.com',
  owner: 'o',
  repo: 'r',
  apiBaseUrl: 'https://git.example.com/api/v1',
  webBaseUrl: 'https://git.example.com'
}
const auth: GiteaCallAuth = { site, token: 'tok-test' }

function giteaIssue(index = 42) {
  return {
    number: index,
    title: 'Broken widget',
    body: 'steps…',
    state: 'open',
    labels: [{ name: 'bug' }],
    assignees: [{ login: 'ada' }],
    milestone: null,
    comments: 3,
    html_url: `https://git.example.com/o/r/issues/${index}`,
    updated_at: '2026-09-01T00:00:00Z'
  }
}

describe('Gitea issues client', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.ORCA_GITEA_TOKEN
    delete process.env.ORCA_GITEA_API_BASE_URL
    vi.unstubAllGlobals()
  })

  it('sends the passed per-site token instead of reading env', async () => {
    const { listGiteaIssues } = await import('./issues-client')
    process.env.ORCA_GITEA_TOKEN = 'env-token-should-be-ignored'
    const fetchMock = vi.fn(async () => Response.json([giteaIssue(42)]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listGiteaIssues(auth, repo)

    expect(result.items).toHaveLength(1)
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('token tok-test')
  })

  it('lists issues with the expected query and filters PR entries', async () => {
    const { listGiteaIssues } = await import('./issues-client')
    const fetchMock = vi.fn(async () =>
      Response.json([giteaIssue(42), { ...giteaIssue(43), pull_request: { merged: false } }])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await listGiteaIssues(auth, repo)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ number: 42, state: 'open' })
    expect(result.totalPages).toBe(1)
    expect(result.error).toBeUndefined()
    const listUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(listUrl.pathname).toBe('/api/v1/repos/o/r/issues')
    expect(listUrl.searchParams.get('state')).toBe('open')
    expect(listUrl.searchParams.get('limit')).toBe('50')
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('token tok-test')
  })

  it('surfaces the server message on a 401 instead of collapsing the pager silently', async () => {
    const { listGiteaIssues } = await import('./issues-client')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ message: 'token requires scope issue:write' }, { status: 401 })
      )
    )

    const result = await listGiteaIssues(auth, repo)

    expect(result.items).toEqual([])
    expect(result.totalPages).toBe(0)
    expect(result.error).toMatchObject({
      type: 'permission_denied',
      message: 'token requires scope issue:write'
    })
  })

  it('throws a GiteaApiError with the server message for direct reads', async () => {
    const { getGiteaIssue } = await import('./issues-client')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'not found' }, { status: 404 }))
    )

    await expect(getGiteaIssue(auth, repo, 99)).resolves.toBeNull()
  })

  it('creates, updates, and comments on issues against the expected endpoints', async () => {
    const { createGiteaIssue, updateGiteaIssue, addGiteaIssueComment, listGiteaIssueComments } =
      await import('./issues-client')
    const calls: string[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`)
      if (String(url).endsWith('/comments') && (init?.method ?? 'GET') === 'GET') {
        return Response.json([
          {
            id: 7,
            body: 'looking',
            html_url: 'https://git.example.com/o/r/issues/42#issuecomment-7',
            created_at: '2026-09-02T00:00:00Z',
            user: { login: 'ada' }
          }
        ])
      }
      if (String(url).endsWith('/comments')) {
        return Response.json({
          id: 7,
          body: 'looking',
          html_url: 'https://git.example.com/o/r/issues/42#issuecomment-7',
          created_at: '2026-09-02T00:00:00Z',
          user: { login: 'ada' }
        })
      }
      return Response.json(giteaIssue(42))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createGiteaIssue(auth, repo, { title: 'Broken widget', labels: ['bug'] })
    ).resolves.toMatchObject({ number: 42 })
    await expect(updateGiteaIssue(auth, repo, 42, { state: 'closed' })).resolves.toMatchObject({
      number: 42
    })
    await expect(addGiteaIssueComment(auth, repo, 42, 'looking')).resolves.toMatchObject({
      id: 7,
      author: 'ada'
    })
    await expect(listGiteaIssueComments(auth, repo, 42)).resolves.toHaveLength(1)

    expect(calls[0]).toBe('POST https://git.example.com/api/v1/repos/o/r/issues')
    expect(calls[1]).toBe('PATCH https://git.example.com/api/v1/repos/o/r/issues/42')
    expect(calls[2]).toBe('POST https://git.example.com/api/v1/repos/o/r/issues/42/comments')
    expect(calls[3]).toBe('GET https://git.example.com/api/v1/repos/o/r/issues/42/comments')
  })

  it('redacts the passed token from thrown error messages', async () => {
    const { createGiteaIssue } = await import('./issues-client')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'bad token tok-test rejected' }, { status: 401 }))
    )

    const error = await createGiteaIssue(auth, repo, { title: 'x' }).catch((e) => e)
    expect(error).toBeInstanceOf(GiteaApiError)
    expect((error as GiteaApiError).status).toBe(401)
    expect((error as Error).message).not.toContain('tok-test')
    expect((error as Error).message).toContain('[REDACTED]')
  })
})
