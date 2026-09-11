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
