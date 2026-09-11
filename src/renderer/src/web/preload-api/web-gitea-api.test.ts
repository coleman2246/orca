import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcRenderer: { invoke: vi.fn() } }))

import { giteaApi } from '../../../../preload/gitea'
import { createGiteaApi } from './web-gitea-api'

describe('web Gitea API stubs', () => {
  it('keeps the web Gitea key set in parity with desktop preload', () => {
    expect(Object.keys(createGiteaApi()).sort()).toEqual(Object.keys(giteaApi).sort())
  })

  it('resolves safe-empty values without touching the runtime', async () => {
    const api = createGiteaApi()

    await expect(api.authStatus({ repoPath: '/workspace/repo' })).resolves.toEqual({
      connected: false,
      sites: []
    })
    await expect(api.listIssues({ repoPath: '/workspace/repo' })).resolves.toEqual({
      items: [],
      totalPages: 0
    })
    await expect(api.issue({ repoPath: '/workspace/repo', number: 1 })).resolves.toBeNull()
    await expect(
      api.workItemDetails({ repoPath: '/workspace/repo', number: 1 })
    ).resolves.toBeNull()

    for (const result of [
      await api.createIssue({ repoPath: '/workspace/repo', title: 'Widget' }),
      await api.updateIssue({ repoPath: '/workspace/repo', number: 1, updates: {} }),
      await api.addComment({ repoPath: '/workspace/repo', number: 1, body: 'Note' }),
      await api.saveSite({ baseUrl: 'https://git.example.com', token: 'tok' }),
      await api.removeSite({ id: 's1' }),
      await api.testSite({ id: 's1' })
    ]) {
      expect(result).toEqual({ ok: false, error: expect.any(String) })
    }
  })
})
