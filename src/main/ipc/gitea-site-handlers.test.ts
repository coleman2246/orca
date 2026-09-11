import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ipcHandlers, saveGiteaSiteMock, removeGiteaSiteMock, testGiteaSiteMock } = vi.hoisted(
  () => ({
    ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
    saveGiteaSiteMock: vi.fn(),
    removeGiteaSiteMock: vi.fn(),
    testGiteaSiteMock: vi.fn()
  })
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler)
    })
  }
}))

vi.mock('../gitea/site-credential-store', () => ({
  saveGiteaSite: saveGiteaSiteMock,
  removeGiteaSite: removeGiteaSiteMock
}))

vi.mock('../gitea/site-validation', () => ({
  testGiteaSite: testGiteaSiteMock
}))

import { registerGiteaSiteHandlers } from './gitea-site-handlers'

describe('Gitea site IPC handlers', () => {
  beforeEach(() => {
    ipcHandlers.clear()
    saveGiteaSiteMock.mockReset()
    removeGiteaSiteMock.mockReset()
    testGiteaSiteMock.mockReset()
    registerGiteaSiteHandlers()
  })

  it('saves a site after main-side token validation', async () => {
    const site = { id: 's1', baseUrl: 'https://git.example.com/api/v1', account: 'ada' }
    saveGiteaSiteMock.mockResolvedValueOnce({ ok: true, site })

    const result = await ipcHandlers.get('gitea:saveSite')?.(null, {
      baseUrl: 'https://git.example.com',
      token: 'tok-123'
    })

    expect(saveGiteaSiteMock).toHaveBeenCalledWith('https://git.example.com', 'tok-123')
    expect(result).toEqual({ ok: true, site })
  })

  it('rejects save without a host URL', async () => {
    const result = await ipcHandlers.get('gitea:saveSite')?.(null, {
      baseUrl: '  ',
      token: 'tok-123'
    })

    expect(result).toEqual({ ok: false, error: expect.any(String) })
    expect(saveGiteaSiteMock).not.toHaveBeenCalled()
  })

  it('removes a site by id', async () => {
    const result = await ipcHandlers.get('gitea:removeSite')?.(null, { id: 's1' })

    expect(removeGiteaSiteMock).toHaveBeenCalledWith('s1')
    expect(result).toEqual({ ok: true })
  })

  it('rejects remove without a site id', async () => {
    const result = await ipcHandlers.get('gitea:removeSite')?.(null, {})

    expect(result).toEqual({ ok: false, error: expect.any(String) })
    expect(removeGiteaSiteMock).not.toHaveBeenCalled()
  })

  it('tests a site with its stored token', async () => {
    testGiteaSiteMock.mockResolvedValueOnce({ ok: true, account: 'ada' })

    const result = await ipcHandlers.get('gitea:testSite')?.(null, { id: 's1' })

    expect(testGiteaSiteMock).toHaveBeenCalledWith('s1')
    expect(result).toEqual({ ok: true, account: 'ada' })
  })
})
