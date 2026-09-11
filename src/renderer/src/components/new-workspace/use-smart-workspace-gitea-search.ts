import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { parseGiteaIssueOrPullLink } from '@/lib/gitea-links'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import { RESULT_LIMIT } from './smart-workspace-name-field-model'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>

function matchGiteaSiteIdByOrigin(host: string): string | null {
  const sites = useAppStore.getState().settings?.giteaSites ?? []
  const wanted = host.toLowerCase()
  for (const site of sites) {
    try {
      if (new URL(site.baseUrl).host.toLowerCase() === wanted) {
        return site.id
      }
    } catch {
      continue
    }
  }
  return null
}

function isSameGiteaOrigin(itemUrl: string, host: string): boolean {
  try {
    return new URL(itemUrl).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

export function useSmartWorkspaceGiteaSearch({
  foundation,
  sourceQueryWithinLimit,
  shouldQueryGitea
}: {
  foundation: Foundation
  sourceQueryWithinLimit: boolean
  shouldQueryGitea: boolean
}): void {
  const {
    debouncedQuery,
    disabled,
    onGiteaItemSelect,
    mode,
    repoBackedSearchTargets,
    setGiteaItems,
    setGiteaLoading
  } = foundation
  // Why: a pasted Gitea URL resolves to exactly one issue — the origin
  // (host) picks the site, mirroring the GitLab project-path lookup.
  const parsedGiteaLink = useMemo(
    () => (sourceQueryWithinLimit ? parseGiteaIssueOrPullLink(debouncedQuery) : null),
    [debouncedQuery, sourceQueryWithinLimit]
  )

  useEffect(() => {
    if (!shouldQueryGitea || disabled || !onGiteaItemSelect) {
      // Why: the list effect below is the sole writer in smart mode without a URL.
      if (!shouldQueryGitea || (parsedGiteaLink === null && mode !== 'smart')) {
        setGiteaItems([])
      }
      setGiteaLoading(false)
      return
    }
    if (parsedGiteaLink === null) {
      if (mode !== 'smart') {
        setGiteaItems([])
      }
      setGiteaLoading(false)
      return
    }
    let stale = false
    setGiteaLoading(true)
    // Why: the pasted URL's origin auto-detects the acting site (spec §7) —
    // forward the matched site id verbatim and keep only results whose
    // URL origin matches, so same-numbered issues on other sites never win.
    const siteId = matchGiteaSiteIdByOrigin(parsedGiteaLink.slug.host)
    void Promise.all(
      repoBackedSearchTargets.map((target) =>
        window.api.gitea
          .workItemDetails({
            repoPath: target.repo.path,
            repoId: target.repo.id,
            sourceContext: target.giteaSourceContext,
            ...(siteId ? { giteaSiteId: siteId } : {}),
            number: parsedGiteaLink.number
          })
          .then((data): GiteaWorkItem | null => {
            if (!data || !isSameGiteaOrigin(data.issue.url, parsedGiteaLink.slug.host)) {
              return null
            }
            return {
              id: `gitea-issue-${target.repo.id}-${data.issue.number}`,
              type: 'issue',
              number: data.issue.number,
              title: data.issue.title,
              state: data.issue.state,
              url: data.issue.url,
              labels: data.issue.labels,
              assignees: data.issue.assignees,
              updatedAt: data.issue.updatedAt,
              author: null,
              repoId: target.repo.id,
              siteId: siteId ?? ''
            }
          })
          .catch(() => null)
      )
    )
      .then((items) => {
        if (stale) {
          return
        }
        setGiteaItems(items.filter((item): item is GiteaWorkItem => item !== null))
      })
      .catch(() => {
        if (!stale) {
          setGiteaItems([])
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
  }, [
    disabled,
    mode,
    onGiteaItemSelect,
    parsedGiteaLink,
    repoBackedSearchTargets,
    setGiteaItems,
    setGiteaLoading,
    shouldQueryGitea
  ])

  // Why: Gitea list has no server-side text query — fetch the open page and
  // filter titles client-side, mirroring the GitLab default opened-MR list
  // when no URL is pasted.
  useEffect(() => {
    if (!shouldQueryGitea || disabled || !onGiteaItemSelect) {
      if (!shouldQueryGitea) {
        setGiteaItems([])
        setGiteaLoading(false)
      }
      return
    }
    if (repoBackedSearchTargets.length === 0) {
      setGiteaItems([])
      setGiteaLoading(false)
      return
    }
    if (parsedGiteaLink !== null) {
      return
    }
    let stale = false
    setGiteaLoading(true)
    const trimmedQuery = debouncedQuery.trim().toLowerCase() || undefined
    // Why: empty-query list must not briefly paint the previous non-empty result set.
    if (trimmedQuery === undefined) {
      setGiteaItems([])
    }
    void Promise.all(
      repoBackedSearchTargets.map((target) =>
        window.api.gitea
          .listIssues({
            repoPath: target.repo.path,
            repoId: target.repo.id,
            sourceContext: target.giteaSourceContext,
            state: 'opened',
            limit: RESULT_LIMIT,
            page: 1
          })
          .then((result) => result.items)
          .catch((): GiteaWorkItem[] => [])
      )
    )
      .then((results) => {
        if (stale) {
          return
        }
        setGiteaItems(
          results
            .flat()
            .filter((item) =>
              trimmedQuery === undefined ? true : item.title.toLowerCase().includes(trimmedQuery)
            )
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            .slice(0, RESULT_LIMIT)
        )
      })
      .catch(() => {
        if (!stale) {
          setGiteaItems([])
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
  }, [
    debouncedQuery,
    disabled,
    mode,
    onGiteaItemSelect,
    parsedGiteaLink,
    repoBackedSearchTargets,
    setGiteaItems,
    setGiteaLoading,
    shouldQueryGitea
  ])
}
