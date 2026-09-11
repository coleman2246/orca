import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import { GiteaStateBadge, normalizeGiteaLabels } from './gitea-item-dialog-parts'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'
import type { GiteaPrimaryActions } from './use-gitea-primary-actions'

type Props = {
  item: GiteaWorkItem
  state: GiteaItemDialogState
  primaryActions: GiteaPrimaryActions
}

export function GiteaMetaTab({ item, state, primaryActions }: Props) {
  const { actionInFlight, details, loading } = state
  const { handleClose, handleReopen } = primaryActions
  const visibleState = state.optimisticState ?? details?.issue.state ?? item.state
  const isOpen = visibleState === 'open'
  const labels = normalizeGiteaLabels(details?.issue.labels ?? item.labels ?? [])
  const assignees = normalizeGiteaLabels(details?.issue.assignees ?? [])
  const milestone = details?.issue.milestone ?? null
  const updatedAt = details?.issue.updatedAt ?? item.updatedAt
  return (
    <TabsContent value="meta" className="mt-0 space-y-4">
      {loading && !details ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {translate('auto.components.GiteaItemDialog.3e8f1a5c7d', 'State')}
              </span>
              <GiteaStateBadge state={visibleState} />
            </div>
            {isOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={actionInFlight !== null}
                onClick={() => void handleClose()}
              >
                {actionInFlight === 'close' ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {translate('auto.components.GiteaItemDialog.6c2d9e1f4a', 'Close issue')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={actionInFlight !== null}
                onClick={() => void handleReopen()}
              >
                {actionInFlight === 'reopen' ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
                {translate('auto.components.GiteaItemDialog.8f1a4b3e9c', 'Reopen issue')}
              </Button>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {translate('auto.components.GiteaItemDialog.dde24ade55', 'Labels')}
              </dt>
              <dd className="min-w-0 text-right text-foreground">
                {labels.length > 0 ? labels.join(', ') : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {translate('auto.components.GiteaItemDialog.1f2e7a9b4d', 'Assignees')}
              </dt>
              <dd className="min-w-0 text-right text-foreground">
                {assignees.length > 0 ? assignees.join(', ') : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {translate('auto.components.GiteaItemDialog.4c9d2f6a1b', 'Milestone')}
              </dt>
              <dd className="min-w-0 text-right text-foreground">{milestone ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {translate('auto.components.GiteaItemDialog.5a7c2e9d1f', 'Updated')}
              </dt>
              <dd className="min-w-0 text-right text-foreground">
                {updatedAt ? new Date(updatedAt).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>
        </>
      )}
    </TabsContent>
  )
}
