import { describe, expect, it, vi } from 'vitest'
import {
  getOptionalGiteaIssueFlag,
  resolveGiteaIssueLinkForWorktree,
  resolveGiteaIssueLinkUpdates
} from './worktree-gitea-issue-link'
import { RuntimeClientError } from '../runtime-client'

function flags(entries: Record<string, string | boolean>): Map<string, string | boolean> {
  return new Map(Object.entries(entries))
}

describe('getOptionalGiteaIssueFlag', () => {
  it('returns undefined when the flag is absent', () => {
    expect(getOptionalGiteaIssueFlag(flags({}), 'gitea-issue')).toBeUndefined()
  })

  it('accepts a bare issue number', () => {
    expect(getOptionalGiteaIssueFlag(flags({ 'gitea-issue': '42' }), 'gitea-issue')).toEqual({
      number: 42
    })
  })

  it('accepts a hash-prefixed issue number', () => {
    expect(getOptionalGiteaIssueFlag(flags({ 'gitea-issue': '#7' }), 'gitea-issue')).toEqual({
      number: 7
    })
  })

  it('accepts a Gitea issue URL on any host', () => {
    expect(
      getOptionalGiteaIssueFlag(
        flags({ 'gitea-issue': 'https://git.example.com/acme/app/issues/7' }),
        'gitea-issue'
      )
    ).toEqual({ number: 7 })
  })

  // Why: Gitea shares one number space between issues and pulls, so a pull URL
  // parses to a number that would link as an issue the drawer can never match.
  it('rejects a pull request URL', () => {
    expect(() =>
      getOptionalGiteaIssueFlag(
        flags({ 'gitea-issue': 'https://git.example.com/acme/app/pulls/9' }),
        'gitea-issue'
      )
    ).toThrow(/pull request/)
  })

  it('rejects a GitLab URL', () => {
    expect(() =>
      getOptionalGiteaIssueFlag(
        flags({ 'gitea-issue': 'https://gl.example.com/a/b/-/issues/1' }),
        'gitea-issue'
      )
    ).toThrow(RuntimeClientError)
  })

  it('rejects null on create and accepts it on set', () => {
    expect(() =>
      getOptionalGiteaIssueFlag(flags({ 'gitea-issue': 'null' }), 'gitea-issue')
    ).toThrow(/Omit --gitea-issue on create/)
    expect(
      getOptionalGiteaIssueFlag(flags({ 'gitea-issue': 'null' }), 'gitea-issue', {
        allowNull: true
      })
    ).toBe('clear')
  })

  it('rejects a value-less flag', () => {
    expect(() => getOptionalGiteaIssueFlag(flags({ 'gitea-issue': true }), 'gitea-issue')).toThrow(
      /Missing value/
    )
  })
})

describe('resolveGiteaIssueLinkUpdates', () => {
  const lookup = {
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
      hostId: 'local' as const
    }
  }

  it('builds the composer linked work item from the resolved issue', async () => {
    const call = vi.fn().mockResolvedValue({ result: lookup })
    const updates = await resolveGiteaIssueLinkUpdates({ number: 42 }, 'id:repo-1', { call })
    expect(call).toHaveBeenCalledWith('gitea.issue', { repo: 'id:repo-1', number: 42 })
    expect(updates.linkedWorkItem).toEqual({
      provider: 'gitea',
      type: 'issue',
      number: 42,
      title: 'Broken widget',
      url: 'https://git.example.com/acme/app/issues/42',
      repoId: 'repo-1'
    })
    expect(updates.linkedTaskSourceContext).toEqual(lookup.sourceContext)
  })

  it('clears both fields without a round trip', async () => {
    const call = vi.fn()
    expect(await resolveGiteaIssueLinkUpdates('clear', 'id:repo-1', { call })).toEqual({
      linkedWorkItem: null,
      linkedTaskSourceContext: null
    })
    expect(call).not.toHaveBeenCalled()
  })

  it('reports a missing issue instead of linking nothing', async () => {
    const call = vi.fn().mockResolvedValue({ result: null })
    await expect(
      resolveGiteaIssueLinkUpdates({ number: 99 }, 'id:repo-1', { call })
    ).rejects.toThrow(/Gitea issue #99 was not found/)
  })
})

describe('resolveGiteaIssueLinkForWorktree', () => {
  it('reads the repo off the worktree being edited', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ result: { worktree: { repoId: 'repo-9' } } })
      .mockResolvedValueOnce({ result: null })
    await expect(
      resolveGiteaIssueLinkForWorktree({ number: 3 }, 'active', { call })
    ).rejects.toThrow(/not found/)
    expect(call).toHaveBeenNthCalledWith(1, 'worktree.show', { worktree: 'active' })
    expect(call).toHaveBeenNthCalledWith(2, 'gitea.issue', { repo: 'id:repo-9', number: 3 })
  })

  it('never calls worktree.show when clearing', async () => {
    const call = vi.fn()
    expect(await resolveGiteaIssueLinkForWorktree('clear', 'active', { call })).toEqual({
      linkedWorkItem: null,
      linkedTaskSourceContext: null
    })
    expect(call).not.toHaveBeenCalled()
  })
})
