import { useMemo } from 'react'
import { parseGitHubIssueOrPRLink } from '@/lib/github-links'
import { parseGitLabIssueOrMRLink } from '@/lib/gitlab-links'
import { parseGiteaIssueOrPullLink } from '@/lib/gitea-links'
import { isSmartWorkspaceSourceQueryWithinLimit } from './smart-workspace-source-results'

/**
 * Parse a pasted forge URL out of the composer input, one intent per provider.
 *
 * Why: a full task URL is unambiguous, so each provider arm needs its own
 * parsed intent before rows are built. GitHub and GitLab also answer inside
 * their dedicated composer modes; Gitea has no dedicated mode in v1, so it
 * resolves in smart mode only.
 */
export function useSmartWorkspaceForgeUrlIntents(value: string, mode: string) {
  const githubUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'github')
        ? parseGitHubIssueOrPRLink(value)
        : null,
    [mode, value]
  )
  const gitlabUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'gitlab')
        ? parseGitLabIssueOrMRLink(value)
        : null,
    [mode, value]
  )
  const giteaUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && mode === 'smart'
        ? parseGiteaIssueOrPullLink(value)
        : null,
    [mode, value]
  )
  return { githubUrlIntent, gitlabUrlIntent, giteaUrlIntent }
}
