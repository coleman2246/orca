import type {
  GiteaIssueComment,
  GiteaIssueInfo,
  GiteaWorkItem
} from '../../../../shared/gitea-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'

export type GiteaWorkItemDetails = {
  issue: GiteaIssueInfo
  comments: GiteaIssueComment[]
}

export type GiteaItemDialogProps = {
  item: GiteaWorkItem | null
  repoPath: string | null
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  onClose: () => void
  onCreateWorkspace?: (item: GiteaWorkItem) => void
  onMutated?: () => void
}

export type GiteaDialogRepoSelector = {
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  giteaSiteId?: string | null
}
