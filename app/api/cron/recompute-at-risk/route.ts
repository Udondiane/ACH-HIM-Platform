import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/* Cron endpoint to refresh rule-based at-risk flags. Call via Vercel
   Cron daily, or schedule via Supabase pg_cron and skip this route.

   Security: requires the CRON_SECRET header to match the env var.
   Vercel sets this on Vercel-scheduled cron requests automatically;
   for manual calls pass the header explicitly. */

export async function GET(req: NextRequest) {
  // Fail closed: without a configured secret we refuse the request.
  // Previously this checked `if (expected)` — a missing env var meant
  // the block was skipped entirely and anyone could mutate at-risk flags.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured on this deployment' },
      { status: 503 },
    );
  }
  const got = req.headers.get('authorization') ?? req.headers.get('x-cron-secret');
  if (got !== `Bearer ${expected}` && got !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('recompute_at_risk_flags' as never);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const arr = data as unknown as Array<{ updated_count: number }> | null;
  const updated = arr && arr.length > 0 ? arr[0].updated_count : 0;
  return NextResponse.json({ ok: true, updated, ran_at: new Date().toISOString() });
}
