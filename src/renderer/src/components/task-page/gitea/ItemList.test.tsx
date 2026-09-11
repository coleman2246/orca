// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GiteaWorkItem } from '../../../../../shared/gitea-types'
import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { TaskPageGiteaItemList } from './ItemList'

function workItem(overrides: Partial<GiteaWorkItem> & { number: number }): GiteaWorkItem {
  return {
    id: `gitea-issue-r1-${overrides.number}`,
    type: 'issue',
    title: `Issue ${overrides.number}`,
    state: 'open',
    url: `https://git.example.com/acme/app/issues/${overrides.number}`,
    labels: ['bug'],
    assignees: ['ada'],
    updatedAt: '2026-09-11T00:00:00Z',
    author: 'ada',
    repoId: 'r1',
    siteId: 's1',
    ...overrides
  }
}

function renderList(args: { items?: GiteaWorkItem[]; loading?: boolean; error?: string | null }) {
  const openGiteaDetailPage = vi.fn()
  const setGiteaRefreshNonce = vi.fn()
  const model = {
    giteaItems: args.items ?? [],
    displayedGiteaItems: args.items ?? [],
    giteaLoading: args.loading ?? false,
    giteaError: args.error ?? null,
    giteaEmptyState: {
      title: 'No Gitea issues',
      description: 'No Gitea issues match this filter.'
    },
    openGiteaDetailPage,
    setGiteaRefreshNonce
  } as unknown as TaskPageComposerActionsModel
  render(<TaskPageGiteaItemList model={model} />)
  return { openGiteaDetailPage, setGiteaRefreshNonce }
}

describe('TaskPageGiteaItemList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders rows with number, title, state, labels and assignee', () => {
    renderList({ items: [workItem({ number: 7 })] })

    expect(screen.getByText('#7')).toBeDefined()
    expect(screen.getByText('Issue 7')).toBeDefined()
    expect(screen.getByText('open')).toBeDefined()
    expect(screen.getByText('bug')).toBeDefined()
    expect(screen.getByText('ada')).toBeDefined()
  })

  it('routes row clicks through the gitea detail entry', () => {
    const item = workItem({ number: 7 })
    const { openGiteaDetailPage } = renderList({ items: [item] })

    fireEvent.click(screen.getByText('Issue 7'))

    expect(openGiteaDetailPage).toHaveBeenCalledWith(item)
  })

  it('shows the empty copy when no rows match', () => {
    renderList({ items: [] })

    expect(screen.getByText('No Gitea issues')).toBeDefined()
  })

  it('retries through the refresh nonce from the error banner', () => {
    const { setGiteaRefreshNonce } = renderList({ items: [], error: 'Unauthorized (HTTP 401)' })

    expect(screen.getByText('Unauthorized (HTTP 401)')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(setGiteaRefreshNonce).toHaveBeenCalled()
  })
})
