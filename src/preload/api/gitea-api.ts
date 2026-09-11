import type { TaskSourceContext } from '../../shared/task-source-context'
import type { ClassifiedError } from '../../shared/classified-error'
import type {
  GiteaConnectionStatus,
  GiteaIssueComment,
  GiteaIssueInfo,
  GiteaIssueUpdatePatch,
  GiteaWorkItem
} from '../../shared/gitea-types'

export type GiteaRepoSelectorArgs = {
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  /** Desktop IPC-only owner guard; web adapters remove it before runtime RPC. */
  repoOwnerExecutionHostId?: string
  giteaSiteId?: string | null
}

// ── Gitea — parallel to gl, issue surface only in v1 ────────
// Shapes mirror gl.* except where Gitea's API differs (open/closed states,
// `gitea:addComment` channel name, per-site `siteId` on work items).
export type GiteaApi = {
  issue: (args: GiteaRepoSelectorArgs & { number: number }) => Promise<GiteaIssueInfo | null>
  listIssues: (
    args: GiteaRepoSelectorArgs & {
      state?: 'opened' | 'closed' | 'all'
      limit?: number
      page?: number
    }
  ) => Promise<{
    items: GiteaWorkItem[]
    totalPages: number
    error?: ClassifiedError
  }>
  createIssue: (
    args: GiteaRepoSelectorArgs & {
      title: string
      body?: string
    }
  ) => Promise<{ ok: true; number: number; url: string } | { ok: false; error: string }>
  updateIssue: (
    args: GiteaRepoSelectorArgs & {
      number: number
      updates: GiteaIssueUpdatePatch
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  addComment: (
    args: GiteaRepoSelectorArgs & {
      number: number
      body: string
    }
  ) => Promise<{ ok: true; comment: GiteaIssueComment } | { ok: false; error: string }>
  /** Connection status plus the authSource env-deprecation hint. */
  authStatus: (args: GiteaRepoSelectorArgs) => Promise<GiteaConnectionStatus>
  /** Aggregated dialog payload — issue body plus comments. */
  workItemDetails: (
    args: GiteaRepoSelectorArgs & {
      number: number
    }
  ) => Promise<{ issue: GiteaIssueInfo; comments: GiteaIssueComment[] } | null>
}
