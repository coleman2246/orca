import { CircleDot, ExternalLink, LoaderCircle, RefreshCw, Send, X } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { hasBoundedCommentBodyText } from '@/lib/comment-body-submit-state'
import { isScreenSubmitShortcut } from '@/lib/screen-submit-shortcut'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import { GiteaStateBadge, normalizeGiteaLabels } from './gitea-item-dialog-parts'
import { GiteaConversationTab } from './gitea-conversation-tab'
import { GiteaMetaTab } from './gitea-meta-tab'
import { GiteaOverviewTab } from './gitea-overview-tab'
import type { GiteaDetailsEditing } from './use-gitea-details-editing'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'
import type { GiteaPrimaryActions } from './use-gitea-primary-actions'

type Props = {
  item: GiteaWorkItem | null
  onClose: () => void
  onCreateWorkspace?: (item: GiteaWorkItem) => void
  state: GiteaItemDialogState
  detailsEditing: GiteaDetailsEditing
  primaryActions: GiteaPrimaryActions
  handleRefresh: () => void
  updateCommentDraft: (value: string) => void
}

export function GiteaItemDialogView({
  item,
  onClose,
  onCreateWorkspace,
  state,
  detailsEditing,
  primaryActions,
  handleRefresh,
  updateCommentDraft
}: Props) {
  const {
    actionInFlight,
    commentDraft,
    commentSubmitting,
    details,
    error,
    loading,
    optimisticState
  } = state
  const visibleState = optimisticState ?? details?.issue.state ?? item?.state ?? 'open'
  const visibleTitle = details?.issue.title || item?.title || ''
  const visibleLabels = normalizeGiteaLabels(details?.issue.labels ?? item?.labels ?? [])
  const canSubmitComment = hasBoundedCommentBodyText(commentDraft)

  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Why: the sheet's absolute default close control would overlap this header's actions. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <VisuallyHidden.Root>
          <SheetTitle>
            {item
              ? visibleTitle
              : translate('auto.components.GiteaItemDialog.3a051b8ade', 'Work item')}
          </SheetTitle>
          <SheetDescription>
            {translate('auto.components.GiteaItemDialog.30c97083c2', 'Gitea work item detail')}
          </SheetDescription>
        </VisuallyHidden.Root>

        {item ? (
          <>
            <header className="flex-none border-b border-border/40 px-5 py-4">
              <div className="flex items-start gap-3">
                <CircleDot className="mt-0.5 size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">#{item.number}</span>
                    <GiteaStateBadge state={visibleState} />
                    {item.author ? (
                      <span>
                        {translate('auto.components.GiteaItemDialog.9bfb4a24d7', 'by')}{' '}
                        {item.author}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-1.5 text-lg font-semibold leading-tight text-foreground">
                    {visibleTitle}
                  </h2>
                  {visibleLabels.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {visibleLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={translate('auto.components.GiteaItemDialog.b3c156dd51', 'Refresh')}
                    disabled={loading}
                    onClick={handleRefresh}
                    className="size-7"
                  >
                    {loading ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      aria-label={translate('auto.components.GiteaItemDialog.a199eb364b', 'Close')}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </header>

            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-5 mt-3 self-start">
                <TabsTrigger value="overview">
                  {translate('auto.components.GiteaItemDialog.7d2e5f8a1c', 'Overview')}
                </TabsTrigger>
                <TabsTrigger value="conversation">
                  {translate('auto.components.GiteaItemDialog.c996e2962c', 'Conversation')}
                  {details?.comments?.length ? (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                      {details.comments.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="meta">
                  {translate('auto.components.GiteaItemDialog.2b6a8d4f7e', 'Meta')}
                </TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-sleek">
                {error ? (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
                <GiteaOverviewTab item={item} state={state} detailsEditing={detailsEditing} />
                <GiteaConversationTab state={state} />
                <GiteaMetaTab item={item} state={state} primaryActions={primaryActions} />
              </div>
            </Tabs>

            <footer className="flex-none space-y-3 border-t border-border/40 px-5 py-3">
              {/* Why: comment composer at the top of the footer so the
                  primary actions row stays visually grouped at the bottom. */}
              <div className="flex items-end gap-2">
                <textarea
                  value={commentDraft}
                  onChange={(event) => updateCommentDraft(event.target.value)}
                  placeholder={translate(
                    'auto.components.GiteaItemDialog.c08e1d5a57',
                    'Comment on {{value0}}{{value1}}…',
                    { value0: '#', value1: item.number }
                  )}
                  rows={2}
                  disabled={commentSubmitting}
                  className="min-h-9 w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
                  onKeyDown={(event) => {
                    // Why: this is local textarea submit behavior; Settings
                    // keybindings only cover app commands.
                    if (isScreenSubmitShortcut(event) && canSubmitComment && !commentSubmitting) {
                      event.preventDefault()
                      void primaryActions.handleSubmitComment()
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!canSubmitComment || commentSubmitting}
                  onClick={() => void primaryActions.handleSubmitComment()}
                  className="shrink-0 gap-1.5"
                >
                  {commentSubmitting ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {translate('auto.components.GiteaItemDialog.84012fa8fb', 'Comment')}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void window.api.shell.openUrl(item.url)}
                  className="gap-1.5"
                >
                  <ExternalLink className="size-3.5" />
                  {translate('auto.components.GiteaItemDialog.f2e64d1c20', 'Open in Gitea')}
                </Button>
                <div className="flex items-center gap-2">
                  {onCreateWorkspace ? (
                    <Button variant="outline" size="sm" onClick={() => onCreateWorkspace(item)}>
                      {translate('auto.components.GiteaItemDialog.131865e231', 'Create workspace')}
                    </Button>
                  ) : null}
                  {visibleState === 'open' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionInFlight !== null}
                      onClick={() => void primaryActions.handleClose()}
                    >
                      {actionInFlight === 'close' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : null}
                      {translate('auto.components.GiteaItemDialog.a199eb364b', 'Close')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionInFlight !== null}
                      onClick={() => void primaryActions.handleReopen()}
                    >
                      {actionInFlight === 'reopen' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : null}
                      {translate('auto.components.GiteaItemDialog.65e784c1f1', 'Reopen')}
                    </Button>
                  )}
                </div>
              </div>
            </footer>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
