export type GiteaSite = {
  id: string
  baseUrl: string
  account?: string | null
}

export type GiteaSiteSelection = (string & {}) | 'all'

export type GiteaConnectionStatus = {
  connected: boolean
  sites?: GiteaSite[]
  activeSiteId?: string | null
  credentialError?: string
  // Why: env-deprecation hint — which credential actually served the repo
  // (stored site vs legacy ORCA_GITEA_* env vs anonymous). Populated by the
  // gitea:authStatus handler from resolveGiteaAuth(...).source.
  authSource?: 'site' | 'env' | 'anonymous'
}

export type GiteaIssueInfo = {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  assignees: string[]
  milestone: string | null
  commentsCount: number
  url: string
  updatedAt: string
}

export type GiteaIssueComment = {
  id: number
  body: string
  author: string
  createdAt: string
  url: string
}

export type GiteaIssueUpdatePatch = {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  labels?: string[]
  assignees?: string[]
  milestone?: string | number
}

export type GiteaWorkItem = {
  id: string
  type: 'issue'
  number: number
  title: string
  state: 'open' | 'closed'
  url: string
  labels: string[]
  updatedAt: string
  author: string | null
  repoId: string
  siteId: string
}

export function normalizeGiteaSite<T extends { baseUrl: string }>(site: T): T {
  return { ...site, baseUrl: normalizeGiteaSiteBaseUrl(site.baseUrl) }
}

function normalizeGiteaSiteBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`
}
