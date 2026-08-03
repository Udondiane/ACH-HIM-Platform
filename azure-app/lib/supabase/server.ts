/**
 * Server-side data client.
 *
 * File retained at /lib/supabase/server.ts so the ~500 existing
 * `import { createClient } from '@/lib/supabase/server'` call sites
 * work without touching them. Under the hood: the Azure-native adapter
 * (Postgres + Blob + Entra ID) — see /lib/azure/client.ts.
 */

import { createAzureClient, type AzureClient } from '@/lib/azure/client';

export type ServerClient = AzureClient;

export function createClient(): AzureClient {
  return createAzureClient();
}

/**
 * Service-role client. Under the Azure adapter this returns the same
 * client because Postgres role enforcement lives on the DATABASE_URL
 * user, not in a separate service key. Kept as a distinct export so
 * callers still signal admin intent, and so ACH can wire a stronger
 * DB user or managed identity in future without touching call sites.
 */
export function createServiceClient(): AzureClient {
  return createAzureClient();
}
