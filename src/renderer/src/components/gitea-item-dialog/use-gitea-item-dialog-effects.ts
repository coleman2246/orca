import { useEffect } from 'react'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import type { GiteaDialogRepoSelector } from './gitea-item-dialog-types'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'

export function useGiteaItemDetailsEffect(
  item: GiteaWorkItem | null,
  repoSelector: GiteaDialogRepoSelector | null,
  state: GiteaItemDialogState
): void {
  const { refreshNonce, setDetails, setEditingDetails, setError, setLoading } = state
  useEffect(() => {
    if (!item || !repoSelector) {
      setDetails(null)
      setLoading(false)
      setError(null)
      setEditingDetails(false)
      return
    }
    let stale = false
    setLoading(true)
    setError(null)
    void window.api.gitea
      .workItemDetails({ ...repoSelector, number: item.number })
      .then((data) => {
        if (stale) {
          return
        }
        if (!data) {
          // Why: gitea:workItemDetails returns null for both a wrong remote and a missing issue — the dialog cannot tell them apart.
          setError('Issue not found.')
          return
        }
        setDetails(data)
      })
      .catch((err) => {
        if (!stale) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!stale) {
          setLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [item, refreshNonce, repoSelector, setDetails, setEditingDetails, setError, setLoading])
}

export function useGiteaItemScopeResetEffect(
  itemId: string | null,
  state: GiteaItemDialogState
): void {
  const {
    setAssigneeDraft,
    setBodyDraft,
    setCommentDraft,
    setEditingDetails,
    setLabelDraft,
    setMilestoneDraft,
    setOptimisticState,
    setTitleDraft
  } = state
  // Why: clear item-scoped dialog state when the sheet target changes so a
  // draft can never post to the wrong issue.
  useEffect(() => {
    setEditingDetails(false)
    setTitleDraft('')
    setBodyDraft('')
    setLabelDraft('')
    setAssigneeDraft('')
    setMilestoneDraft('')
    setCommentDraft('')
    setOptimisticState(null)
  }, [
    itemId,
    setAssigneeDraft,
    setBodyDraft,
    setCommentDraft,
    setEditingDetails,
    setLabelDraft,
    setMilestoneDraft,
    setOptimisticState,
    setTitleDraft
  ])
}
