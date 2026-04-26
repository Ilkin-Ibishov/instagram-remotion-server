/**
 * Normalises a news article URL so deduplication is reliable across
 * GNews API variants, edge-cases, and HTTP/HTTPS mixtures.
 *
 * Rules applied (order matters):
 *  1. Lowercase the entire URL.
 *  2. Prefer https over http (normalise scheme).
 *  3. Strip the trailing slash on the path.
 *  4. Remove tracking / UTM query parameters that do not change content.
 *  5. Remove the fragment (#…) — it is never part of the canonical resource.
 *  6. Remove the `www.` subdomain so "www.bbc.com" and "bbc.com" collapse.
 */

const IGNORED_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'source', 'fbclid', 'gclid', 'mc_cid', 'mc_eid',
]);

export function normalizeArticleUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  let url: URL;
  try {
    // Lowercase before parsing so host/scheme normalisation is consistent.
    url = new URL(rawUrl.toLowerCase().trim());
  } catch {
    // Not a valid URL — return original so we do not silently discard it.
    return rawUrl;
  }

  // Rule 2: normalise scheme to https.
  url.protocol = 'https:';

  // Rule 6: strip www. subdomain.
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
  }

  // Rule 4: remove tracking params.
  for (const key of [...url.searchParams.keys()]) {
    if (IGNORED_PARAMS.has(key)) {
      url.searchParams.delete(key);
    }
  }

  // Rule 5: remove fragment.
  url.hash = '';

  // Rule 3: strip trailing slash on the pathname.
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  return url.toString();
}
