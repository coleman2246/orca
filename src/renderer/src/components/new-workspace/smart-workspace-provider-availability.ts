import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'

export function canUseGitLabSmartSource({
  localGitlabAvailable,
  repoBackedSourcesDisabled,
  sourceHostId
}: {
  localGitlabAvailable: boolean
  repoBackedSourcesDisabled: boolean
  sourceHostId: ExecutionHostId | null | undefined
}): boolean {
  if (repoBackedSourcesDisabled) {
    return false
  }
  const parsedHost = parseExecutionHostId(sourceHostId)
  return parsedHost?.kind === 'ssh' || parsedHost?.kind === 'runtime' || localGitlabAvailable
}

export function canUseGiteaSmartSource({
  repoBackedSourcesDisabled,
  sourceHostId
}: {
  repoBackedSourcesDisabled: boolean
  sourceHostId: ExecutionHostId | null | undefined
}): boolean {
  if (repoBackedSourcesDisabled) {
    return false
  }
  // Why: Gitea lookups run over IPC in main with per-repo site resolution —
  // there is no CLI install gate like glab, so any repo target with a
  // resolvable execution host can serve them.
  return parseExecutionHostId(sourceHostId) !== null
}
