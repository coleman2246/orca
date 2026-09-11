/* Why: Gitea counterpart to GitLabItemDialog. Side sheet with three
   tabs (Overview / Conversation / Meta) and footer actions —
   close/reopen plus a top-level comment composer. */
import { useCallback, useMemo } from 'react'
import { GiteaItemDialogView } from './gitea-item-dialog-view'
import type { GiteaDialogRepoSelector, GiteaItemDialogProps } from './gitea-item-dialog-types'
import { useGiteaDetailsEditing } from './use-gitea-details-editing'
import {
  useGiteaItemDetailsEffect,
  useGiteaItemScopeResetEffect
} from './use-gitea-item-dialog-effects'
import { useGiteaItemDialogState } from './use-gitea-item-dialog-state'
import { useGiteaPrimaryActions } from './use-gitea-primary-actions'

export default function GiteaItemDialog({
  item,
  repoPath,
  repoId,
  sourceContext,
  onClose,
  onCreateWorkspace,
  onMutated
}: GiteaItemDialogProps) {
  const itemId = item?.id ?? null
  const state = useGiteaItemDialogState()
  const { setRefreshNonce } = state
  const repoSelector = useMemo<GiteaDialogRepoSelector | null>(() => {
    if (!repoPath || !item) {
      return null
    }
    return {
      repoPath,
      ...(repoId ? { repoId } : {}),
      ...(sourceContext ? { sourceContext } : {}),
      // Why: siteId may be URL-shaped (baseUrl fallback when
      // anonymous/env) — forward it verbatim for multi-host stamping, never parse it.
      ...(item.siteId ? { giteaSiteId: item.siteId } : {})
    }
  }, [item, repoId, repoPath, sourceContext])
  const updateCommentDraft = state.updateCommentDraft

  useGiteaItemDetailsEffect(item, repoSelector, state)
  useGiteaItemScopeResetEffect(itemId, state)

  const handleRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
  }, [setRefreshNonce])
  const detailsEditing = useGiteaDetailsEditing(item, repoSelector, state, handleRefresh, onMutated)
  const primaryActions = useGiteaPrimaryActions(item, repoSelector, state, handleRefresh, onMutated)

  return (
    <GiteaItemDialogView
      item={item}
      onClose={onClose}
      onCreateWorkspace={onCreateWorkspace}
      state={state}
      detailsEditing={detailsEditing}
      primaryActions={primaryActions}
      handleRefresh={handleRefresh}
      updateCommentDraft={updateCommentDraft}
    />
  )
}
