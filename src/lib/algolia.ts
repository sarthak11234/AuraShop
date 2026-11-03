import { algoliasearch, type Algoliasearch } from 'algoliasearch';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? '';
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? '';
const adminKey = process.env.ALGOLIA_ADMIN_KEY ?? '';

export const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME ?? 'vexo_products';

/**
 * True only when both public Algolia credentials are present.
 * When false the UI shows a "search offline" state instead of crashing on
 * algoliasearch()'s empty-credentials error.
 */
export const isAlgoliaConfigured = Boolean(appId && searchKey);

/**
 * Public search client — safe to use in client components.
 * Only has read access (Search-Only API Key).
 * Returns null when Algolia is not configured.
 */
let cachedSearchClient: Algoliasearch | null = null;

export function getSearchClient(): Algoliasearch | null {
  if (!isAlgoliaConfigured) return null;
  if (!cachedSearchClient) {
    cachedSearchClient = algoliasearch(appId, searchKey);
  }
  return cachedSearchClient;
}

/**
 * Admin client — SERVER SIDE ONLY.
 * Used only in API routes for indexing / syncing products.
 * Returns null when the admin key is missing.
 */
export function getAdminClient(): Algoliasearch | null {
  if (!appId || !adminKey) return null;
  return algoliasearch(appId, adminKey);
}
