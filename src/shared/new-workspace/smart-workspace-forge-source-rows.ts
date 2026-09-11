import type { GitLabWorkItem } from '../gitlab-types'
import type { GiteaWorkItem } from '../gitea-types'

export type ForgeSourceRow =
  | { kind: 'gitlab'; value: string; item: GitLabWorkItem }
  | { kind: 'gitea'; value: string; item: GiteaWorkItem }

/**
 * Title-match rows for the self-hosted forges (GitLab, Gitea).
 *
 * Why: both providers key their cmdk row value on the same
 * `<provider>-<repoId>-<type>-<number>` shape, and GitHub does not (it has its
 * own row builder). Keeping the pair here holds
 * `smart-workspace-source-results.ts` inside its line budget without a lint
 * bypass. GitLab answers in its own composer mode as well as smart mode; Gitea
 * has no dedicated mode in v1, so it lists in smart mode only.
 */
export function buildForgeSourceRows({
  gitlabAvailable,
  gitlabItems,
  giteaAvailable,
  giteaItems,
  mode
}: {
  gitlabAvailable: boolean
  gitlabItems: GitLabWorkItem[]
  giteaAvailable: boolean
  giteaItems: GiteaWorkItem[]
  mode: string
}): ForgeSourceRow[] {
  const rows: ForgeSourceRow[] = []
  if (gitlabAvailable && (mode === 'smart' || mode === 'gitlab')) {
    for (const item of gitlabItems) {
      rows.push({
        kind: 'gitlab',
        value: `gitlab-${item.repoId}-${item.type}-${item.number}`,
        item
      })
    }
  }
  if (giteaAvailable && mode === 'smart') {
    for (const item of giteaItems) {
      rows.push({ kind: 'gitea', value: `gitea-${item.repoId}-${item.type}-${item.number}`, item })
    }
  }
  return rows
}
