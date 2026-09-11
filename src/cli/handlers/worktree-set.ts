import type { RuntimeWorktreeRecord } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { formatWorktreeShow, printResult } from '../format'
import { getOptionalNullableNumberFlag, getOptionalStringFlag } from '../flags'
import { getOptionalWorktreeSelector, getRequiredWorktreeSelector } from '../selectors'
import { RuntimeClientError } from '../runtime-client'
import { getOptionalLinearIssueLinkFlag } from './worktree-linear-issue-link'
import {
  getOptionalGiteaIssueFlag,
  resolveGiteaIssueLinkForWorktree
} from './worktree-gitea-issue-link'

function assertParentWorktreeFlagsCompatible(flags: Map<string, string | boolean>): void {
  if (flags.has('parent-worktree') && flags.get('no-parent') === true) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Choose either --parent-worktree or --no-parent, not both.'
    )
  }
  const parentWorktree = flags.get('parent-worktree')
  if (
    flags.has('parent-worktree') &&
    (typeof parentWorktree !== 'string' || parentWorktree === '')
  ) {
    throw new RuntimeClientError('invalid_argument', 'Missing required --parent-worktree')
  }
}

export const runWorktreeSet: CommandHandler = async ({ flags, client, cwd, json }) => {
  assertParentWorktreeFlagsCompatible(flags)
  const linearIssueLink = getOptionalLinearIssueLinkFlag(flags, 'linear-issue', {
    allowNull: true
  })
  const giteaIssueRequest = getOptionalGiteaIssueFlag(flags, 'gitea-issue', { allowNull: true })
  const worktreeSelector = await getRequiredWorktreeSelector(flags, 'worktree', cwd, client)
  // Why: set takes no --repo, so the repo that owns the Gitea remote is read
  // off the worktree being edited. Unlinking needs no lookup at all.
  const giteaIssueLink = giteaIssueRequest
    ? await resolveGiteaIssueLinkForWorktree(giteaIssueRequest, worktreeSelector, client)
    : undefined
  const result = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.set', {
    worktree: worktreeSelector,
    displayName: getOptionalStringFlag(flags, 'display-name'),
    linkedIssue: getOptionalNullableNumberFlag(flags, 'issue'),
    ...linearIssueLink,
    ...giteaIssueLink,
    comment: getOptionalStringFlag(flags, 'comment'),
    workspaceStatus: getOptionalStringFlag(flags, 'workspace-status'),
    parentWorktree: await getOptionalWorktreeSelector(flags, 'parent-worktree', cwd, client),
    noParent: flags.get('no-parent') === true
  })
  printResult(result, json, formatWorktreeShow)
}
