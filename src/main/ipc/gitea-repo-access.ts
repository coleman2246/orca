import type { Repo } from '../../shared/repo-types'
import { getRepoExecutionHostId } from '../../shared/execution-host'
import type { TaskSourceContext } from '../../shared/task-source-context'
import type { Store } from '../persistence'

export type GiteaRepoSelectorArgs = {
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  repoOwnerExecutionHostId?: string
  giteaSiteId?: string | null
}

export { localGitOptionArgs, repoConnectionId } from './gitlab-repo-access'
import { assertRegisteredRepo as assertSharedRegisteredRepo } from './gitlab-repo-access'

// Why: reuse the GitLab registered-repo guard (filesystem-auth boundary —
// main-process handlers must never operate on a path the user hasn't
// explicitly registered), then add the Gitea source-host check the shared
// helper skips for non-GitLab providers.
export function assertRegisteredRepo(args: GiteaRepoSelectorArgs, store: Store): Repo {
  const repo = assertSharedRegisteredRepo(args, store)
  if (
    args.sourceContext?.provider === 'gitea' &&
    args.sourceContext.hostId !== getRepoExecutionHostId(repo)
  ) {
    throw new Error('Access denied: Gitea source host does not match repository host')
  }
  return repo
}

// Why: Tasks 5–7 stamp and forward the acting site (multi-host setups can
// hold several Gitea sites). Explicit arg wins; otherwise fall back to the
// site recorded on the Gitea task-source context's provider identity.
export function giteaSiteIdFromArgs(args: GiteaRepoSelectorArgs): string | null {
  const explicit = args.giteaSiteId?.trim()
  if (explicit) {
    return explicit
  }
  const context = args.sourceContext
  if (context?.provider === 'gitea' && context.providerIdentity?.provider === 'gitea') {
    return context.providerIdentity.siteId?.trim() || null
  }
  return null
}
