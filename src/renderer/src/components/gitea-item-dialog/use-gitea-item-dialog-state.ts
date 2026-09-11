import { useCallback, useState } from 'react'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import type { GiteaWorkItemDetails } from './gitea-item-dialog-types'

export function useGiteaItemDialogState() {
  const [details, setDetails] = useState<GiteaWorkItemDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  // Why: optimistic flip for close/reopen — the chip moves before the IPC
  // round-trip lands and rolls back if the mutation fails.
  const [optimisticState, setOptimisticState] = useState<GiteaWorkItem['state'] | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [assigneeDraft, setAssigneeDraft] = useState('')
  const [milestoneDraft, setMilestoneDraft] = useState('')
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [actionInFlight, setActionInFlight] = useState<'close' | 'reopen' | null>(null)
  const mountedRef = useMountedRef()
  const updateCommentDraft = useCallback((value: string): void => {
    setCommentDraft(value)
  }, [])

  return {
    actionInFlight,
    assigneeDraft,
    bodyDraft,
    commentDraft,
    commentSubmitting,
    details,
    detailsSaving,
    editingDetails,
    error,
    loading,
    milestoneDraft,
    mountedRef,
    optimisticState,
    refreshNonce,
    labelDraft,
    titleDraft,
    setActionInFlight,
    setAssigneeDraft,
    setBodyDraft,
    setCommentDraft,
    setCommentSubmitting,
    setDetails,
    setDetailsSaving,
    setEditingDetails,
    setError,
    setLabelDraft,
    setLoading,
    setMilestoneDraft,
    setOptimisticState,
    setRefreshNonce,
    setTitleDraft,
    updateCommentDraft
  }
}

export type GiteaItemDialogState = ReturnType<typeof useGiteaItemDialogState>
