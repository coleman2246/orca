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

/**
 * Normalize persisted Gitea site metadata for global settings.
 * Picks only metadata fields (id, baseUrl, account) so a token can
 * never round-trip through settings — tokens stay in the secret store.
 */
export function normalizeGiteaSites(value: unknown): GiteaSite[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const sites: GiteaSite[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const record = entry as Record<string, unknown>
    if (typeof record.id !== 'string' || record.id.length === 0) {
      continue
    }
    if (typeof record.baseUrl !== 'string' || record.baseUrl.trim().length === 0) {
      continue
    }
    if (seen.has(record.id)) {
      continue
    }
    seen.add(record.id)
    sites.push({
      id: record.id,
      baseUrl: normalizeGiteaSiteBaseUrl(record.baseUrl),
      ...(typeof record.account === 'string' && record.account.length > 0
        ? { account: record.account }
        : {})
    })
  }
  return sites
}

function normalizeGiteaSiteBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`
}
