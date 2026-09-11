// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import type { GiteaWorkItem } from '../../../shared/gitea-types'
import type { TaskPageGitLabLoadingModel } from './use-task-page-gitlab-loading'
import { useTaskPageGiteaLoading } from './use-task-page-gitea-loading'

type GiteaListIssuesMock = ReturnType<typeof vi.fn>

function workItem(overrides: Partial<GiteaWorkItem> & { number: number }): GiteaWorkItem {
  return {
    id: `gitea-issue-r1-${overrides.number}`,
    type: 'issue',
    title: `Issue ${overrides.number}`,
    state: 'open',
    url: `https://git.example.com/acme/app/issues/${overrides.number}`,
    labels: [],
    updatedAt: '2026-09-11T00:00:00Z',
    author: null,
    repoId: 'r1',
    siteId: 's1',
    ...overrides
  }
}

function renderGiteaLoadingHook(args: {
  listIssues: GiteaListIssuesMock
  taskSource?: string
  giteaConnected?: boolean
  repos?: { id: string; path: string }[]
  filter?: 'open' | 'closed' | 'all' | 'assigned-to-me'
  page?: number
  refreshNonce?: number
}) {
  ;(window as unknown as { api: unknown }).api = {
    gitea: { listIssues: args.listIssues }
  }
  const setGiteaPage = vi.fn()
  const selectedRepos = (args.repos ?? [{ id: 'r1', path: '/workspace/repo' }]) as never
  const view = renderHook(
    ({ page, filter, refreshNonce }) => {
      const [giteaItems, setGiteaItems] = useState<GiteaWorkItem[]>([])
      const [giteaLoading, setGiteaLoading] = useState(false)
      const [giteaError, setGiteaError] = useState<string | null>(null)
      const model = {
        taskSource: args.taskSource ?? 'gitea',
        giteaConnected: args.giteaConnected ?? true,
        selectedRepos,
        selectedReposKey: JSON.stringify((args.repos ?? [{ id: 'r1' }]).map((r) => r.id)),
        giteaFilter: filter,
        giteaPage: page,
        giteaRefreshNonce: refreshNonce,
        setGiteaItems,
        setGiteaLoading,
        setGiteaError,
        setGiteaPage
      } as unknown as TaskPageGitLabLoadingModel
      useTaskPageGiteaLoading(model)
      return { giteaItems, giteaLoading, giteaError }
    },
    {
      initialProps: {
        page: args.page ?? 0,
        filter: args.filter ?? ('open' as const),
        refreshNonce: args.refreshNonce ?? 0
      }
    }
  )
  return { view, setGiteaPage }
}

describe('useTaskPageGiteaLoading', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    ;(window as unknown as { api: unknown }).api = undefined
  })

  it('merges page results and advances on Load more', async () => {
    const page1 = [
      workItem({ number: 2, updatedAt: '2026-09-11T02:00:00Z' }),
      // Why: siteId falls back to the baseUrl when anonymous/env — grouping
      // and display must tolerate URL-shaped values without parsing them.
      workItem({
        number: 1,
        updatedAt: '2026-09-11T01:00:00Z',
        siteId: 'https://git.example.com/api/v1'
      })
    ]
    const page2 = [workItem({ number: 3, updatedAt: '2026-09-11T03:00:00Z' })]
    const listIssues = vi.fn(async (query: { page?: number }) =>
      query.page === 2 ? { items: page2, totalPages: 2 } : { items: page1, totalPages: 2 }
    )
    const { view } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(2))
    expect(view.result.current.giteaItems.map((item) => item.number)).toEqual([2, 1])
    expect(listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'opened', limit: 50, page: 1 })
    )

    act(() => {
      view.rerender({ page: 1, filter: 'open', refreshNonce: 0 })
    })
    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(3))
    expect(view.result.current.giteaItems.map((item) => item.number)).toEqual([3, 2, 1])
    expect(listIssues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'opened', limit: 50, page: 2 })
    )
    // URL-shaped siteId survives the merge verbatim.
    expect(view.result.current.giteaItems.find((item) => item.number === 1)?.siteId).toBe(
      'https://git.example.com/api/v1'
    )
  })

  it('surfaces a 401 failure as a banner error instead of an empty list', async () => {
    const listIssues = vi.fn(async () => ({
      items: [],
      totalPages: 0,
      error: { type: 'permission_denied', message: 'Unauthorized (HTTP 401)' }
    }))
    const { view } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(view.result.current.giteaError).toBe('Unauthorized (HTTP 401)'))
    expect(view.result.current.giteaItems).toEqual([])
    expect(view.result.current.giteaLoading).toBe(false)
  })

  it('skips a same-generation refresh inside the quiet TTL', async () => {
    const listIssues = vi.fn(async () => ({
      items: [workItem({ number: 1 })],
      totalPages: 1
    }))
    const { view } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(1))
    expect(listIssues).toHaveBeenCalledTimes(1)

    act(() => {
      view.rerender({ page: 0, filter: 'open', refreshNonce: 1 })
    })
    await act(async () => {})
    expect(listIssues).toHaveBeenCalledTimes(1)
  })

  it('passes assignee @me for the assigned-to-me filter', async () => {
    const mine = [workItem({ number: 7 })]
    const listIssues = vi.fn(async (query: { assignee?: string }) =>
      query.assignee === '@me' ? { items: mine, totalPages: 1 } : { items: [], totalPages: 0 }
    )
    const { view } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(listIssues).toHaveBeenCalled())
    expect(listIssues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'opened', page: 1 })
    )
    expect(listIssues.mock.calls[0]?.[0]).not.toHaveProperty('assignee')

    act(() => {
      view.rerender({ page: 0, filter: 'assigned-to-me', refreshNonce: 0 })
    })
    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(1))
    expect(listIssues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'opened', assignee: '@me', page: 1 })
    )
    expect(view.result.current.giteaItems.map((item) => item.number)).toEqual([7])
  })

  it('keeps stale rows behind the banner when a refresh fails', async () => {
    const listIssues = vi.fn(async () => ({
      items: [workItem({ number: 1 }), workItem({ number: 2 })],
      totalPages: 1
    }))
    const { view } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(2))
    expect(view.result.current.giteaError).toBeNull()

    // Why: past the quiet TTL so the refresh actually hits the network.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000)
    listIssues.mockRejectedValueOnce(new Error('network down'))
    try {
      act(() => {
        view.rerender({ page: 0, filter: 'open', refreshNonce: 1 })
      })
      await waitFor(() => expect(view.result.current.giteaError).toBe('network down'))
    } finally {
      nowSpy.mockRestore()
    }
    expect(view.result.current.giteaItems.map((item) => item.number)).toEqual([1, 2])
    expect(view.result.current.giteaLoading).toBe(false)
  })

  it('replaces items from page 1 when the filter changes mid-pagination', async () => {
    const byStateAndPage: Record<string, GiteaWorkItem[]> = {
      'opened:1': [workItem({ number: 1 }), workItem({ number: 2 })],
      'opened:2': [workItem({ number: 3 })],
      'closed:1': [workItem({ number: 9, state: 'closed' })]
    }
    const listIssues = vi.fn(async (query: { state?: string; page?: number }) => ({
      items: byStateAndPage[`${query.state}:${query.page}`] ?? [],
      totalPages: 2
    }))
    const { view, setGiteaPage } = renderGiteaLoadingHook({ listIssues })

    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(2))
    act(() => {
      view.rerender({ page: 1, filter: 'open', refreshNonce: 0 })
    })
    await waitFor(() => expect(view.result.current.giteaItems).toHaveLength(3))

    act(() => {
      view.rerender({ page: 1, filter: 'closed', refreshNonce: 0 })
    })
    await waitFor(() =>
      expect(view.result.current.giteaItems.map((item) => item.number)).toEqual([9])
    )
    expect(listIssues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'closed', page: 1 })
    )
    expect(setGiteaPage).toHaveBeenCalledWith(0)
  })
})
