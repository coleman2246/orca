import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import type { GiteaTaskFilter } from '../../task-page-source-context'

// Why: translate() must not run at module load — the i18n catalog is not
// loaded yet, so a top-level call bakes in the English fallback for the whole
// session. Building the list per render keeps the labels in the active locale.
function giteaStateFilters(): { id: GiteaTaskFilter; label: string }[] {
  return [
    { id: 'open', label: translate('auto.components.TaskPage.606a85c774', 'Open') },
    { id: 'closed', label: translate('auto.components.TaskPage.d09bf34db7', 'Closed') },
    { id: 'all', label: translate('auto.components.TaskPage.c2268a9982', 'All') }
  ]
}

export function TaskPageGiteaFilters({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element | null {
  const { giteaFilter, setGiteaFilter, setGiteaPage, giteaLoading, setGiteaRefreshNonce } = model
  // Why: 'assigned-to-me' implies an open server state — no state chip is
  // active while Mine holds the scope.
  const mineActive = giteaFilter === 'assigned-to-me'
  const selectFilter = (next: GiteaTaskFilter): void => {
    setGiteaFilter(next)
    // Why: the loading hook replaces items on a generation change, but
    // controls still reset in the same batch to avoid a transient
    // cross-generation fetch.
    setGiteaPage(0)
  }
  return (
    <div
      className="min-w-0 rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-0 shadow-sm"
      data-contextual-tour-target="tasks-search-presets"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {giteaStateFilters().map(({ id, label }) => {
              const active = giteaFilter === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectFilter(id)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition',
                    active
                      ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
                      : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
                  )}
                >
                  {label}
                </button>
              )
            })}
            <button
              key="assigned-to-me"
              type="button"
              onClick={() => selectFilter(mineActive ? 'open' : 'assigned-to-me')}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition',
                mineActive
                  ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
                  : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
              )}
            >
              {translate('auto.components.TaskPage.7698af5263', 'Mine')}
            </button>
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          data-contextual-tour-target="tasks-actions"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setGiteaRefreshNonce((n) => n + 1)}
                disabled={giteaLoading}
                aria-label={translate(
                  'auto.components.TaskPage.4f8e2c9a1d',
                  'Refresh Gitea work items'
                )}
                className="border-border/50 bg-transparent hover:bg-muted/50 backdrop-blur-md supports-[backdrop-filter]:bg-transparent"
              >
                {giteaLoading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.components.TaskPage.4f8e2c9a1d', 'Refresh Gitea work items')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
