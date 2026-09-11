import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import type { GiteaIssueComment, GiteaWorkItem } from '../../../../shared/gitea-types'

export const GITEA_STATE_TONE: Record<GiteaWorkItem['state'], string> = {
  open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground'
}

export function showGiteaMutationError(error: unknown): void {
  const message = error instanceof Error && error.message ? error.message : String(error)
  toast.error(
    message === 'undefined' || message === 'null'
      ? translate('auto.components.GiteaItemDialog.5f3c8a1d9e', 'Gitea action failed.')
      : message
  )
}

export function GiteaStateBadge({ state }: { state: GiteaWorkItem['state'] }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        GITEA_STATE_TONE[state]
      )}
    >
      {state}
    </span>
  )
}

export function normalizeGiteaLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const label of labels) {
    const trimmed = label.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) {
      continue
    }
    seen.add(key)
    normalized.push(trimmed)
  }
  return normalized
}

export function parseGiteaLabelDraft(value: string): string[] {
  return normalizeGiteaLabels(value.split(','))
}

export function formatGiteaLabelDraft(labels: readonly string[]): string {
  return normalizeGiteaLabels(labels).join(', ')
}

export function toggleGiteaLabelDraft(value: string, label: string): string {
  const labels = parseGiteaLabelDraft(value)
  const key = label.trim().toLowerCase()
  const next = labels.some((item) => item.toLowerCase() === key)
    ? labels.filter((item) => item.toLowerCase() !== key)
    : [...labels, label]
  return formatGiteaLabelDraft(next)
}

export function GiteaCommentCard({ comment }: { comment: GiteaIssueComment }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border/40 bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.author}</span>
        <span>{comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}</span>
      </div>
      <CommentMarkdown
        content={comment.body}
        variant="document"
        className="min-w-0 max-w-full overflow-hidden break-words text-[13px] leading-relaxed [&_a]:break-all [&_code]:break-words [&_pre]:max-w-full"
      />
    </div>
  )
}
