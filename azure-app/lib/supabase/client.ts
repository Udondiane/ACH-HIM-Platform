/**
 * Browser-side client. Client components in HIM mainly use this for
 * auth session hooks; data reads and writes go through server actions.
 * Kept under /lib/supabase/client so existing imports resolve; guts
 * are the Azure adapter — see /lib/azure/client.ts.
 */

import { createAzureClient, type AzureClient } from '@/lib/azure/client';

export function createClient(): AzureClient {
  return createAzureClient();
}
