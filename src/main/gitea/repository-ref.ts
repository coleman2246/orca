import { createRemoteRefProbeCache } from '../git/remote-ref-probe-cache'

export type GiteaRepoRef = {
  host: string
  /**
   * Host identity used to match a stored Gitea site, mirroring
   * `hostIdentityFromUrl` in `../gitlab/project-ref-parser.ts`: `host:port`
   * for http(s) remotes (the URL port IS the web/API endpoint), bare
   * hostname for ssh/git/scp-like remotes (the port is a transport port,
   * e.g. `:2222`, that says nothing about the instance).
   */
  hostIdentity: string
  owner: string
  repo: string
  apiBaseUrl: string
  webBaseUrl: string
}

type LocalGitExecOptions = {
  wslDistro?: string
}

const KNOWN_NON_GITEA_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'dev.azure.com',
  'ssh.dev.azure.com'
])
const repoRefProbeCache = createRemoteRefProbeCache(parseGiteaRepoRef)

/** @internal - exposed for tests only */
export function _resetGiteaRepoRefCache(): void {
  repoRefProbeCache.clear()
}

/** @internal - exposed for tests only */
export function _getGiteaRepoRefCacheSize(): number {
  return repoRefProbeCache.size()
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parsePath(pathname: string): { owner: string; repo: string; basePath: string } | null {
  const withoutSuffix = pathname.replace(/\/+$/, '').replace(/\.git$/i, '')
  const parts = withoutSuffix
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) {
    return null
  }

  const owner = decodeSegment(parts.at(-2) ?? '')
  const repo = decodeSegment(parts.at(-1) ?? '')
  if (!owner || !repo) {
    return null
  }

  return {
    owner,
    repo,
    basePath: parts.slice(0, -2).join('/')
  }
}

function apiBaseUrlFromWebBase(webBaseUrl: string): string {
  return `${webBaseUrl.replace(/\/+$/, '')}/api/v1`
}

// Why: mirrors hostIdentityFromUrl in ../gitlab/project-ref-parser.ts. For
// http(s) remotes the URL port IS the web/API endpoint (a self-hosted
// instance on a nonstandard port), so it is kept. For ssh/git remotes the
// port is a transport port (e.g. ssh on :2222) that does not identify the
// Gitea instance, so it is dropped and only the hostname is used.
function hostIdentityFromUrl(url: URL): string {
  const protocol = url.protocol.toLowerCase()
  if (protocol === 'http:' || protocol === 'https:') {
    return url.host
  }
  return url.hostname
}

function makeRepoRef(
  host: string,
  hostIdentity: string,
  path: string,
  webOrigin: string
): GiteaRepoRef | null {
  const normalizedHost = host.toLowerCase()
  if (
    !normalizedHost ||
    KNOWN_NON_GITEA_HOSTS.has(normalizedHost) ||
    normalizedHost.endsWith('.visualstudio.com')
  ) {
    return null
  }

  const parsed = parsePath(path)
  if (!parsed) {
    return null
  }

  // Why: Gitea/Forgejo can be hosted below a URL subpath. SSH-style remotes
  // carry that base path in the repo path, so derive the web/API base here.
  // This is only a best-effort default: the real web/API base for a repo
  // matched to a stored site comes from that site's own baseUrl (see
  // getGiteaSiteForRepo in site-credential-store.ts), because an ssh/scp
  // remote's host has no way to say which scheme or port the instance's
  // web UI actually uses.
  const webBaseUrl = parsed.basePath
    ? `${webOrigin.replace(/\/+$/, '')}/${parsed.basePath}`
    : webOrigin
  return {
    host: normalizedHost,
    hostIdentity: hostIdentity.toLowerCase(),
    owner: parsed.owner,
    repo: parsed.repo,
    apiBaseUrl: apiBaseUrlFromWebBase(webBaseUrl),
    webBaseUrl
  }
}

export function parseGiteaRepoRef(remoteUrl: string): GiteaRepoRef | null {
  const trimmed = remoteUrl.trim()
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const scpLike = trimmed.match(/^(?:[^@/:]+@)?([^:\s/]+):([^\s]+?)(?:\.git)?$/)
    if (scpLike) {
      const host = scpLike[1]
      const path = scpLike[2]
      return makeRepoRef(host, host, path, `https://${host.toLowerCase()}`)
    }
  }

  try {
    const url = new URL(trimmed)
    const protocol = url.protocol.toLowerCase()
    if (!['http:', 'https:', 'ssh:', 'git+ssh:'].includes(protocol)) {
      return null
    }

    const parsed = parsePath(url.pathname)
    if (!parsed) {
      return null
    }

    const webOrigin =
      protocol === 'http:' || protocol === 'https:'
        ? `${protocol}//${url.host}`
        : `https://${url.hostname.toLowerCase()}`
    return makeRepoRef(url.hostname, hostIdentityFromUrl(url), url.pathname, webOrigin)
  } catch {
    return null
  }
}

export async function getGiteaRepoRefForRemote(
  repoPath: string,
  remoteName: string,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<GiteaRepoRef | null> {
  return repoRefProbeCache.get(repoPath, remoteName, connectionId, localGitOptions)
}

export async function getGiteaRepoRef(
  repoPath: string,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<GiteaRepoRef | null> {
  return getGiteaRepoRefForRemote(repoPath, 'origin', connectionId, localGitOptions)
}
