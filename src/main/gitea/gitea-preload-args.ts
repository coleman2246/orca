export type GiteaIssueListState = 'open' | 'closed' | 'all'

export function normalizeGiteaPositiveInteger(
  value: unknown,
  fallback: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(Math.max(1, Math.trunc(value)), max)
}

// Why: the IPC boundary speaks GitLab-style 'opened' (shared Tasks pager)
// while the Gitea REST client takes 'open' — accept both spellings here so
// callers don't need a separate code path.
export function normalizeGiteaIssueListState(value: unknown): GiteaIssueListState {
  if (value === 'closed') {
    return 'closed'
  }
  if (value === 'all') {
    return 'all'
  }
  return 'open'
}

export function normalizeGiteaIssueUpdateState(value: unknown): 'open' | 'closed' | undefined {
  if (value === 'closed') {
    return 'closed'
  }
  if (value === 'open' || value === 'opened') {
    return 'open'
  }
  return undefined
}

export function normalizeGiteaIssueAssignee(value: unknown): '@me' | undefined {
  // Why: the renderer only exposes "Assigned to me"; accepting arbitrary
  // values would turn the preload/IPC boundary into a generic search surface.
  return value === '@me' ? '@me' : undefined
}

export function normalizeGiteaIssueListArgs(args: {
  state?: unknown
  assignee?: unknown
  limit?: unknown
  page?: unknown
}): {
  state: GiteaIssueListState
  assignee: '@me' | undefined
  limit: number
  page: number
} {
  return {
    state: normalizeGiteaIssueListState(args.state),
    assignee: normalizeGiteaIssueAssignee(args.assignee),
    limit: normalizeGiteaPositiveInteger(args.limit, 20, 100),
    // Why: Gitea pages are 1-based; the Tasks pager maps its 0-based UI pages onto this.
    page: normalizeGiteaPositiveInteger(args.page, 1, 10_000)
  }
}
