import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { GiteaStateBadge } from '@/components/gitea-item-dialog/gitea-item-dialog-parts'
export function TaskPageGiteaItemList({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element | null {
  const {
    giteaItems,
    giteaLoading,
    giteaError,
    giteaEmptyState,
    displayedGiteaItems,
    openGiteaDetailPage,
    setGiteaRefreshNonce
  } = model
  return (
    <div className="flex min-h-0 max-h-full flex-col rounded-md border border-t-0 border-border/50 bg-muted/50 overflow-hidden rounded-t-none shadow-sm">
      <div className="flex-none grid grid-cols-[80px_minmax(0,3fr)_100px_100px_110px_50px] gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>{translate('auto.components.TaskPage.eb10c32872', 'ID')}</span>
        <span>{translate('auto.components.TaskPage.16cba35bee', 'Title')}</span>
        <span>{translate('auto.components.TaskPage.00b7ffb952', 'Type / State')}</span>
        <span>{translate('auto.components.TaskPage.3f9e5c2a8d', 'Assignee')}</span>
        <span>{translate('auto.components.TaskPage.f362667d55', 'Updated')}</span>
        <span />
      </div>
      <div
        className="min-h-0 flex-initial overflow-y-auto scrollbar-sleek"
        style={{
          scrollbarGutter: 'stable'
        }}
      >
        {giteaError ? (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 text-sm text-destructive">
            <span className="min-w-0 flex-1">{giteaError}</span>
            <Button variant="outline" size="xs" onClick={() => setGiteaRefreshNonce((n) => n + 1)}>
              {translate('auto.components.TaskPage.7a1e4f6b3c', 'Retry')}
            </Button>
          </div>
        ) : null}
        {giteaLoading && giteaItems.length === 0 ? (
          // Why: shimmer rows fill the viewport so the card never flashes empty and the table doesn't jump when real rows land.
          <div className="divide-y divide-border/50">
            {Array.from({
              length: 12
            }).map((_, i) => (
              <div
                key={i}
                className="grid w-full gap-3 px-3 py-2 grid-cols-[80px_minmax(0,3fr)_100px_100px_110px_50px]"
              >
                <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                <div>
                  <div className="h-4 w-3/5 animate-pulse rounded bg-muted/70" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div />
              </div>
            ))}
          </div>
        ) : null}
        {!giteaLoading && displayedGiteaItems.length === 0 && !giteaError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-base font-medium text-foreground">{giteaEmptyState.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{giteaEmptyState.description}</p>
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {displayedGiteaItems.map((item) => (
            // Why: div role="button" not a <button> — it nests an open-in-browser button, and button-in-button is invalid HTML.
            <div
              role="button"
              tabIndex={0}
              key={`${item.repoId}:${item.id}`}
              onClick={() => {
                openGiteaDetailPage(item)
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) {
                  return
                }
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openGiteaDetailPage(item)
                }
              }}
              className="grid w-full cursor-pointer gap-3 px-3 py-2 text-left grid-cols-[80px_minmax(0,3fr)_100px_100px_110px_50px] hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{item.title}</span>
                {(item.labels ?? []).length > 0 ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {(item.labels ?? []).join(', ')}
                  </span>
                ) : null}
              </span>
              <span>
                <GiteaStateBadge state={item.state} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {(item.assignees ?? [])[0] ?? '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}
              </span>
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void window.api.shell.openUrl(item.url)
                  }}
                  aria-label={translate('auto.components.TaskPage.9d4f7a2e5b', 'Open in Gitea')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
