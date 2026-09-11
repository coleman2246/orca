import type { GiteaWorkItem } from '../../shared/gitea-types'
import type { Repo } from '../../shared/repo-types'
import type { TaskSourceContext } from '../../shared/task-source-context'
import { buildTaskSourceContextFromRepo } from '../../shared/task-source-context'
import { getGiteaIssue } from '../gitea/issues-client'
import { getGiteaRepoRef } from '../gitea/repository-ref'
import { getGiteaSiteForRepo, resolveGiteaAuth } from '../gitea/site-credential-store'

type LocalGitArgs = [] | [{ wslDistro?: string }]

export type RuntimeGiteaQueryCommandsDeps = {
  resolveRepo: (selector: string) => Promise<Repo>
  getLocalGitArgs: (repo: Repo) => LocalGitArgs
}

export type GiteaRepoIssueResult = {
  item: GiteaWorkItem
  sourceContext: TaskSourceContext | null
} | null

export class RuntimeGiteaQueryCommands {
  constructor(private readonly deps: RuntimeGiteaQueryCommandsDeps) {}

  /**
   * Resolve one Gitea issue for a repo, as the work item the composer links.
   *
   * Why this exists at all: the Tasks drawer reaches Gitea over Electron IPC,
   * which the CLI has no access to. `orca worktree create --gitea-issue <n>`
   * needs the issue's title and canonical URL to build the same
   * `linkedWorkItem` the composer builds, and the site token that authorizes
   * the lookup lives in the main process. Null means the checkout has no
   * parseable Gitea remote, or the issue does not exist — the caller turns
   * that into its own message rather than a stack trace.
   */
  async getGiteaRepoIssue(repoSelector: string, number: number): Promise<GiteaRepoIssueResult> {
    const repo = await this.deps.resolveRepo(repoSelector)
    const ref = await getGiteaRepoRef(
      repo.path,
      repo.connectionId ?? null,
      this.deps.getLocalGitArgs(repo)[0] ?? {}
    )
    if (!ref) {
      return null
    }
    const site = getGiteaSiteForRepo(ref)
    const resolved = resolveGiteaAuth(ref)
    const callSite = site ?? { id: resolved.baseUrl, baseUrl: resolved.baseUrl }
    const issue = await getGiteaIssue({ site: callSite, token: resolved.token }, ref, number)
    if (!issue) {
      return null
    }
    const item: GiteaWorkItem = {
      id: `gitea-issue-${repo.id}-${issue.number}`,
      type: 'issue',
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.url,
      labels: issue.labels,
      assignees: issue.assignees,
      updatedAt: issue.updatedAt,
      author: null,
      repoId: repo.id,
      siteId: callSite.id
    }
    return {
      item,
      sourceContext: buildTaskSourceContextFromRepo({
        provider: 'gitea',
        projectId: repo.id,
        repo,
        providerIdentity: { provider: 'gitea', siteId: callSite.id, baseUrl: callSite.baseUrl }
      })
    }
  }
}
