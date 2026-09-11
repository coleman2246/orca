import type { GiteaIssueInfo } from '../../shared/gitea-types'

export type RawGiteaIssue = {
  number?: number
  title?: string | null
  body?: string | null
  state?: string | null
  labels?: ({ name?: string | null } | string)[] | null
  assignees?:
    | ({ login?: string | null; username?: string | null; full_name?: string | null } | string)[]
    | null
  milestone?: { title?: string | null } | string | null
  comments?: number | null
  html_url?: string | null
  updated_at?: string | null
  pull_request?: unknown
}

export function mapGiteaIssueState(raw: Pick<RawGiteaIssue, 'state'>): GiteaIssueInfo['state'] {
  return raw.state?.trim().toLowerCase() === 'closed' ? 'closed' : 'open'
}

// Why: Gitea shares the issue/PR number space — the issues endpoint returns
// pull requests too (marked with a `pull_request` field), so callers filter
// them out with this guard.
export function isGiteaIssue(raw: Pick<RawGiteaIssue, 'pull_request'>): boolean {
  return raw.pull_request == null
}

function mapGiteaIssueLabel(label: { name?: string | null } | string): string | null {
  const name = typeof label === 'string' ? label : label.name
  const trimmed = name?.trim()
  return trimmed ? trimmed : null
}

function mapGiteaIssueAssignee(
  assignee: { login?: string | null; username?: string | null; full_name?: string | null } | string
): string | null {
  // Why: same login fallback as client.ts getGiteaAuthStatus — Gitea user
  // payloads vary by endpoint (login vs username vs full_name).
  const login =
    typeof assignee === 'string'
      ? assignee
      : (assignee.login ?? assignee.username ?? assignee.full_name)
  const trimmed = login?.trim()
  return trimmed ? trimmed : null
}

function mapGiteaIssueMilestone(
  milestone: { title?: string | null } | string | null | undefined
): string | null {
  if (milestone == null) {
    return null
  }
  const title = typeof milestone === 'string' ? milestone : milestone.title
  const trimmed = title?.trim()
  return trimmed ? trimmed : null
}

export function mapGiteaIssue(raw: RawGiteaIssue): GiteaIssueInfo {
  return {
    number: raw.number ?? 0,
    title: raw.title ?? '',
    body: raw.body ?? '',
    state: mapGiteaIssueState(raw),
    labels: (raw.labels ?? []).flatMap((label) => {
      const mapped = mapGiteaIssueLabel(label)
      return mapped ? [mapped] : []
    }),
    assignees: (raw.assignees ?? []).flatMap((assignee) => {
      const mapped = mapGiteaIssueAssignee(assignee)
      return mapped ? [mapped] : []
    }),
    milestone: mapGiteaIssueMilestone(raw.milestone),
    commentsCount: typeof raw.comments === 'number' ? raw.comments : 0,
    url: raw.html_url ?? '',
    updatedAt: raw.updated_at ?? ''
  }
}
