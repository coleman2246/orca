import { LoaderCircle } from 'lucide-react'
import { TabsContent } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { GiteaCommentCard } from './gitea-item-dialog-parts'
import type { GiteaItemDialogState } from './use-gitea-item-dialog-state'

type Props = {
  state: GiteaItemDialogState
}

export function GiteaConversationTab({ state }: Props) {
  const { details, loading } = state
  return (
    <TabsContent value="conversation" className="mt-0 space-y-3">
      {loading && !details ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : details?.comments?.length ? (
        details.comments.map((comment) => <GiteaCommentCard key={comment.id} comment={comment} />)
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate('auto.components.GiteaItemDialog.85a8170279', 'No comments yet.')}
        </p>
      )}
    </TabsContent>
  )
}
