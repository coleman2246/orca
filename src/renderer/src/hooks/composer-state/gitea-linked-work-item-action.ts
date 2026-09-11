import { useCallback } from 'react'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import { getLinkedWorkItemSuggestedName, getLinkedWorkItemWorkspaceName } from '@/lib/new-workspace'
import { shouldApplyWorkspaceSourceAutoName } from '../../../../shared/new-workspace/workspace-source'
import type { ComposerModel } from './composer-model'

type ApplyLinkedGiteaWorkItemInput = Pick<
  ComposerModel,
  | 'branchAutoNameRef'
  | 'lastAutoNameRef'
  | 'name'
  | 'setBranchNameOverride'
  | 'setBranchNameOverridePreservesNameEdits'
  | 'setLinkedGitLabIssue'
  | 'setLinkedGitLabMR'
  | 'setLinkedIssue'
  | 'setLinkedPR'
  | 'setLinkedTaskSourceContext'
  | 'setLinkedWorkItem'
  | 'setName'
  | 'smartGitHubPrStartPointSelectionRef'
>

/**
 * Gitea parallel of `applyLinkedGitLabWorkItem`.
 *
 * Why: Gitea items are issues only in v1, so there is no MR/PR slot to manage
 * and no base resolution; every other provider slot is cleared so a stale
 * hidden field can't win later. Lives in its own module to keep
 * `source-identity-actions.ts` inside its line budget.
 */
export function useApplyLinkedGiteaWorkItem(input: ApplyLinkedGiteaWorkItemInput) {
  const {
    branchAutoNameRef,
    lastAutoNameRef,
    name,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    smartGitHubPrStartPointSelectionRef
  } = input
  return useCallback(
    (item: GiteaWorkItem): void => {
      smartGitHubPrStartPointSelectionRef.current = null
      setLinkedGitLabIssue(null)
      setLinkedGitLabMR(null)
      setLinkedIssue('')
      setLinkedPR(null)
      setLinkedTaskSourceContext(null)
      setLinkedWorkItem({
        type: item.type,
        provider: 'gitea',
        number: item.number,
        title: item.title,
        url: item.url
      })
      const titleName = getLinkedWorkItemWorkspaceName({
        type: item.type,
        provider: 'gitea',
        number: item.number,
        title: item.title
      })
      const nextName = titleName?.seedName ?? getLinkedWorkItemSuggestedName(item)
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
      setBranchNameOverride(undefined)
      setBranchNameOverridePreservesNameEdits(false)
      branchAutoNameRef.current = ''
    },
    [
      name,
      branchAutoNameRef,
      lastAutoNameRef,
      setBranchNameOverride,
      setBranchNameOverridePreservesNameEdits,
      setLinkedGitLabIssue,
      setLinkedGitLabMR,
      setLinkedIssue,
      setLinkedPR,
      setLinkedTaskSourceContext,
      setLinkedWorkItem,
      setName,
      smartGitHubPrStartPointSelectionRef
    ]
  )
}
