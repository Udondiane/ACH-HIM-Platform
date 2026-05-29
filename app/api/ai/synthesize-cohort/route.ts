import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/* Cohort narrative synthesis. Pulls every observable_changes /
   practices / narrative text for the cohort's assessments and asks
   Azure OpenAI to extract themes, sentiment summary and notable
   patterns. Saves the result to cohort_narrative_synthesis so the
   Capability Investor Report can attach it. */

export async function POST(req: NextRequest) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';
  if (!apiKey || !endpoint || !deployment) {
    return NextResponse.json({ ok: false, error: 'Azure OpenAI not configured' }, { status: 503 });
  }

  let body: { cohortId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 }); }
  if (!body.cohortId) return NextResponse.json({ ok: false, error: 'Missing cohortId' }, { status: 400 });

  const supabase = createClient();

  const { data: responsesRes } = await supabase
    .from('assessment_responses')
    .select(`
      observable_changes, practices, narrative,
      assessments!inner(timepoint, candidates(country_of_origin))
    `)
    .eq('assessments.cohort_id', body.cohortId);
  const responses = (responsesRes as any[]) ?? [];

  const texts: string[] = [];
  for (const r of responses) {
    if (r.observable_changes) texts.push(`[${r.assessments?.timepoint}] OBSERVABLE: ${r.observable_changes}`);
    if (r.practices) texts.push(`[${r.assessments?.timepoint}] PRACTICES: ${r.practices}`);
    if (r.narrative) texts.push(`[${r.assessments?.timepoint}] NARRATIVE: ${r.narrative}`);
  }
  if (texts.length < 3) {
    return NextResponse.json({ ok: false, error: 'Not enough narrative text in this cohort to synthesise (need at least 3 narrative entries).' }, { status: 400 });
  }

  const corpus = texts.slice(0, 200).join('\n').slice(0, 25_000);

  const systemPrompt = `You are an evaluation analyst summarising the qualitative evidence from a refugee employability programme cohort. Identify themes, sentiment, and notable patterns from caseworker-recorded observable changes, practices and narratives. Be specific to what is in the text; never fabricate. Output JSON with three fields:
- themes: an array of up to 6 themes, each an object {label: string, evidence_summary: string, frequency: 'low'|'medium'|'high'}
- sentiment_summary: 1-2 sentences capturing the overall emotional tone of the cohort's reflections
- notable_patterns: an array of up to 3 sentences highlighting cross-cutting patterns worth a caseworker's attention`;

  const userPrompt = `Cohort narrative corpus (${texts.length} entries):
"""
${corpus}
"""

Return ONLY a JSON object with keys: themes, sentiment_summary, notable_patterns.`;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });
    const completion = await client.chat.completions.create({
      model: deployment,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? '{}';
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return NextResponse.json({ ok: false, error: 'AI returned unparseable JSON' }, { status: 502 }); }

    const { data: user } = await supabase.auth.getUser();
    await supabase.from('cohort_narrative_synthesis').insert({
      cohort_id: body.cohortId,
      themes: parsed.themes ?? [],
      sentiment_summary: parsed.sentiment_summary ?? null,
      source_count: texts.length,
      generated_by: user.user?.id ?? null,
    } as never);

    return NextResponse.json({ ok: true, synthesis: parsed, sourceCount: texts.length });
  } catch (e: any) {
    console.error('[ai/synthesize-cohort] error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'AI request failed' }, { status: 500 });
  }
}
