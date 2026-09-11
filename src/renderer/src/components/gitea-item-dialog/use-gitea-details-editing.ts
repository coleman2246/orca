import { useCallback } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { GiteaIssueUpdatePatch, GiteaWorkItem } from '../../../../shared/gitea-types'
import {
  formatGiteaLabelDraft,
  normalizeGiteaLabels,
  parseGiteaLabelDraft,
  showGiteaMutationError
} from './gitea-item-dialog-parts'
import type { GiteaDialogRepoSelector } from './gitea-item-dialog-types'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'

export function useGiteaDetailsEditing(
  item: GiteaWorkItem | null,
  repoSelector: GiteaDialogRepoSelector | null,
  state: GiteaItemDialogState,
  handleRefresh: () => void,
  onMutated?: () => void
) {
  const {
    assigneeDraft,
    bodyDraft,
    details,
    labelDraft,
    milestoneDraft,
    mountedRef,
    setAssigneeDraft,
    setBodyDraft,
    setDetails,
    setDetailsSaving,
    setEditingDetails,
    setLabelDraft,
    setMilestoneDraft,
    setTitleDraft,
    titleDraft
  } = state

  const handleStartDetailsEdit = useCallback((): void => {
    if (!item || !details) {
      return
    }
    setTitleDraft(details.issue.title || item.title)
    setBodyDraft(details.issue.body)
    setLabelDraft(formatGiteaLabelDraft(details.issue.labels ?? item.labels))
    setAssigneeDraft(formatGiteaLabelDraft(details.issue.assignees ?? []))
    setMilestoneDraft(details.issue.milestone ?? '')
    setEditingDetails(true)
  }, [
    details,
    item,
    setAssigneeDraft,
    setBodyDraft,
    setEditingDetails,
    setLabelDraft,
    setMilestoneDraft,
    setTitleDraft
  ])

  const handleCancelDetailsEdit = useCallback((): void => {
    setEditingDetails(false)
    setTitleDraft('')
    setBodyDraft('')
    setLabelDraft('')
    setAssigneeDraft('')
    setMilestoneDraft('')
  }, [
    setAssigneeDraft,
    setBodyDraft,
    setEditingDetails,
    setLabelDraft,
    setMilestoneDraft,
    setTitleDraft
  ])

  const handleSaveDetails = useCallback(async (): Promise<void> => {
    if (!item || !details || !repoSelector) {
      return
    }
    const currentTitle = details.issue.title || item.title
    const currentBody = details.issue.body
    const currentLabels = normalizeGiteaLabels(details.issue.labels ?? item.labels)
    const currentAssignees = normalizeGiteaLabels(details.issue.assignees ?? [])
    const currentMilestone = details.issue.milestone ?? ''
    const nextTitle = titleDraft.trim()
    const nextBody = bodyDraft
    const nextLabels = parseGiteaLabelDraft(labelDraft)
    const nextAssignees = normalizeGiteaLabels(assigneeDraft.split(','))
    const nextMilestone = milestoneDraft.trim()
    if (!nextTitle) {
      toast.error(translate('auto.components.GiteaItemDialog.2d7f9e4b6c', 'Title is required.'))
      return
    }
    const updates: GiteaIssueUpdatePatch = {}
    if (nextTitle !== currentTitle) {
      updates.title = nextTitle
    }
    if (nextBody !== currentBody) {
      updates.body = nextBody
    }
    if (JSON.stringify(nextLabels) !== JSON.stringify(currentLabels)) {
      updates.labels = nextLabels
    }
    if (JSON.stringify(nextAssignees) !== JSON.stringify(currentAssignees)) {
      updates.assignees = nextAssignees
    }
    if (nextMilestone !== currentMilestone && nextMilestone) {
      updates.milestone = nextMilestone
    }
    if (Object.keys(updates).length === 0) {
      handleCancelDetailsEdit()
      return
    }
    setDetailsSaving(true)
    try {
      const res = await window.api.gitea.updateIssue({
        ...repoSelector,
        number: item.number,
        updates
      })
      if (res?.ok === false) {
        if (mountedRef.current) {
          toast.error(res.error)
        }
        return
      }
      if (mountedRef.current) {
        setDetails((current) => {
          // Why: the patch type allows numeric milestone ids, but the dialog
          // only ever edits the display name — normalize back to string.
          const nextMilestone =
            typeof updates.milestone === 'number'
              ? String(updates.milestone)
              : (updates.milestone ?? current?.issue.milestone ?? null)
          return current
            ? {
                ...current,
                issue: {
                  ...current.issue,
                  title: updates.title ?? current.issue.title,
                  body: updates.body ?? current.issue.body,
                  labels: updates.labels ?? current.issue.labels,
                  assignees: updates.assignees ?? current.issue.assignees,
                  milestone: nextMilestone
                }
              }
            : current
        })
        handleCancelDetailsEdit()
        onMutated?.()
        handleRefresh()
      }
    } catch (error) {
      if (mountedRef.current) {
        showGiteaMutationError(error)
      }
    } finally {
      if (mountedRef.current) {
        setDetailsSaving(false)
      }
    }
  }, [
    assigneeDraft,
    bodyDraft,
    details,
    handleCancelDetailsEdit,
    handleRefresh,
    item,
    labelDraft,
    milestoneDraft,
    mountedRef,
    onMutated,
    repoSelector,
    setDetails,
    setDetailsSaving,
    titleDraft
  ])

  return { handleCancelDetailsEdit, handleSaveDetails, handleStartDetailsEdit }
}

export type GiteaDetailsEditing = ReturnType<typeof useGiteaDetailsEditing>
