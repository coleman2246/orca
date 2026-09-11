import { ipcMain } from 'electron'
import { removeGiteaSite, saveGiteaSite } from '../gitea/site-credential-store'
import { testGiteaSite } from '../gitea/site-validation'

// Why: Settings Tasks-pane site management has no repo context, so it cannot
// ride the repo-scoped issue channels — these global handlers wrap the
// Task 3 credential store (GET /user validation in main, tokens never leave).
export function registerGiteaSiteHandlers(): void {
  ipcMain.handle('gitea:saveSite', async (_event, args: { baseUrl?: unknown; token?: unknown }) => {
    const baseUrl = typeof args?.baseUrl === 'string' ? args.baseUrl : ''
    const token = typeof args?.token === 'string' ? args.token : ''
    if (!baseUrl.trim()) {
      return { ok: false as const, error: 'Gitea host URL is required.' }
    }
    return saveGiteaSite(baseUrl, token)
  })

  ipcMain.handle('gitea:removeSite', async (_event, args: { id?: unknown }) => {
    if (typeof args?.id !== 'string' || !args.id) {
      return { ok: false as const, error: 'Site id is required.' }
    }
    removeGiteaSite(args.id)
    return { ok: true as const }
  })

  ipcMain.handle('gitea:testSite', async (_event, args: { id?: unknown }) => {
    if (typeof args?.id !== 'string' || !args.id) {
      return { ok: false as const, error: 'Site id is required.' }
    }
    return testGiteaSite(args.id)
  })
}
