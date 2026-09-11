import type { GiteaWorkItem } from '../../shared/gitea-types'
import {
  parseGiteaIssueOrPullLink,
  parseGiteaIssueOrPullNumber
} from '../../shared/new-workspace/gitea-links'
import type { TaskSourceContext } from '../../shared/task-source-context'
import type { WorkspaceLinkedItem } from '../../shared/worktree/types'
import type { RuntimeClient } from '../runtime-client'
import { RuntimeClientError } from '../runtime-client'

/** `null` means "unlink"; a number is the issue to resolve against the repo's site. */
export type GiteaIssueLinkRequest = { number: number } | 'clear'

export type GiteaIssueLinkUpdates = {
  linkedWorkItem: WorkspaceLinkedItem | null
  linkedTaskSourceContext: TaskSourceContext | null
}

/** What `gitea.issue` answers: the work item plus the source context main built for it. */
type GiteaIssueLookup = {
  item: GiteaWorkItem
  sourceContext: TaskSourceContext | null
} | null

export function getOptionalGiteaIssueFlag(
  flags: Map<string, string | boolean>,
  name: string,
  options: { allowNull?: boolean } = {}
): GiteaIssueLinkRequest | undefined {
  const value = getPresentStringFlag(flags, name)
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.toLowerCase() === 'null') {
    if (!options.allowNull) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Omit --${name} on create, or pass a Gitea issue number or URL.`
      )
    }
    return 'clear'
  }

  // Why: a pasted URL is checked before the bare-number parser, because the
  // number parser accepts `/pulls/<n>` too and this flag links issues only.
  // Silently linking a pull request as an issue would produce a work item the
  // Tasks drawer can never match.
  if (/^https?:/i.test(trimmed)) {
    const link = parseGiteaIssueOrPullLink(trimmed)
    if (!link) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Pass a Gitea issue number like 42, a Gitea issue URL, or null to clear --${name}.`
      )
    }
    if (link.type !== 'issue') {
      throw new RuntimeClientError(
        'invalid_argument',
        `--${name} links Gitea issues; that URL points at a pull request.`
      )
    }
    return { number: link.number }
  }

  const number = parseGiteaIssueOrPullNumber(trimmed)
  if (number === null || number <= 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Pass a Gitea issue number like 42, a Gitea issue URL, or null to clear --${name}.`
    )
  }
  return { number }
}

/**
 * Turn a parsed `--gitea-issue` into the fields `worktree.create` / `worktree.set`
 * take, resolving the issue's title and canonical URL through the repo's own
 * Gitea site credential.
 *
 * Why the round trip: `linkedWorkItem` carries a title and a URL, and neither
 * can be derived from a bare issue number. The token that authorizes the
 * lookup lives in the main process, so the CLI asks the runtime rather than
 * talking to Gitea itself.
 */
export async function resolveGiteaIssueLinkUpdates(
  request: GiteaIssueLinkRequest,
  repoSelector: string,
  client: Pick<RuntimeClient, 'call'>
): Promise<GiteaIssueLinkUpdates> {
  if (request === 'clear') {
    return { linkedWorkItem: null, linkedTaskSourceContext: null }
  }
  const response = await client.call<GiteaIssueLookup>('gitea.issue', {
    repo: repoSelector,
    number: request.number
  })
  const resolved = response.result
  if (!resolved) {
    throw new RuntimeClientError(
      'not_found',
      `Gitea issue #${request.number} was not found. Check the number, that this repository has a Gitea remote, and that a Gitea site is connected in Settings → Tasks.`
    )
  }
  return {
    linkedWorkItem: {
      provider: 'gitea',
      type: resolved.item.type,
      number: resolved.item.number,
      title: resolved.item.title,
      url: resolved.item.url,
      ...(resolved.item.repoId ? { repoId: resolved.item.repoId } : {})
    },
    linkedTaskSourceContext: resolved.sourceContext
  }
}

function getPresentStringFlag(
  flags: Map<string, string | boolean>,
  name: string
): string | undefined {
  if (!flags.has(name)) {
    return undefined
  }
  const value = flags.get(name)
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  throw new RuntimeClientError('invalid_argument', `Missing value for --${name}`)
}

/**
 * `worktree set` variant: the repo is read off the worktree being edited,
 * because `set` takes no `--repo`. Unlinking needs no lookup at all, so the
 * clear path never costs a round trip.
 */
export async function resolveGiteaIssueLinkForWorktree(
  request: GiteaIssueLinkRequest,
  worktreeSelector: string,
  client: Pick<RuntimeClient, 'call'>
): Promise<GiteaIssueLinkUpdates> {
  if (request === 'clear') {
    return { linkedWorkItem: null, linkedTaskSourceContext: null }
  }
  const shown = await client.call<{ worktree: { repoId: string } }>('worktree.show', {
    worktree: worktreeSelector
  })
  return resolveGiteaIssueLinkUpdates(request, `id:${shown.result.worktree.repoId}`, client)
}
