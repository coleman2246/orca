import { isWorkItemLinkQueryTooLarge } from './work-item-link-query-bounds'

// Why: Gitea repos live at `<host>/<owner>/<repo>` on any self-hosted
// origin (gitea.example.com or any self-hosted Forgejo/Gitea host),
// so the URL pattern keys on the Gitea-specific `/issues/<n>` and
// `/pulls/<n>` segments rather than locking to a single host. Anything
// matching `/<owner>/<repo>/(issues|pulls)/<digits>` is treated as a Gitea
// item URL regardless of host. Gitea serves pull requests under `/pulls/`;
// surface those as the `pr` work-item type to match the GitHub-side naming
// the composer already understands.
const GITEA_ITEM_PATH_RE = /\/(issues|pulls)\/(\d+)(?:\/.*)?$/i
const GITEA_ITEM_PATH_FULL_RE = /^\/([^/]+\/[^/]+)\/(issues|pulls)\/(\d+)(?:\/.*)?$/i

export type GiteaRepoSlug = {
  /** Gitea hostname, preserving self-hosted instances from pasted URLs. */
  host: string
  /** `owner/repo` path of the Gitea repository. */
  owner: string
  repo: string
}

export type GiteaLinkQuery = {
  query: string
  directNumber: number | null
  tooLarge?: boolean
}

/**
 * Parse a Gitea issue or pull reference from plain input. Accepts:
 *   - bare numbers ("42")
 *   - hash-prefixed numbers ("#42")
 *   - full Gitea URLs (any host) for issues or pulls
 */
export function parseGiteaIssueOrPullNumber(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  // Why: `#42` is the shared markdown shorthand for issues across forges.
  // Accept the prefix so users can drop in either form.
  const numeric = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (/^\d+$/.test(numeric)) {
    return Number.parseInt(numeric, 10)
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const match = GITEA_ITEM_PATH_RE.exec(url.pathname)
  if (!match) {
    return null
  }
  // Why: the basic pattern also matches GitHub URLs (e.g.
  // /owner/repo/issues/123) and legacy GitLab issue paths. Reject the
  // `/-/` separator that's unique to GitLab to avoid mis-classifying a
  // GitLab URL — the inverse of the GitLab guard, which requires `/-/`
  // to avoid mis-classifying GitHub URLs.
  if (url.pathname.includes('/-/')) {
    return null
  }
  return Number.parseInt(match[2], 10)
}

/**
 * Parse a Gitea URL into owner/repo + number + type. Returns null for
 * anything that isn't a recognizable Gitea issue or pull URL.
 */
export function parseGiteaIssueOrPullLink(input: string): {
  slug: GiteaRepoSlug
  owner: string
  repo: string
  number: number
  type: 'issue' | 'pr'
} | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  // Why: reject the GitLab `/-/` separator before matching, so
  // `/a/b/-/issues/1` can never parse as owner `a`, repo `b`.
  if (url.pathname.includes('/-/')) {
    return null
  }

  const match = GITEA_ITEM_PATH_FULL_RE.exec(url.pathname)
  if (!match) {
    return null
  }

  const [owner, repo] = match[1].split('/')
  return {
    slug: { host: url.host, owner, repo },
    owner,
    repo,
    type: match[2].toLowerCase() === 'pulls' ? 'pr' : 'issue',
    number: Number.parseInt(match[3], 10)
  }
}

/**
 * Normalize link-picker input so both raw issue numbers and full Gitea
 * URLs resolve to a usable query + direct-number lookup.
 */
export function normalizeGiteaLinkQuery(raw: string): GiteaLinkQuery {
  if (isWorkItemLinkQueryTooLarge(raw)) {
    return { query: '', directNumber: null, tooLarge: true }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { query: '', directNumber: null }
  }

  const direct = parseGiteaIssueOrPullNumber(trimmed)
  if (direct !== null && !trimmed.startsWith('http')) {
    return { query: trimmed, directNumber: direct }
  }

  const link = parseGiteaIssueOrPullLink(trimmed)
  if (!link) {
    return { query: trimmed, directNumber: null }
  }

  // Why: any Gitea issue/pull URL is accepted by number regardless of
  // slug, mirroring the GitHub-side behavior — fork checkouts can
  // legitimately target an upstream's issue numbers.
  return {
    query: trimmed,
    directNumber: link.number
  }
}
