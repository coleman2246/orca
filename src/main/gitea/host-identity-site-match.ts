function hostnameOf(host: string): string {
  return host.replace(/:\d+$/, '')
}

// Why: mirrors knownHostMatches in ../gitlab/project-ref-parser.ts, with the
// leniency direction reversed. There, the *known* entry is commonly the
// portless one (a bare GitLab hostname) and leniency is granted when IT
// lacks a port. Here, a repo's host identity is commonly the portless one —
// any ssh/scp remote drops its transport port (see hostIdentityFromUrl in
// repository-ref.ts) — while a stored Gitea site is recorded with its real
// port. So leniency is granted when the *repo*'s identity lacks a port: it
// then matches a stored site on the same hostname regardless of the site's
// port. A repo identity that carries a port (any http(s) remote) must match
// a site's host:port exactly, so two different services on one host (e.g. a
// GitLab on :8443 and a Gitea on :3030) are never conflated.
function hostIdentityMatches(repoHostIdentity: string, siteHost: string): boolean {
  if (repoHostIdentity === siteHost) {
    return true
  }
  if (hostnameOf(repoHostIdentity) === repoHostIdentity) {
    return hostnameOf(siteHost) === repoHostIdentity
  }
  return false
}

/**
 * Match a repo's host identity against stored sites, ignoring path. Used as
 * the fallback when `matchGiteaSite`'s exact origin+path match fails — the
 * case for an ssh/scp remote, whose `GiteaRepoRef.apiBaseUrl`/`webBaseUrl`
 * are only a guessed `https://<hostname>` origin, never authoritative.
 * When more than one stored site matches the same host identity (e.g. two
 * Gitea sites on one hostname at different ports), the first in `sites`
 * wins — same "first/registered order" precedence `getSiteFile` already
 * gives the active site, not a new uniqueness rule.
 */
export function matchGiteaSiteByHostIdentity<T extends { baseUrl: string }>(
  hostIdentity: string,
  sites: T[]
): T | null {
  for (const site of sites) {
    let siteUrl: URL
    try {
      siteUrl = new URL(site.baseUrl)
    } catch {
      continue
    }
    if (hostIdentityMatches(hostIdentity, siteUrl.host)) {
      return site
    }
  }
  return null
}

type HostIdentityRepo = { apiBaseUrl: string; webBaseUrl: string; hostIdentity: string }

/**
 * getGiteaSiteForRepo's full match order: `matchByOrigin` (exact origin +
 * longest-prefix path — correct for http(s) remotes, including subpaths)
 * against the repo's guessed api/web base, then the host-identity fallback
 * above for ssh/scp remotes whose guessed base is never authoritative.
 * `matchByOrigin` is passed in (rather than imported) so this module never
 * imports back from site-credential-store.ts, which imports this one.
 */
export function resolveGiteaSiteForRepo<T extends { baseUrl: string }>(
  repo: HostIdentityRepo,
  sites: T[],
  matchByOrigin: (url: string, sites: T[]) => T | null
): T | null {
  return (
    matchByOrigin(repo.apiBaseUrl, sites) ??
    matchByOrigin(repo.webBaseUrl, sites) ??
    matchGiteaSiteByHostIdentity(repo.hostIdentity, sites)
  )
}
