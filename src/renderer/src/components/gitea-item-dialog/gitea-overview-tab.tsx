import { Check, LoaderCircle, Pencil, X } from 'lucide-react'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { GiteaWorkItem } from '../../../../shared/gitea-types'
import {
  normalizeGiteaLabels,
  parseGiteaLabelDraft,
  toggleGiteaLabelDraft
} from './gitea-item-dialog-parts'
import type { GiteaDetailsEditing } from './use-gitea-details-editing'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'

type Props = {
  item: GiteaWorkItem
  state: GiteaItemDialogState
  detailsEditing: GiteaDetailsEditing
}

export function GiteaOverviewTab({ item, state, detailsEditing }: Props) {
  const {
    assigneeDraft,
    bodyDraft,
    details,
    detailsSaving,
    editingDetails,
    labelDraft,
    loading,
    milestoneDraft,
    setAssigneeDraft,
    setBodyDraft,
    setLabelDraft,
    setMilestoneDraft,
    setTitleDraft,
    titleDraft
  } = state
  const { handleCancelDetailsEdit, handleSaveDetails, handleStartDetailsEdit } = detailsEditing
  const visibleLabels = normalizeGiteaLabels(details?.issue.labels ?? item.labels ?? [])
  const labelSuggestionOptions = normalizeGiteaLabels([
    ...visibleLabels,
    ...parseGiteaLabelDraft(labelDraft)
  ])

  return (
    <TabsContent value="overview" className="mt-0">
      {loading && !details ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : editingDetails ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {translate('auto.components.GiteaItemDialog.89f3f19368', 'Title')}
            </label>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={detailsSaving}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {translate('auto.components.GiteaItemDialog.908d8d2a73', 'Description')}
            </label>
            <textarea
              value={bodyDraft}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={8}
              disabled={detailsSaving}
              className="min-h-40 w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {translate('auto.components.GiteaItemDialog.dde24ade55', 'Labels')}
            </label>
            <input
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              disabled={detailsSaving}
              placeholder={translate('auto.components.GiteaItemDialog.3c0b6ccca7', 'bug, backend')}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
            />
            {labelSuggestionOptions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {labelSuggestionOptions.map((label) => {
                  const selected = parseGiteaLabelDraft(labelDraft).some(
                    (option) => option.toLowerCase() === label.toLowerCase()
                  )
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={detailsSaving}
                      onClick={() => setLabelDraft(toggleGiteaLabelDraft(labelDraft, label))}
                      className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors',
                        selected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60'
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                      {label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {translate('auto.components.GiteaItemDialog.1f2e7a9b4d', 'Assignees')}
            </label>
            <input
              value={assigneeDraft}
              onChange={(event) => setAssigneeDraft(event.target.value)}
              disabled={detailsSaving}
              placeholder={translate('auto.components.GiteaItemDialog.7e5a1c3d8f', 'ada, bob')}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {translate('auto.components.GiteaItemDialog.4c9d2f6a1b', 'Milestone')}
            </label>
            <input
              value={milestoneDraft}
              onChange={(event) => setMilestoneDraft(event.target.value)}
              disabled={detailsSaving}
              placeholder={translate('auto.components.GiteaItemDialog.9a3b7e5c2d', 'v1.0')}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={detailsSaving}
              onClick={handleCancelDetailsEdit}
            >
              <X className="size-3.5" />
              {translate('auto.components.GiteaItemDialog.f72fad3b16', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={detailsSaving || !titleDraft.trim()}
              onClick={() => void handleSaveDetails()}
            >
              {detailsSaving ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {translate('auto.components.GiteaItemDialog.93f79a3fc1', 'Save')}
            </Button>
          </div>
        </div>
      ) : details?.issue.body ? (
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartDetailsEdit}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              {translate('auto.components.GiteaItemDialog.da4174b00f', 'Edit')}
            </Button>
          </div>
          <CommentMarkdown
            content={details.issue.body}
            variant="document"
            className="min-w-0 max-w-full overflow-hidden break-words text-[13px] leading-relaxed [&_a]:break-all [&_code]:break-words [&_pre]:max-w-full"
          />
        </div>
      ) : (
        <div>
          {details ? (
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartDetailsEdit}
                className="gap-1.5"
              >
                <Pencil className="size-3.5" />
                {translate('auto.components.GiteaItemDialog.da4174b00f', 'Edit')}
              </Button>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {translate('auto.components.GiteaItemDialog.14423484db', 'No description.')}
          </p>
        </div>
      )}
    </TabsContent>
  )
}
