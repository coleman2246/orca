import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { buildWorktree, okFixture, queueFixtures, worktreeListFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

const GITEA_ISSUE_LOOKUP = {
  item: {
    id: 'gitea-issue-repo-1-42',
    type: 'issue' as const,
    number: 42,
    title: 'Broken widget',
    state: 'open' as const,
    url: 'https://git.example.com/acme/app/issues/42',
    labels: ['bug'],
    assignees: ['ada'],
    updatedAt: '2026-09-01T00:00:00Z',
    author: null,
    repoId: 'repo-1',
    siteId: 'site-1'
  },
  sourceContext: {
    kind: 'task-source' as const,
    provider: 'gitea' as const,
    projectId: 'repo-1',
    hostId: 'local'
  }
}

const EXPECTED_LINKED_WORK_ITEM = {
  provider: 'gitea',
  type: 'issue',
  number: 42,
  title: 'Broken widget',
  url: 'https://git.example.com/acme/app/issues/42',
  repoId: 'repo-1'
}

describe('orca cli gitea issue linking', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  it('resolves --gitea-issue and links it through worktree.create', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo', 'main', 'abc', 'repo-1')]),
      okFixture('req_gitea_issue', GITEA_ISSUE_LOOKUP),
      okFixture('req_create_gitea', {
        worktree: buildWorktree('/tmp/repo/feature', 'feature', 'abc', 'repo-1')
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'create',
        '--repo',
        'id:repo-1',
        '--name',
        'feature',
        '--gitea-issue',
        '42',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenNthCalledWith(2, 'gitea.issue', { repo: 'id:repo-1', number: 42 })
    expect(callMock).toHaveBeenNthCalledWith(
      3,
      'worktree.create',
      expect.objectContaining({
        repo: 'id:repo-1',
        name: 'feature',
        linkedWorkItem: EXPECTED_LINKED_WORK_ITEM,
        linkedTaskSourceContext: GITEA_ISSUE_LOOKUP.sourceContext
      })
    )
  })

  it('accepts a pasted Gitea issue URL', async () => {
    queueFixtures(
      callMock,
      okFixture('req_gitea_issue_url', GITEA_ISSUE_LOOKUP),
      okFixture('req_create_gitea_url', {
        worktree: buildWorktree('/tmp/repo/feature', 'feature', 'abc', 'repo-1'),
        lineage: null,
        warnings: []
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'create',
        '--repo',
        'id:repo-1',
        '--name',
        'feature',
        '--gitea-issue',
        'https://git.example.com/acme/app/issues/42',
        '--no-parent',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('gitea.issue', { repo: 'id:repo-1', number: 42 })
    expect(callMock).toHaveBeenCalledWith(
      'worktree.create',
      expect.objectContaining({ linkedWorkItem: EXPECTED_LINKED_WORK_ITEM })
    )
  })

  // Why: `set` takes no --repo, so the repo that owns the Gitea remote has to
  // come off the worktree being edited.
  it('resolves --gitea-issue on set through the worktree repo', async () => {
    queueFixtures(
      callMock,
      okFixture('req_show_for_gitea', { worktree: { repoId: 'repo-1' } }),
      okFixture('req_gitea_issue_set', GITEA_ISSUE_LOOKUP),
      okFixture('req_set_gitea', {
        worktree: buildWorktree('/tmp/repo/feature', 'feature', 'abc', 'repo-1')
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      ['worktree', 'set', '--worktree', 'id:repo-1::/tmp/repo', '--gitea-issue', '42', '--json'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('gitea.issue', { repo: 'id:repo-1', number: 42 })
    expect(callMock).toHaveBeenCalledWith(
      'worktree.set',
      expect.objectContaining({ linkedWorkItem: EXPECTED_LINKED_WORK_ITEM })
    )
  })

  // Why: unlinking must not need a live Gitea, so it never asks the runtime.
  it('clears the link on --gitea-issue null without any lookup', async () => {
    queueFixtures(
      callMock,
      okFixture('req_set_gitea_null', {
        worktree: buildWorktree('/tmp/repo/feature', 'feature', 'abc', 'repo-1')
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      ['worktree', 'set', '--worktree', 'id:repo-1::/tmp/repo', '--gitea-issue', 'null', '--json'],
      '/tmp/repo'
    )

    expect(callMock).not.toHaveBeenCalledWith('gitea.issue', expect.anything())
    expect(callMock).toHaveBeenCalledWith(
      'worktree.set',
      expect.objectContaining({ linkedWorkItem: null, linkedTaskSourceContext: null })
    )
  })
})
