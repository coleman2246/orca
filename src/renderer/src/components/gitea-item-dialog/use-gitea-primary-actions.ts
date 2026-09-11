import { useCallback } from 'react'
import { toast } from 'sonner'
import { getCommentBodySubmitState } from '@/lib/comment-body-submit-state'
import { translate } from '@/i18n/i18n'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import { showGiteaMutationError } from './gitea-item-dialog-parts'
import type { GiteaDialogRepoSelector } from './gitea-item-dialog-types'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'

export function useGiteaPrimaryActions(
  item: GiteaWorkItem | null,
  repoSelector: GiteaDialogRepoSelector | null,
  state: GiteaItemDialogState,
  handleRefresh: () => void,
  onMutated?: () => void
) {
  const {
    commentDraft,
    mountedRef,
    setActionInFlight,
    setCommentDraft,
    setCommentSubmitting,
    setDetails,
    setOptimisticState
  } = state

  const handleSetState = useCallback(
    async (next: 'open' | 'closed', action: 'close' | 'reopen'): Promise<void> => {
      if (!item || !repoSelector) {
        return
      }
      setActionInFlight(action)
      setOptimisticState(next)
      try {
        const res = await window.api.gitea.updateIssue({
          ...repoSelector,
          number: item.number,
          updates: { state: next }
        })
        if (res?.ok === false) {
          if (mountedRef.current) {
            setOptimisticState(null)
            toast.error(res.error)
          }
          return
        }
        if (mountedRef.current) {
          // Why: the mutation response carries no payload — patch the known
          // state optimistically and let the refresh confirm it canonically.
          setDetails((current) =>
            current ? { ...current, issue: { ...current.issue, state: next } } : current
          )
          setOptimisticState(null)
          onMutated?.()
          handleRefresh()
        }
      } catch (error) {
        if (mountedRef.current) {
          setOptimisticState(null)
          showGiteaMutationError(error)
        }
      } finally {
        if (mountedRef.current) {
          setActionInFlight(null)
        }
      }
    },
    [
      handleRefresh,
      item,
      mountedRef,
      onMutated,
      repoSelector,
      setActionInFlight,
      setDetails,
      setOptimisticState
    ]
  )

  const handleClose = useCallback(
    (): Promise<void> => handleSetState('closed', 'close'),
    [handleSetState]
  )
  const handleReopen = useCallback(
    (): Promise<void> => handleSetState('open', 'reopen'),
    [handleSetState]
  )

  const handleSubmitComment = useCallback(async (): Promise<void> => {
    const bodyState = getCommentBodySubmitState(commentDraft)
    if (bodyState.status === 'empty' || !item || !repoSelector) {
      return
    }
    if (bodyState.status === 'too-large-leading-whitespace') {
      toast.error(
        translate(
          'auto.components.GiteaItemDialog.8b4e2c0f1a',
          'Comment is too large to submit safely.'
        )
      )
      return
    }
    setCommentSubmitting(true)
    try {
      const res = await window.api.gitea.addComment({
        ...repoSelector,
        number: item.number,
        body: bodyState.body
      })
      if (res?.ok === false) {
        if (mountedRef.current) {
          toast.error(res.error)
        }
        return
      }
      if (mountedRef.current) {
        setCommentDraft('')
        onMutated?.()
        handleRefresh()
      }
    } catch (error) {
      if (mountedRef.current) {
        showGiteaMutationError(error)
      }
    } finally {
      if (mountedRef.current) {
        setCommentSubmitting(false)
      }
    }
  }, [
    commentDraft,
    handleRefresh,
    item,
    mountedRef,
    onMutated,
    repoSelector,
    setCommentDraft,
    setCommentSubmitting
  ])

  return { handleClose, handleReopen, handleSubmitComment }
}

export type GiteaPrimaryActions = ReturnType<typeof useGiteaPrimaryActions>
