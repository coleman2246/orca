import type { PreloadApi } from '../../../../preload/api-types'

export type WebGiteaApi = NonNullable<PreloadApi['gitea']>

export type WebGiteaResult<K extends keyof WebGiteaApi> = Awaited<ReturnType<WebGiteaApi[K]>>

// Why: remote-runtime routing for Gitea is deferred — the desktop
// main-process handlers have no RPC counterpart yet. These safe-empty
// stubs keep `window.api.gitea` defined on web so Tasks code calling it
// resolves instead of crashing on `undefined`.
const WEB_GITEA_UNAVAILABLE = 'Gitea is not available in the web client yet.'

export function createGiteaApi(): WebGiteaApi {
  const giteaApi = {
    issue: () => Promise.resolve(null),
    listIssues: () => Promise.resolve({ items: [], totalPages: 0 }),
    createIssue: () => Promise.resolve({ ok: false, error: WEB_GITEA_UNAVAILABLE }),
    updateIssue: () => Promise.resolve({ ok: false, error: WEB_GITEA_UNAVAILABLE }),
    addComment: () => Promise.resolve({ ok: false, error: WEB_GITEA_UNAVAILABLE }),
    authStatus: () => Promise.resolve({ connected: false, sites: [] }),
    workItemDetails: () => Promise.resolve(null)
  } satisfies WebGiteaApi

  return giteaApi
}
