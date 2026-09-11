import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../persistence'
import type { Repo } from '../../shared/repo-types'

const {
  ipcHandlers,
  listGiteaIssuesMock,
  getGiteaIssueMock,
  createGiteaIssueMock,
  updateGiteaIssueMock,
  addGiteaIssueCommentMock,
  listGiteaIssueCommentsMock,
  getGiteaRepoRefMock,
  getGiteaSiteForRepoMock,
  resolveGiteaAuthMock,
  getGiteaConnectionStatusMock
} = vi.hoisted(() => ({
  ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  listGiteaIssuesMock: vi.fn(),
  getGiteaIssueMock: vi.fn(),
  createGiteaIssueMock: vi.fn(),
  updateGiteaIssueMock: vi.fn(),
  addGiteaIssueCommentMock: vi.fn(),
  listGiteaIssueCommentsMock: vi.fn(),
  getGiteaRepoRefMock: vi.fn(),
  getGiteaSiteForRepoMock: vi.fn(),
  resolveGiteaAuthMock: vi.fn(),
  getGiteaConnectionStatusMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler)
    })
  }
}))

vi.mock('../gitea/issues-client', () => ({
  addGiteaIssueComment: addGiteaIssueCommentMock,
  createGiteaIssue: createGiteaIssueMock,
  getGiteaIssue: getGiteaIssueMock,
  listGiteaIssueComments: listGiteaIssueCommentsMock,
  listGiteaIssues: listGiteaIssuesMock,
  updateGiteaIssue: updateGiteaIssueMock
}))

vi.mock('../gitea/repository-ref', () => ({
  getGiteaRepoRef: getGiteaRepoRefMock
}))

vi.mock('../gitea/site-credential-store', () => ({
  getGiteaConnectionStatus: getGiteaConnectionStatusMock,
  getGiteaSiteForRepo: getGiteaSiteForRepoMock,
  resolveGiteaAuth: resolveGiteaAuthMock
}))

import { registerGiteaIssueHandlers } from './gitea-issue-handlers'

const repoRef = {
  host: 'git.example.com',
  hostIdentity: 'git.example.com',
  owner: 'octo',
  repo: 'orca',
  apiBaseUrl: 'https://git.example.com/api/v1',
  webBaseUrl: 'https://git.example.com'
}

const site = { id: 'site-1', baseUrl: 'https://git.example.com/api/v1' }

const issue42 = {
  number: 42,
  title: 'Broken widget',
  body: 'steps…',
  state: 'open',
  labels: ['bug'],
  assignees: ['ada'],
  milestone: null,
  commentsCount: 3,
  url: 'https://git.example.com/octo/orca/issues/42',
  updatedAt: '2026-09-01T00:00:00Z'
}

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/local/orca',
    displayName: 'Orca',
    badgeColor: '#737373',
    addedAt: 1,
    ...overrides
  }
}

function storeWithRepos(
  repos: Repo[],
  projects: ReturnType<Store['getProjects']> = []
): Pick<Store, 'getRepos' | 'getRepo' | 'getProjects' | 'getSettings'> {
  return {
    getRepos: () => repos,
    getRepo: (id: string) => repos.find((candidate) => candidate.id === id),
    getProjects: () => projects,
    getSettings: () =>
      ({
        localWindowsRuntimeDefault: { kind: 'windows-host' }
      }) as ReturnType<Store['getSettings']>
  }
}

describe('Gitea IPC handlers', () => {
  beforeEach(() => {
    ipcHandlers.clear()
    for (const mock of [
      listGiteaIssuesMock,
      getGiteaIssueMock,
      createGiteaIssueMock,
      updateGiteaIssueMock,
      addGiteaIssueCommentMock,
      listGiteaIssueCommentsMock,
      getGiteaRepoRefMock,
      getGiteaSiteForRepoMock,
      resolveGiteaAuthMock,
      getGiteaConnectionStatusMock
    ]) {
      mock.mockReset()
    }
    getGiteaRepoRefMock.mockResolvedValue(repoRef)
    getGiteaSiteForRepoMock.mockReturnValue(site)
    resolveGiteaAuthMock.mockReturnValue({
      baseUrl: site.baseUrl,
      token: 'token-1',
      source: 'site'
    })
  })

  it('maps listed Gitea issues to work items', async () => {
    listGiteaIssuesMock.mockResolvedValueOnce({ items: [issue42], totalPages: 1 })
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    const result = await ipcHandlers.get('gitea:listIssues')?.(null, {
      repoPath: '/local/orca',
      state: 'opened',
      page: 1
    })

    expect(listGiteaIssuesMock).toHaveBeenCalledWith({ site, token: 'token-1' }, repoRef, {
      state: 'open',
      page: 1,
      limit: 20
    })
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'gitea-issue-repo-1-42',
          type: 'issue',
          number: 42,
          siteId: 'site-1'
        })
      ],
      totalPages: 1
    })
  })

  it('passes assignedBy from the stored site account for assignee @me', async () => {
    listGiteaIssuesMock.mockResolvedValueOnce({ items: [], totalPages: 0 })
    getGiteaSiteForRepoMock.mockReturnValueOnce({ ...site, account: 'ada' })
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    await ipcHandlers.get('gitea:listIssues')?.(null, {
      repoPath: '/local/orca',
      state: 'opened',
      assignee: '@me',
      page: 1
    })

    expect(listGiteaIssuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token-1' }),
      repoRef,
      {
        state: 'open',
        page: 1,
        limit: 20,
        assignedBy: 'ada'
      }
    )
  })

  it('omits assignedBy when no stored account is known', async () => {
    listGiteaIssuesMock.mockResolvedValueOnce({ items: [], totalPages: 0 })
    getGiteaSiteForRepoMock.mockReturnValueOnce(null)
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    await ipcHandlers.get('gitea:listIssues')?.(null, {
      repoPath: '/local/orca',
      state: 'opened',
      assignee: '@me',
      page: 1
    })

    expect(listGiteaIssuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token-1' }),
      repoRef,
      {
        state: 'open',
        page: 1,
        limit: 20
      }
    )
  })

  it('rejects unregistered repository paths', async () => {
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    await expect(
      ipcHandlers.get('gitea:listIssues')?.(null, { repoPath: '/elsewhere/orca' })
    ).rejects.toThrow('Access denied')
  })

  it.each(['site', 'env', 'anonymous'] as const)(
    'reports authSource %s from the resolved auth',
    async (source) => {
      getGiteaConnectionStatusMock.mockReturnValueOnce({
        connected: source === 'site',
        sites: source === 'site' ? [site] : [],
        activeSiteId: source === 'site' ? site.id : null
      })
      resolveGiteaAuthMock.mockReturnValueOnce({
        baseUrl: site.baseUrl,
        token: source === 'anonymous' ? null : 'token-1',
        source
      })
      registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

      const result = await ipcHandlers.get('gitea:authStatus')?.(null, {
        repoPath: '/local/orca'
      })

      expect(result).toMatchObject({ authSource: source })
    }
  )

  it('aggregates issue details with comments', async () => {
    getGiteaIssueMock.mockResolvedValueOnce(issue42)
    const comment = {
      id: 7,
      body: 'Looking into it',
      author: 'ada',
      createdAt: '2026-09-02T00:00:00Z',
      url: 'https://git.example.com/octo/orca/issues/42#issuecomment-7'
    }
    listGiteaIssueCommentsMock.mockResolvedValueOnce([comment])
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    const result = await ipcHandlers.get('gitea:workItemDetails')?.(null, {
      repoPath: '/local/orca',
      number: 42
    })

    expect(result).toEqual({
      issue: expect.objectContaining({ number: 42 }),
      comments: [comment]
    })
  })

  it('returns an ok envelope for created issues and errors for failed updates', async () => {
    createGiteaIssueMock.mockResolvedValueOnce({
      ...issue42,
      number: 43,
      url: 'https://git.example.com/octo/orca/issues/43'
    })
    updateGiteaIssueMock.mockRejectedValueOnce(new Error('Gitea request failed (HTTP 403)'))
    registerGiteaIssueHandlers(storeWithRepos([repo()]) as Store)

    await expect(
      ipcHandlers.get('gitea:createIssue')?.(null, {
        repoPath: '/local/orca',
        title: 'New widget'
      })
    ).resolves.toEqual({
      ok: true,
      number: 43,
      url: 'https://git.example.com/octo/orca/issues/43'
    })
    await expect(
      ipcHandlers.get('gitea:updateIssue')?.(null, {
        repoPath: '/local/orca',
        number: 42,
        updates: { state: 'closed' }
      })
    ).resolves.toEqual({ ok: false, error: expect.stringContaining('403') })
  })
})
