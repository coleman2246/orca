import type { TaskPageGitLabLoadingModel } from './use-task-page-gitlab-loading'
import { useEffect, useRef } from 'react'
import type { GiteaWorkItem } from '../../../shared/gitea-types'
import { getTaskPageRepoSourceContext } from './task-page-source-context'

export const GITEA_ISSUES_PAGE_LIMIT = 50
// Why: main's pull-request scan cache serves listings for 30s, so a
// same-generation refresh inside this window cannot observe new data —
// skip the network round-trip instead of flashing loading skeletons.
export const GITEA_ISSUES_QUIET_TTL_MS = 30_000

export function useTaskPageGiteaLoading(model: TaskPageGitLabLoadingModel) {
  const {
    selectedRepos,
    selectedReposKey,
    taskSource,
    giteaConnected,
    giteaFilter,
    giteaPage,
    giteaRefreshNonce,
    setGiteaItems,
    setGiteaLoading,
    setGiteaError
  } = model
  // Why: keyed on data identity without the page or refresh nonce — a
  // Load-more advance must always hit the network, while a same-data
  // revisit (refresh button, tab switch back) inside the quiet TTL is a no-op.
  const lastSuccessRef = useRef<{ generation: string; at: number } | null>(null)
  // Why: fetch per selected repo so errors stay isolated per repo (mirrors
  // GitLab's split-endpoints loading); `not_found` just means the repo isn't
  // a Gitea project under a mixed selection.
  useEffect(() => {
    if (taskSource !== 'gitea' || !giteaConnected) {
      return
    }
    const eligibleRepos = selectedRepos
    if (eligibleRepos.length === 0) {
      setGiteaItems([])
      setGiteaLoading(false)
      setGiteaError(null)
      return
    }
    const generation = JSON.stringify([selectedReposKey, giteaFilter])
    const lastSuccess = lastSuccessRef.current
    if (
      giteaPage === 0 &&
      lastSuccess?.generation === generation &&
      Date.now() - lastSuccess.at < GITEA_ISSUES_QUIET_TTL_MS
    ) {
      return
    }
    let stale = false
    setGiteaLoading(true)
    if (giteaPage === 0) {
      setGiteaError(null)
    }
    // Why: the Task 4 IPC type speaks GitLab-style 'opened'; main's
    // normalizer also accepts 'open', but the typed contract needs the mapping here.
    const state = giteaFilter === 'open' ? 'opened' : giteaFilter
    void Promise.allSettled(
      eligibleRepos.map((repo) =>
        window.api.gitea
          .listIssues({
            repoPath: repo.path,
            repoId: repo.id,
            sourceContext: getTaskPageRepoSourceContext(repo, 'gitea'),
            state,
            limit: GITEA_ISSUES_PAGE_LIMIT,
            // Why: Gitea pages are 1-based; the Tasks pager maps its 0-based UI pages onto this.
            page: giteaPage + 1
          })
          .then((result) => {
            const error = result.error?.type === 'not_found' ? undefined : result.error
            return {
              repoId: repo.id,
              items: result.items,
              error
            }
          })
      )
    )
      .then((results) => {
        if (stale) {
          return
        }
        const merged: GiteaWorkItem[] = []
        const errs: string[] = []
        for (const r of results) {
          if (r.status !== 'fulfilled') {
            errs.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
            continue
          }
          for (const item of r.value.items) {
            merged.push({
              ...item,
              repoId: r.value.repoId
            })
          }
          if (r.value.error) {
            errs.push(r.value.error.message)
          }
        }
        merged.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        if (giteaPage === 0) {
          setGiteaItems(merged)
        } else if (merged.length > 0) {
          // Why: functional update with id-dedupe — a StrictMode remount
          // re-runs this effect for the same page and must not duplicate rows.
          setGiteaItems((prev) => {
            const seen = new Set(prev.map((item) => item.id))
            const fresh = merged.filter((item) => !seen.has(item.id))
            if (fresh.length === 0) {
              return prev
            }
            return [...prev, ...fresh].sort((a, b) =>
              (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
            )
          })
        }
        // Why: only banner when the whole generation failed; a partial one
        // would hide working rows in a mixed (non-Gitea) selection. Items are
        // never wiped on failure so a failed refresh keeps stale rows behind
        // the banner instead of presenting an empty list as current.
        if (errs.length > 0 && merged.length === 0) {
          setGiteaError(errs[0])
          lastSuccessRef.current = null
        } else {
          lastSuccessRef.current = { generation, at: Date.now() }
        }
      })
      .finally(() => {
        if (!stale) {
          setGiteaLoading(false)
        }
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedReposKey covers every selectedRepos field read above; keying off the array ref would re-run on every parent render.
  }, [taskSource, giteaConnected, giteaFilter, giteaPage, giteaRefreshNonce, selectedReposKey])
  return model
}
export type TaskPageGiteaLoadingModel = ReturnType<typeof useTaskPageGiteaLoading>
