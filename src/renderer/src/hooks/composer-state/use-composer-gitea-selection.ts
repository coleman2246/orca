import type { ComposerTargetState } from './composer-target-state-contract'
import type { useSourceIdentityActions } from './source-identity-actions'
import { useGiteaProviderSelection } from './gitea-provider-selection'

/**
 * Wiring-only wrapper around `useGiteaProviderSelection`.
 *
 * Why: the selection hook's input is a wide `Pick` of the composer model, and
 * spelling every field at the call site pushed `composer-source-state.ts` past
 * its line budget. Nothing here decides anything — it only maps target state
 * onto the hook's contract.
 */
export function useComposerGiteaSelection(
  target: ComposerTargetState,
  sourceIdentityActions: ReturnType<typeof useSourceIdentityActions>
) {
  return useGiteaProviderSelection({
    applyLinkedGiteaWorkItem: sourceIdentityActions.applyLinkedGiteaWorkItem,
    branchAutoNameRef: target.asyncComposerState.branchAutoNameRef,
    isProjectGroupTarget: target.runtimeTargetSelection.isProjectGroupTarget,
    lastAutoNameRef: target.asyncComposerState.lastAutoNameRef,
    name: target.sourceContextState.name,
    setBranchNameOverride: target.workspaceIdentityState.setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits:
      target.workspaceIdentityState.setBranchNameOverridePreservesNameEdits,
    setForkPushWarning: target.workspaceIdentityState.setForkPushWarning,
    setLinkedGitLabIssue: target.workspaceIdentityState.setLinkedGitLabIssue,
    setLinkedGitLabMR: target.workspaceIdentityState.setLinkedGitLabMR,
    setLinkedIssue: target.workspaceIdentityState.setLinkedIssue,
    setLinkedPR: target.workspaceIdentityState.setLinkedPR,
    setLinkedTaskSourceContext: target.sourceContextState.setLinkedTaskSourceContext,
    setLinkedWorkItem: target.sourceContextState.setLinkedWorkItem,
    setName: target.sourceContextState.setName,
    setStartFromResetHint: target.workspaceIdentityState.setStartFromResetHint
  })
}
