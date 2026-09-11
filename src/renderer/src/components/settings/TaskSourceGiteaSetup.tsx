import { useId, useLayoutEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { GiteaSite } from '../../../../shared/gitea-types'
import { TaskSourceShowInTasksStep } from './TaskSourceShowInTasksStep'
import { TaskSourceStepRow } from './TaskSourceStepRow'
import { translate } from '@/i18n/i18n'

type TaskSourceGiteaSetupProps = {
  connected: boolean
  checking: boolean
  visible: boolean
  canHide: boolean
  onToggleVisible: () => void
  sites: GiteaSite[]
  onSitesChange: (sites: GiteaSite[]) => void
}

type VerificationResult = { state: 'ok' | 'error'; error?: string }

// Why: mirrors JiraSetupSteps — connect (per-host sites with token validation
// in main) plus Show in Tasks in one guided flow. Site metadata persists in
// global settings; tokens never leave the secret store.
export function TaskSourceGiteaSetup({
  connected,
  checking,
  visible,
  canHide,
  onToggleVisible,
  sites,
  onSitesChange
}: TaskSourceGiteaSetupProps): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null)
  const [testResultBySite, setTestResultBySite] = useState<Record<string, VerificationResult>>({})
  const mountedRef = useMountedRef()

  const connectState = checking ? 'in-progress' : connected ? 'done' : 'pending'

  const handleTest = async (siteId: string): Promise<void> => {
    setTestingSiteId(siteId)
    setTestResultBySite((prev) => {
      const next = { ...prev }
      delete next[siteId]
      return next
    })
    const result = await window.api.gitea.testSite({ id: siteId })
    if (!mountedRef.current) {
      return
    }
    setTestResultBySite((prev) => ({
      ...prev,
      [siteId]: result.ok ? { state: 'ok' } : { state: 'error', error: result.error }
    }))
    setTestingSiteId(null)
  }

  const handleRemove = async (siteId: string): Promise<void> => {
    const result = await window.api.gitea.removeSite({ id: siteId })
    if (!result.ok) {
      return
    }
    setTestResultBySite((prev) => {
      const next = { ...prev }
      delete next[siteId]
      return next
    })
    onSitesChange(sites.filter((site) => site.id !== siteId))
  }

  return (
    <>
      <ol className="divide-y divide-border/50">
        <TaskSourceStepRow
          index={1}
          state={connectState}
          title={translate(
            'auto.components.settings.TaskSourceGiteaSetup.connectTitle',
            'Connect Gitea'
          )}
          description={translate(
            'auto.components.settings.TaskSourceGiteaSetup.connectDescription',
            'Add a Gitea or Forgejo host with a personal access token so Orca can show its issues in Tasks.'
          )}
          action={
            <Button
              type="button"
              size="sm"
              variant={connected ? 'outline' : 'default'}
              onClick={() => setDialogOpen(true)}
            >
              {connected
                ? translate(
                    'auto.components.settings.TaskSourceGiteaSetup.addSite',
                    'Add Gitea site'
                  )
                : translate(
                    'auto.components.settings.TaskSourceGiteaSetup.addAccess',
                    'Add Gitea access'
                  )}
            </Button>
          }
        >
          {sites.length > 0 ? (
            <div className="space-y-2 pt-1">
              {sites.map((site) => {
                const testResult = testResultBySite[site.id]
                const testing = testingSiteId === site.id
                return (
                  <div key={site.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {site.baseUrl}
                        {site.account ? ` · ${site.account}` : ''}
                      </p>
                    </div>
                    {testResult?.state === 'ok' ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                        <CheckCircle2 className="size-3.5" />
                        {translate(
                          'auto.components.settings.TaskSourceGiteaSetup.verified',
                          'Verified'
                        )}
                      </span>
                    ) : null}
                    {testResult?.state === 'error' ? (
                      <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span className="truncate">{testResult.error}</span>
                      </span>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTest(site.id)}
                      disabled={testing}
                    >
                      {testing ? (
                        <>
                          <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                          {translate(
                            'auto.components.settings.TaskSourceGiteaSetup.testing',
                            'Testing...'
                          )}
                        </>
                      ) : (
                        translate('auto.components.settings.TaskSourceGiteaSetup.test', 'Test')
                      )}
                    </Button>
                    <button
                      onClick={() => void handleRemove(site.id)}
                      aria-label={translate(
                        'auto.components.settings.TaskSourceGiteaSetup.removeSite',
                        'Remove {{value0}}',
                        { value0: site.baseUrl }
                      )}
                      className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                    >
                      <Unlink className="size-3.5" />
                    </button>
                  </div>
                )
              })}
              <p className="text-[11px] text-muted-foreground/70">
                {translate(
                  'auto.components.settings.TaskSourceGiteaSetup.tokenNote',
                  'Each site token is stored by the secret store, never in settings.'
                )}
              </p>
            </div>
          ) : null}
        </TaskSourceStepRow>
        <TaskSourceShowInTasksStep
          index={2}
          providerLabel={translate('auto.components.settings.TasksPane.giteaLabel', 'Gitea')}
          visible={visible}
          canHide={canHide}
          onToggleVisible={onToggleVisible}
        />
      </ol>
      <GiteaAddSiteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sites={sites}
        onSitesChange={onSitesChange}
      />
    </>
  )
}

function GiteaAddSiteDialog({
  open,
  onOpenChange,
  sites,
  onSitesChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites: GiteaSite[]
  onSitesChange: (sites: GiteaSite[]) => void
}): React.JSX.Element {
  const mountedRef = useMountedRef()
  const baseUrlId = useId()
  const tokenId = useId()
  const errorId = useId()
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Start every open with a clean slate so a previously-typed secret or a
  // stale error can't linger across reopens.
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    setBaseUrl('')
    setToken('')
    setConnecting(false)
    setConnectError(null)
  }, [open])

  const canSubmit = Boolean(baseUrl.trim()) && Boolean(token.trim()) && !connecting

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!connecting) {
      onOpenChange(nextOpen)
    }
  }

  const handleSave = async (): Promise<void> => {
    const trimmedBaseUrl = baseUrl.trim()
    const trimmedToken = token.trim()
    if (!trimmedBaseUrl || !trimmedToken || connecting) {
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      // Why: main validates the token with GET /user and stores it in the
      // secret store; the renderer only persists the returned site metadata.
      const result = await window.api.gitea.saveSite({
        baseUrl: trimmedBaseUrl,
        token: trimmedToken
      })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        onSitesChange([result.site, ...sites.filter((site) => site.id !== result.site.id)])
        setBaseUrl('')
        setToken('')
        setConnecting(false)
        onOpenChange(false)
        return
      }
      setConnecting(false)
      setConnectError(result.error)
    } catch (error) {
      if (mountedRef.current) {
        setConnecting(false)
        setConnectError(error instanceof Error ? error.message : 'Connection failed')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3">
          <DialogTitle className="leading-tight">
            {translate(
              'auto.components.settings.TaskSourceGiteaSetup.dialogTitle',
              'Connect Gitea site'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.settings.TaskSourceGiteaSetup.dialogDescription',
              'Use a Gitea or Forgejo host URL and a personal access token to browse issues.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor={baseUrlId} className="text-xs">
                {translate(
                  'auto.components.settings.TaskSourceGiteaSetup.hostLabel',
                  'Gitea host URL'
                )}
              </Label>
              <Input
                id={baseUrlId}
                autoFocus
                placeholder={translate(
                  'auto.components.settings.TaskSourceGiteaSetup.hostPlaceholder',
                  'https://gitea.example.com'
                )}
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value)
                  setConnectError(null)
                }}
                disabled={connecting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={tokenId} className="text-xs">
                {translate(
                  'auto.components.settings.TaskSourceGiteaSetup.tokenLabel',
                  'Personal access token'
                )}
              </Label>
              <Input
                id={tokenId}
                type="password"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value)
                  setConnectError(null)
                }}
                disabled={connecting}
                aria-invalid={connectError !== null}
                aria-describedby={connectError ? errorId : undefined}
              />
            </div>
            {connectError ? (
              <p id={errorId} className="text-xs text-destructive">
                {connectError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={connecting}
            >
              {translate('auto.components.settings.TaskSourceGiteaSetup.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {connecting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {translate(
                    'auto.components.settings.TaskSourceGiteaSetup.verifying',
                    'Verifying…'
                  )}
                </>
              ) : (
                translate(
                  'auto.components.settings.TaskSourceGiteaSetup.testAndSave',
                  'Test & Save'
                )
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
