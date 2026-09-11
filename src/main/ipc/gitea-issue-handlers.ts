import { ipcMain } from 'electron'
import type { GiteaIssueUpdatePatch, GiteaWorkItem } from '../../shared/gitea-types'
import type { Repo } from '../../shared/repo-types'
import type { Store } from '../persistence'
import {
  normalizeGiteaIssueListArgs,
  normalizeGiteaIssueUpdateState
} from '../gitea/gitea-preload-args'
import {
  addGiteaIssueComment,
  createGiteaIssue,
  getGiteaIssue,
  listGiteaIssueComments,
  listGiteaIssues,
  updateGiteaIssue,
  type GiteaCallAuth
} from '../gitea/issues-client'
import { getGiteaRepoRef, type GiteaRepoRef } from '../gitea/repository-ref'
import {
  getGiteaConnectionStatus,
  getGiteaSiteForRepo,
  resolveGiteaAuth
} from '../gitea/site-credential-store'
import type { GiteaRepoSelectorArgs } from './gitea-repo-access'
import {
  assertRegisteredRepo,
  giteaSiteIdFromArgs,
  localGitOptionArgs,
  repoConnectionId
} from './gitea-repo-access'

type GiteaCallContext = {
  auth: GiteaCallAuth
  ref: GiteaRepoRef
  siteId: string
}

// Why: every issue channel needs the same repo → remote ref → site/auth
// chain (Task 3's resolveGiteaAuth composed over the Task 2 client). Null
// means the checkout has no parseable Gitea remote — callers degrade to
// their own empty/error shape instead of throwing.
async function resolveCallContext(
  store: Store,
  repo: Repo,
  giteaSiteId: string | null
): Promise<GiteaCallContext | null> {
  const ref = await getGiteaRepoRef(
    repo.path,
    repoConnectionId(repo),
    localGitOptionArgs(store, repo)[0] ?? {}
  )
  if (!ref) {
    return null
  }
  const site = getGiteaSiteForRepo(ref)
  const resolved = resolveGiteaAuth(ref)
  const callSite = site ?? { id: giteaSiteId ?? resolved.baseUrl, baseUrl: resolved.baseUrl }
  return { auth: { site: callSite, token: resolved.token }, ref, siteId: callSite.id }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function registerGiteaIssueHandlers(store: Store): void {
  ipcMain.handle(
    'gitea:issue',
    async (_event, args: GiteaRepoSelectorArgs & { number: number }) => {
      const repo = assertRegisteredRepo(args, store)
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return null
      }
      return getGiteaIssue(context.auth, context.ref, args.number)
    }
  )

  ipcMain.handle(
    'gitea:listIssues',
    async (
      _event,
      args: GiteaRepoSelectorArgs & {
        state?: 'opened' | 'closed' | 'all'
        limit?: number
        page?: number
      }
    ) => {
      const repo = assertRegisteredRepo(args, store)
      const { state, limit, page } = normalizeGiteaIssueListArgs(args)
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return {
          items: [],
          totalPages: 0,
          error: {
            type: 'unknown' as const,
            message: 'Not a Gitea repository: unable to resolve owner/repo from the git remote.'
          }
        }
      }
      const result = await listGiteaIssues(context.auth, context.ref, { state, page, limit })
      // Why: Tasks page expects GiteaWorkItem[] so it can share row
      // rendering across providers. Map IssueInfo → WorkItem here so the
      // renderer doesn't need a separate code path.
      const workItems: GiteaWorkItem[] = result.items.map((issue) => ({
        id: `gitea-issue-${repo.id}-${issue.number}`,
        type: 'issue' as const,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.url,
        labels: issue.labels,
        updatedAt: issue.updatedAt,
        author: null,
        repoId: repo.id,
        siteId: context.siteId
      }))
      return {
        items: workItems,
        totalPages: result.totalPages,
        ...(result.error ? { error: result.error } : {})
      }
    }
  )

  ipcMain.handle(
    'gitea:createIssue',
    async (_event, args: GiteaRepoSelectorArgs & { title: string; body?: string }) => {
      const repo = assertRegisteredRepo(args, store)
      const title = args.title?.trim() ?? ''
      if (!title) {
        return { ok: false as const, error: 'Title is required.' }
      }
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return {
          ok: false as const,
          error: 'Not a Gitea repository: unable to resolve owner/repo from the git remote.'
        }
      }
      try {
        const issue = await createGiteaIssue(context.auth, context.ref, {
          title,
          ...(typeof args.body === 'string' ? { body: args.body } : {})
        })
        return { ok: true as const, number: issue.number, url: issue.url }
      } catch (error) {
        return { ok: false as const, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    'gitea:updateIssue',
    async (
      _event,
      args: GiteaRepoSelectorArgs & { number: number; updates: GiteaIssueUpdatePatch }
    ) => {
      const repo = assertRegisteredRepo(args, store)
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return {
          ok: false as const,
          error: 'Not a Gitea repository: unable to resolve owner/repo from the git remote.'
        }
      }
      try {
        const { state, ...rest } = args.updates ?? {}
        const normalizedState = normalizeGiteaIssueUpdateState(state)
        await updateGiteaIssue(context.auth, context.ref, args.number, {
          ...rest,
          ...(normalizedState ? { state: normalizedState } : {})
        })
        return { ok: true as const }
      } catch (error) {
        return { ok: false as const, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    'gitea:addComment',
    async (_event, args: GiteaRepoSelectorArgs & { number: number; body: string }) => {
      const repo = assertRegisteredRepo(args, store)
      if (!args.body?.trim()) {
        return { ok: false as const, error: 'Comment body is required.' }
      }
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return {
          ok: false as const,
          error: 'Not a Gitea repository: unable to resolve owner/repo from the git remote.'
        }
      }
      try {
        const comment = await addGiteaIssueComment(
          context.auth,
          context.ref,
          args.number,
          args.body
        )
        return { ok: true as const, comment }
      } catch (error) {
        return { ok: false as const, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle('gitea:authStatus', async (_event, args: GiteaRepoSelectorArgs) => {
    const repo = assertRegisteredRepo(args, store)
    const status = getGiteaConnectionStatus()
    const ref = await getGiteaRepoRef(
      repo.path,
      repoConnectionId(repo),
      localGitOptionArgs(store, repo)[0] ?? {}
    )
    if (!ref) {
      return status
    }
    // Why: the env-deprecation hint — Tasks 5 surfaces which credential
    // actually served the repo (stored site vs legacy env vs anonymous).
    return { ...status, authSource: resolveGiteaAuth(ref).source }
  })

  // Why: aggregated dialog payload — body lives on the issue, discussion
  // lives in comments. Powers the Gitea item dialog's detail view.
  ipcMain.handle(
    'gitea:workItemDetails',
    async (_event, args: GiteaRepoSelectorArgs & { number: number }) => {
      const repo = assertRegisteredRepo(args, store)
      const context = await resolveCallContext(store, repo, giteaSiteIdFromArgs(args))
      if (!context) {
        return null
      }
      const issue = await getGiteaIssue(context.auth, context.ref, args.number)
      if (!issue) {
        return null
      }
      const comments = await listGiteaIssueComments(context.auth, context.ref, args.number).catch(
        () => []
      )
      return { issue, comments }
    }
  )
}
