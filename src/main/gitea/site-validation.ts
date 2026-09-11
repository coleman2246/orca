import { normalizeGiteaApiBaseUrl } from './client'
import { getSiteFile, readToken, readUserAccount } from './site-credential-store'

// Why: site-credential-store.ts is at the max-lines lint budget, so the
// setup card's per-site Test action lives here — same main-process trust
// boundary, token never leaves.
export async function testGiteaSite(
  id: string
): Promise<{ ok: true; account: string | null } | { ok: false; error: string }> {
  const site = getSiteFile().sites.find((entry) => entry.id === id)
  if (!site) {
    return { ok: false, error: 'Gitea site not found.' }
  }
  let token: string | null
  try {
    token = readToken(id)
  } catch {
    return { ok: false, error: 'Stored Gitea credential could not be decrypted.' }
  }
  if (!token) {
    return { ok: false, error: 'No stored token for this Gitea site.' }
  }
  return readUserAccount(normalizeGiteaApiBaseUrl(site.baseUrl), token)
}
