import type { ComposerModel } from './composer-model'

type GiteaProviderSelectionInput = Pick<
  ComposerModel,
  | 'applyLinkedGiteaWorkItem'
  | 'branchAutoNameRef'
  | 'isProjectGroupTarget'
  | 'lastAutoNameRef'
  | 'name'
  | 'setBranchNameOverride'
  | 'setBranchNameOverridePreservesNameEdits'
  | 'setForkPushWarning'
  | 'setLinkedGitLabIssue'
  | 'setLinkedGitLabMR'
  | 'setLinkedIssue'
  | 'setLinkedPR'
  | 'setLinkedTaskSourceContext'
  | 'setLinkedWorkItem'
  | 'setName'
  | 'setStartFromResetHint'
>

import { useCallback } from 'react'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import {
  toGiteaLinkedWorkItem,
  getLinkedItemDisplayName
} from '@/components/sidebar/folder-workspace-composer-helpers'
import { shouldApplyWorkspaceSourceAutoName } from '../../../../shared/new-workspace/workspace-source'

export function useGiteaProviderSelection(input: GiteaProviderSelectionInput) {
  const {
    applyLinkedGiteaWorkItem,
    branchAutoNameRef,
    isProjectGroupTarget,
    lastAutoNameRef,
    name,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    setStartFromResetHint
  } = input

  // Why: Gitea parallel of handleSmartGitLabItemSelect — Gitea items are
  // issues only in v1, so there is no MR base to resolve via
  // worktrees:resolveMrBase; issues short-circuit straight to the linked
  // item, like the GitLab issue path.
  const handleSmartGiteaItemSelect = useCallback(
    (item: GiteaWorkItem): void => {
      if (isProjectGroupTarget) {
        const linkedItem = toGiteaLinkedWorkItem(item)
        setLinkedGitLabIssue(null)
        setLinkedGitLabMR(null)
        setLinkedIssue('')
        setLinkedPR(null)
        setLinkedTaskSourceContext(null)
        setLinkedWorkItem(linkedItem)
        const nextName = getLinkedItemDisplayName(linkedItem)
        if (
          nextName &&
          shouldApplyWorkspaceSourceAutoName({
            currentName: name,
            lastAutoName: lastAutoNameRef.current
          })
        ) {
          setName(nextName)
          lastAutoNameRef.current = nextName
        }
        return
      }
      applyLinkedGiteaWorkItem(item)
      setStartFromResetHint(null)
      setBranchNameOverride(undefined)
      setBranchNameOverridePreservesNameEdits(false)
      setForkPushWarning(null)
      branchAutoNameRef.current = ''
    },
    [
      applyLinkedGiteaWorkItem,
      isProjectGroupTarget,
      name,
      branchAutoNameRef,
      lastAutoNameRef,
      setBranchNameOverride,
      setBranchNameOverridePreservesNameEdits,
      setForkPushWarning,
      setLinkedGitLabIssue,
      setLinkedGitLabMR,
      setLinkedIssue,
      setLinkedPR,
      setLinkedTaskSourceContext,
      setLinkedWorkItem,
      setName,
      setStartFromResetHint
    ]
  )

  return {
    handleSmartGiteaItemSelect
  }
}
