import { useMemo } from 'react'
import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import GiteaItemDialog from '@/components/gitea-item-dialog/GiteaItemDialog'
import { getTaskPageRepoSourceContext } from '../../task-page-source-context'

export function TaskPageGiteaDialog({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element | null {
  const { giteaDialogItem, setGiteaDialogItem, setGiteaRefreshNonce, selectedRepos, primaryRepo } =
    model
  const giteaDialogRepo = useMemo(
    () =>
      giteaDialogItem
        ? (selectedRepos.find((r) => r.id === giteaDialogItem.repoId) ?? primaryRepo)
        : null,
    [giteaDialogItem, primaryRepo, selectedRepos]
  )
  const giteaDialogSourceContext = useMemo(() => {
    if (!giteaDialogItem) {
      return null
    }
    // Why: siteId may be URL-shaped (baseUrl fallback when anonymous/env) —
    // forward it verbatim as the acting site, never parse it.
    return getTaskPageRepoSourceContext(giteaDialogRepo, 'gitea', undefined, {
      siteId: giteaDialogItem.siteId
    })
  }, [giteaDialogItem, giteaDialogRepo])
  return (
    <GiteaItemDialog
      item={giteaDialogItem}
      // Why: repoPath comes from the clicked item's own repo, not primaryRepo — the Gitea fetch is multi-repo.
      repoPath={giteaDialogRepo?.path ?? null}
      repoId={giteaDialogItem?.repoId ?? null}
      sourceContext={giteaDialogSourceContext}
      onMutated={() => setGiteaRefreshNonce((n) => n + 1)}
      onClose={() => setGiteaDialogItem(null)}
    />
  )
}
