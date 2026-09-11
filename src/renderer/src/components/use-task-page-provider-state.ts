import type { TaskPageSourceAvailabilityModel } from './use-task-page-source-availability'
import { useRef, useState, useEffect, useMemo } from 'react'
import { resolveVisibleTaskProvider } from '../../../shared/task-providers'
import type { GitLabTaskFilter, GitLabIssueFilter } from '@/components/task-page-localized-options'
import type { GitLabWorkItem, GitLabTodo } from '../../../shared/gitlab-types'
import type { GiteaWorkItem } from '../../../shared/gitea-types'
import { getRepoBackedTaskEmptyState } from '@/components/task-page-empty-state'
import { isGitLabIssueFilter, isGitLabMRFilter } from './task-page-source-context'
import type { GiteaTaskFilter } from './task-page-source-context'
export function useTaskPageProviderState(model: TaskPageSourceAvailabilityModel) {
  const {
    settings,
    pageData,
    selectedRepos,
    visibleTaskProviders,
    preferredTaskSource,
    taskSource,
    setTaskSource
  } = model
  const taskSourceManuallyChangedRef = useRef(false)
  const lastPageTaskSourceRef = useRef(pageData.taskSource)
  const taskResumeAppliedRef = useRef(false)
  const githubSearchPersistReadyRef = useRef(false)
  const linearSearchPersistReadyRef = useRef(false)
  const linearViewPersistReadyRef = useRef(false)
  const jiraSearchPersistReadyRef = useRef(false)
  const [taskResumeApplied, setTaskResumeApplied] = useState(false)

  // Why: useState only inits once, so sync taskSource from the store when a sidebar source-icon click changes pageData.taskSource.
  useEffect(() => {
    const pageTaskSourceChanged = lastPageTaskSourceRef.current !== pageData.taskSource
    lastPageTaskSourceRef.current = pageData.taskSource
    if (pageData.taskSource) {
      if (pageTaskSourceChanged) {
        taskSourceManuallyChangedRef.current = false
      } else if (taskSourceManuallyChangedRef.current) {
        return
      }
      setTaskSource(resolveVisibleTaskProvider(pageData.taskSource, visibleTaskProviders))
    }
  }, [pageData.taskSource, visibleTaskProviders, setTaskSource])
  useEffect(() => {
    if (taskSourceManuallyChangedRef.current) {
      return
    }
    // Why: GitLab/Linear availability hydrates after mount; restore the saved default once its provider check proves it can be shown.
    if (visibleTaskProviders.includes(preferredTaskSource) && taskSource !== preferredTaskSource) {
      setTaskSource(preferredTaskSource)
    }
  }, [preferredTaskSource, taskSource, visibleTaskProviders, setTaskSource])
  useEffect(() => {
    if (!visibleTaskProviders.includes(taskSource)) {
      setTaskSource(resolveVisibleTaskProvider(settings?.defaultTaskSource, visibleTaskProviders))
    }
  }, [settings?.defaultTaskSource, taskSource, visibleTaskProviders, setTaskSource])

  // Why: Project mode is a GitHub sub-tab — visible on the GitHub source, but actual entry is gated on a non-null activeProject.
  const projectModeVisible = taskSource === 'github'
  const [githubMode, setGithubMode] = useState<'items' | 'project'>('items')

  // ── GitLab task-source state ──────────────────────────────────────
  // Why: parallel to Linear's slim per-source state — skips workItemsCache and cross-repo aggregation; fetches directly via window.api.gl for the primary repo.
  const [gitlabFilter, setGitlabFilter] = useState<GitLabTaskFilter | GitLabIssueFilter>('opened')
  const [gitlabItems, setGitlabItems] = useState<GitLabWorkItem[]>([])
  const [gitlabLoading, setGitlabLoading] = useState(false)
  const [gitlabError, setGitlabError] = useState<string | null>(null)
  const [gitlabRefreshNonce, setGitlabRefreshNonce] = useState(0)
  // Why: separate from gitlabItems so the dialog target survives a list refresh that removes the item from the visible filter (e.g. closing an MR).
  const [gitlabDialogItem, setGitlabDialogItem] = useState<GitLabWorkItem | null>(null)

  // Why: GitLab tab has two sub-views — the project MR/issue list and the user's cross-project Todos (a separate stream).
  const [gitlabView, setGitlabView] = useState<'issues' | 'mrs' | 'todos'>('mrs')
  const [gitlabTodos, setGitlabTodos] = useState<GitLabTodo[]>([])
  const [gitlabTodosLoading, setGitlabTodosLoading] = useState(false)
  const gitlabEmptyState = useMemo(
    () =>
      getRepoBackedTaskEmptyState({
        provider: 'gitlab',
        selectedRepoCount: selectedRepos.length,
        gitlabView
      }),
    [gitlabView, selectedRepos.length]
  )
  const gitlabFilterIsValid =
    gitlabView === 'issues'
      ? isGitLabIssueFilter(gitlabFilter)
      : gitlabView === 'mrs'
        ? isGitLabMRFilter(gitlabFilter)
        : true
  const activeGitlabFilter = gitlabFilterIsValid ? gitlabFilter : 'opened'
  // Why: Issues and MRs expose different filter sets; repair before commit so fetch effects never run glab with a stale filter from the other view.
  if (!gitlabFilterIsValid) {
    setGitlabFilter('opened')
  }
  const displayedGitLabItems = useMemo(() => {
    if (gitlabView === 'issues') {
      return gitlabItems.filter((item) => item.type === 'issue')
    }
    if (gitlabView === 'mrs') {
      return gitlabItems.filter((item) => item.type === 'mr')
    }
    return gitlabItems
  }, [gitlabItems, gitlabView])

  // ── Gitea task-source state ───────────────────────────────────────
  // Why: parallel to the GitLab block — slim per-source state; the loading
  // hook fetches directly via window.api.gitea for the selected repos.
  // `state` goes to the server; search/label filter client-side over the
  // fetched pages because the Task 4 IPC contract forwards no search params.
  const [giteaFilter, setGiteaFilter] = useState<GiteaTaskFilter>('open')
  const [giteaSearch, setGiteaSearch] = useState('')
  const [giteaLabel, setGiteaLabel] = useState<string | null>(null)
  const [giteaItems, setGiteaItems] = useState<GiteaWorkItem[]>([])
  const [giteaLoading, setGiteaLoading] = useState(false)
  const [giteaError, setGiteaError] = useState<string | null>(null)
  const [giteaRefreshNonce, setGiteaRefreshNonce] = useState(0)
  // Why: 0-based UI page (the loading hook maps it onto Gitea's 1-based
  // pages); the hook also resets it to 0 on a generation change, but filter
  // controls should still reset in the same batch to avoid a transient fetch.
  const [giteaPage, setGiteaPage] = useState(0)
  // Why: separate from giteaItems so the dialog target survives a list refresh that removes the item from the visible filter (Task 7 entry point).
  const [giteaDialogItem, setGiteaDialogItem] = useState<GiteaWorkItem | null>(null)
  // Why: siteId is never parsed here — it may be URL-shaped (baseUrl
  // fallback when anonymous/env), so grouping keys off nothing.
  const displayedGiteaItems = useMemo(() => {
    const query = giteaSearch.trim().toLowerCase()
    return giteaItems.filter((item) => {
      if (giteaLabel && !(item.labels ?? []).includes(giteaLabel)) {
        return false
      }
      if (query && !(item.title ?? '').toLowerCase().includes(query)) {
        return false
      }
      return true
    })
  }, [giteaItems, giteaSearch, giteaLabel])
  const giteaEmptyState = useMemo(
    () =>
      getRepoBackedTaskEmptyState({
        provider: 'gitea',
        selectedRepoCount: selectedRepos.length
      }),
    [selectedRepos.length]
  )
  const nextModel = model as typeof model & {
    taskSourceManuallyChangedRef: typeof taskSourceManuallyChangedRef
    lastPageTaskSourceRef: typeof lastPageTaskSourceRef
    taskResumeAppliedRef: typeof taskResumeAppliedRef
    githubSearchPersistReadyRef: typeof githubSearchPersistReadyRef
    linearSearchPersistReadyRef: typeof linearSearchPersistReadyRef
    linearViewPersistReadyRef: typeof linearViewPersistReadyRef
    jiraSearchPersistReadyRef: typeof jiraSearchPersistReadyRef
    taskResumeApplied: typeof taskResumeApplied
    setTaskResumeApplied: typeof setTaskResumeApplied
    projectModeVisible: typeof projectModeVisible
    githubMode: typeof githubMode
    setGithubMode: typeof setGithubMode
    gitlabFilter: typeof gitlabFilter
    setGitlabFilter: typeof setGitlabFilter
    gitlabItems: typeof gitlabItems
    setGitlabItems: typeof setGitlabItems
    gitlabLoading: typeof gitlabLoading
    setGitlabLoading: typeof setGitlabLoading
    gitlabError: typeof gitlabError
    setGitlabError: typeof setGitlabError
    gitlabRefreshNonce: typeof gitlabRefreshNonce
    setGitlabRefreshNonce: typeof setGitlabRefreshNonce
    gitlabDialogItem: typeof gitlabDialogItem
    setGitlabDialogItem: typeof setGitlabDialogItem
    gitlabView: typeof gitlabView
    setGitlabView: typeof setGitlabView
    gitlabTodos: typeof gitlabTodos
    setGitlabTodos: typeof setGitlabTodos
    gitlabTodosLoading: typeof gitlabTodosLoading
    setGitlabTodosLoading: typeof setGitlabTodosLoading
    gitlabEmptyState: typeof gitlabEmptyState
    gitlabFilterIsValid: typeof gitlabFilterIsValid
    activeGitlabFilter: typeof activeGitlabFilter
    displayedGitLabItems: typeof displayedGitLabItems
    giteaFilter: typeof giteaFilter
    setGiteaFilter: typeof setGiteaFilter
    giteaSearch: typeof giteaSearch
    setGiteaSearch: typeof setGiteaSearch
    giteaLabel: typeof giteaLabel
    setGiteaLabel: typeof setGiteaLabel
    giteaItems: typeof giteaItems
    setGiteaItems: typeof setGiteaItems
    giteaLoading: typeof giteaLoading
    setGiteaLoading: typeof setGiteaLoading
    giteaError: typeof giteaError
    setGiteaError: typeof setGiteaError
    giteaRefreshNonce: typeof giteaRefreshNonce
    setGiteaRefreshNonce: typeof setGiteaRefreshNonce
    giteaPage: typeof giteaPage
    setGiteaPage: typeof setGiteaPage
    giteaDialogItem: typeof giteaDialogItem
    setGiteaDialogItem: typeof setGiteaDialogItem
    displayedGiteaItems: typeof displayedGiteaItems
    giteaEmptyState: typeof giteaEmptyState
  }
  nextModel.taskSourceManuallyChangedRef = taskSourceManuallyChangedRef
  nextModel.lastPageTaskSourceRef = lastPageTaskSourceRef
  nextModel.taskResumeAppliedRef = taskResumeAppliedRef
  nextModel.githubSearchPersistReadyRef = githubSearchPersistReadyRef
  nextModel.linearSearchPersistReadyRef = linearSearchPersistReadyRef
  nextModel.linearViewPersistReadyRef = linearViewPersistReadyRef
  nextModel.jiraSearchPersistReadyRef = jiraSearchPersistReadyRef
  nextModel.taskResumeApplied = taskResumeApplied
  nextModel.setTaskResumeApplied = setTaskResumeApplied
  nextModel.projectModeVisible = projectModeVisible
  nextModel.githubMode = githubMode
  nextModel.setGithubMode = setGithubMode
  nextModel.gitlabFilter = gitlabFilter
  nextModel.setGitlabFilter = setGitlabFilter
  nextModel.gitlabItems = gitlabItems
  nextModel.setGitlabItems = setGitlabItems
  nextModel.gitlabLoading = gitlabLoading
  nextModel.setGitlabLoading = setGitlabLoading
  nextModel.gitlabError = gitlabError
  nextModel.setGitlabError = setGitlabError
  nextModel.gitlabRefreshNonce = gitlabRefreshNonce
  nextModel.setGitlabRefreshNonce = setGitlabRefreshNonce
  nextModel.gitlabDialogItem = gitlabDialogItem
  nextModel.setGitlabDialogItem = setGitlabDialogItem
  nextModel.gitlabView = gitlabView
  nextModel.setGitlabView = setGitlabView
  nextModel.gitlabTodos = gitlabTodos
  nextModel.setGitlabTodos = setGitlabTodos
  nextModel.gitlabTodosLoading = gitlabTodosLoading
  nextModel.setGitlabTodosLoading = setGitlabTodosLoading
  nextModel.gitlabEmptyState = gitlabEmptyState
  nextModel.gitlabFilterIsValid = gitlabFilterIsValid
  nextModel.activeGitlabFilter = activeGitlabFilter
  nextModel.displayedGitLabItems = displayedGitLabItems
  nextModel.giteaFilter = giteaFilter
  nextModel.setGiteaFilter = setGiteaFilter
  nextModel.giteaSearch = giteaSearch
  nextModel.setGiteaSearch = setGiteaSearch
  nextModel.giteaLabel = giteaLabel
  nextModel.setGiteaLabel = setGiteaLabel
  nextModel.giteaItems = giteaItems
  nextModel.setGiteaItems = setGiteaItems
  nextModel.giteaLoading = giteaLoading
  nextModel.setGiteaLoading = setGiteaLoading
  nextModel.giteaError = giteaError
  nextModel.setGiteaError = setGiteaError
  nextModel.giteaRefreshNonce = giteaRefreshNonce
  nextModel.setGiteaRefreshNonce = setGiteaRefreshNonce
  nextModel.giteaPage = giteaPage
  nextModel.setGiteaPage = setGiteaPage
  nextModel.giteaDialogItem = giteaDialogItem
  nextModel.setGiteaDialogItem = setGiteaDialogItem
  nextModel.displayedGiteaItems = displayedGiteaItems
  nextModel.giteaEmptyState = giteaEmptyState
  return nextModel
}
export type TaskPageProviderStateModel = ReturnType<typeof useTaskPageProviderState>
