// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GiteaIssueComment,
  GiteaIssueInfo,
  GiteaWorkItem
} from '../../../../shared/gitea-types'
import GiteaItemDialog from './GiteaItemDialog'

vi.mock('@/components/ui/sheet', () => ({
  // Why: Radix portals keep the sheet out of happy-dom's document body —
  // render inline so the mutation assertions measure the dialog, not Radix.
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  // Why: the header dismiss control shares the footer's accessible name —
  // drop it so the mutation assertions target the action buttons.
  SheetClose: () => null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/components/sidebar/CommentMarkdown', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>
}))

const giteaApi = vi.hoisted(() => ({
  workItemDetails: vi.fn(),
  updateIssue: vi.fn(),
  addComment: vi.fn()
}))

function workItem(overrides: Partial<GiteaWorkItem> = {}): GiteaWorkItem {
  return {
    id: 'gitea-issue-r1-7',
    type: 'issue',
    number: 7,
    title: 'Fix login',
    state: 'open',
    url: 'https://git.example.com/acme/app/issues/7',
    labels: ['bug'],
    assignees: ['ada'],
    updatedAt: '2026-09-11T00:00:00Z',
    author: 'ada',
    repoId: 'r1',
    // Why: siteId may be URL-shaped (baseUrl fallback) — display only, never parsed.
    siteId: 'https://git.example.com/api/v1',
    ...overrides
  }
}

function issueInfo(overrides: Partial<GiteaIssueInfo> = {}): GiteaIssueInfo {
  return {
    number: 7,
    title: 'Fix login',
    body: 'Repro steps go here.',
    state: 'open',
    labels: ['bug'],
    assignees: ['ada'],
    milestone: 'v1.0',
    commentsCount: 0,
    url: 'https://git.example.com/acme/app/issues/7',
    updatedAt: '2026-09-11T00:00:00Z',
    ...overrides
  }
}

function renderDialog(item: GiteaWorkItem = workItem()) {
  const onClose = vi.fn()
  const onMutated = vi.fn()
  render(
    <GiteaItemDialog
      item={item}
      repoPath="/workspace/repo"
      repoId="r1"
      onClose={onClose}
      onMutated={onMutated}
    />
  )
  return { onClose, onMutated }
}

describe('GiteaItemDialog mutations', () => {
  beforeEach(() => {
    giteaApi.workItemDetails.mockReset()
    giteaApi.updateIssue.mockReset()
    giteaApi.addComment.mockReset()
    giteaApi.workItemDetails.mockResolvedValue({
      issue: issueInfo(),
      comments: [] as GiteaIssueComment[]
    })
    ;(window as unknown as { api: unknown }).api = { gitea: giteaApi }
  })

  afterEach(() => {
    cleanup()
    ;(window as unknown as { api: unknown }).api = undefined
  })

  it('flips the status chip to closed optimistically when updateIssue resolves', async () => {
    // Why: the dialog refreshes after a mutation — the fake server applies
    // the state change so the refetch confirms the optimistic patch.
    let serverState: 'open' | 'closed' = 'open'
    let resolveUpdate!: (value: { ok: true }) => void
    giteaApi.workItemDetails.mockImplementation(async () => ({
      issue: issueInfo({ state: serverState }),
      comments: [] as GiteaIssueComment[]
    }))
    giteaApi.updateIssue.mockImplementation(
      (args: { updates?: { state?: 'open' | 'closed' } }) =>
        new Promise<{ ok: true }>((resolve) => {
          resolveUpdate = (value) => {
            if (args.updates?.state) {
              serverState = args.updates.state
            }
            resolve(value)
          }
        })
    )
    const { onMutated } = renderDialog()

    // Why: details load before the footer Close action is available.
    const closeButton = await screen.findByRole('button', { name: 'Close' })
    expect(screen.getByText('open')).toBeDefined()
    expect(giteaApi.workItemDetails).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/workspace/repo', repoId: 'r1', number: 7 })
    )

    fireEvent.click(closeButton)

    expect(giteaApi.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ number: 7, updates: { state: 'closed' } })
    )
    // Why: optimistic before the promise settles — the chip flips while the
    // mutation is still in flight.
    expect(screen.getByText('closed')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeDefined()

    resolveUpdate({ ok: true })
    await waitFor(() => expect(onMutated).toHaveBeenCalled())
    expect(screen.getByText('closed')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeDefined()
  })

  it('rolls back to open when updateIssue rejects', async () => {
    giteaApi.updateIssue.mockRejectedValueOnce(new Error('boom'))
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    expect(giteaApi.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ number: 7, updates: { state: 'closed' } })
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeDefined())
    expect(screen.getByText('open')).toBeDefined()
  })
})
