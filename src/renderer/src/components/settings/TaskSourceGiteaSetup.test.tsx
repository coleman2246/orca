// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiteaSite } from '../../../../shared/gitea-types'
import { TaskSourceGiteaSetup } from './TaskSourceGiteaSetup'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const giteaApi = vi.hoisted(() => ({
  saveSite: vi.fn(),
  removeSite: vi.fn(),
  testSite: vi.fn()
}))

const SITES: GiteaSite[] = [{ id: 's1', baseUrl: 'https://git.example.com/api/v1', account: 'ada' }]

function renderSetup(overrides: Partial<Parameters<typeof TaskSourceGiteaSetup>[0]> = {}) {
  const onSitesChange = vi.fn()
  const rendered = render(
    <TaskSourceGiteaSetup
      connected
      checking={false}
      visible
      canHide
      onToggleVisible={vi.fn()}
      sites={SITES}
      onSitesChange={onSitesChange}
      {...overrides}
    />
  )
  return { onSitesChange, ...rendered }
}

describe('TaskSourceGiteaSetup', () => {
  beforeEach(() => {
    giteaApi.saveSite.mockReset()
    giteaApi.removeSite.mockReset()
    giteaApi.testSite.mockReset()
    ;(window as unknown as { api: unknown }).api = { gitea: giteaApi }
  })

  afterEach(() => {
    cleanup()
  })

  it('lists connected sites with Test and Remove actions', () => {
    renderSetup()

    expect(screen.getByText('https://git.example.com/api/v1 · ada')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Test' })).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Remove https://git.example.com/api/v1' })
    ).toBeDefined()
  })

  it('verifies a site through the stored-token Test action', async () => {
    giteaApi.testSite.mockResolvedValueOnce({ ok: true, account: 'ada' })
    renderSetup()

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    expect(giteaApi.testSite).toHaveBeenCalledWith({ id: 's1' })
    expect(await screen.findByText('Verified')).toBeDefined()
  })

  it('surfaces Test failures inline', async () => {
    giteaApi.testSite.mockResolvedValueOnce({ ok: false, error: 'bad credentials' })
    renderSetup()

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    expect(await screen.findByText('bad credentials')).toBeDefined()
  })

  it('removes a site and drops it from settings metadata', async () => {
    giteaApi.removeSite.mockResolvedValueOnce({ ok: true })
    const { onSitesChange } = renderSetup()

    fireEvent.click(screen.getByRole('button', { name: 'Remove https://git.example.com/api/v1' }))

    expect(giteaApi.removeSite).toHaveBeenCalledWith({ id: 's1' })
    await vi.waitFor(() => expect(onSitesChange).toHaveBeenCalledWith([]))
  })

  it('saves a new site through Test & Save after main-side validation', async () => {
    const site: GiteaSite = { id: 's2', baseUrl: 'https://forge.example.com/api/v1' }
    giteaApi.saveSite.mockResolvedValueOnce({ ok: true, site })
    const { onSitesChange } = renderSetup({ connected: false, sites: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add Gitea access' }))
    fireEvent.change(screen.getByLabelText('Gitea host URL'), {
      target: { value: 'https://forge.example.com' }
    })
    fireEvent.change(screen.getByLabelText('Personal access token'), {
      target: { value: 'tok-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Test & Save' }))

    expect(giteaApi.saveSite).toHaveBeenCalledWith({
      baseUrl: 'https://forge.example.com',
      token: 'tok-123'
    })
    await vi.waitFor(() => expect(onSitesChange).toHaveBeenCalledWith([site]))
  })

  it('shows save errors without closing the dialog', async () => {
    giteaApi.saveSite.mockResolvedValueOnce({ ok: false, error: 'bad credentials' })
    const { onSitesChange } = renderSetup({ connected: false, sites: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add Gitea access' }))
    fireEvent.change(screen.getByLabelText('Gitea host URL'), {
      target: { value: 'https://forge.example.com' }
    })
    fireEvent.change(screen.getByLabelText('Personal access token'), {
      target: { value: 'bogus' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Test & Save' }))

    expect(await screen.findByText('bad credentials')).toBeDefined()
    expect(onSitesChange).not.toHaveBeenCalled()
  })
})
