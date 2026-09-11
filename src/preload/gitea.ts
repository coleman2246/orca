/* Gitea preload bindings — split out of `src/preload/index.ts` so
   adding or changing a `gitea.*` channel doesn't surface as a merge
   conflict on every upstream sync of the much larger central preload
   file. Composed back into `api.gitea` from `index.ts`. */
import { ipcRenderer } from 'electron'
import type { TaskSourceContext } from '../shared/task-source-context'

type GiteaRepoSelectorArgs = {
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  giteaSiteId?: string | null
}

export const giteaApi = {
  issue: (args: GiteaRepoSelectorArgs & { number: number }) =>
    ipcRenderer.invoke('gitea:issue', args),

  listIssues: (
    args: GiteaRepoSelectorArgs & {
      state?: 'opened' | 'closed' | 'all'
      assignee?: string
      limit?: number
      page?: number
    }
  ) => ipcRenderer.invoke('gitea:listIssues', args),

  createIssue: (
    args: GiteaRepoSelectorArgs & {
      title: string
      body?: string
    }
  ): Promise<{ ok: true; number: number; url: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('gitea:createIssue', args),

  updateIssue: (
    args: GiteaRepoSelectorArgs & {
      number: number
      updates: unknown
    }
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('gitea:updateIssue', args),

  addComment: (args: GiteaRepoSelectorArgs & { number: number; body: string }) =>
    ipcRenderer.invoke('gitea:addComment', args),

  authStatus: (args: GiteaRepoSelectorArgs) => ipcRenderer.invoke('gitea:authStatus', args),

  workItemDetails: (args: GiteaRepoSelectorArgs & { number: number }) =>
    ipcRenderer.invoke('gitea:workItemDetails', args),

  saveSite: (args: { baseUrl: string; token: string }) =>
    ipcRenderer.invoke('gitea:saveSite', args),

  removeSite: (args: { id: string }) => ipcRenderer.invoke('gitea:removeSite', args),

  testSite: (args: { id: string }) => ipcRenderer.invoke('gitea:testSite', args)
}
