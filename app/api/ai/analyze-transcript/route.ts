import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface AnalyzeBody {
  assessmentId: string;
  transcript: string;
  scope: 'all' | { indicatorIds: string[] };
}

interface PerIndicatorSuggestion {
  indicatorId: string;
  numericValue: number | null;
  observableChanges: string;
  practices: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * AI transcript analysis backed by Azure OpenAI.
 *
 * Required env vars (set in Vercel project settings):
 *   AZURE_OPENAI_API_KEY        - the API key from your Azure OpenAI resource
 *   AZURE_OPENAI_ENDPOINT       - e.g. https://ach-openai-uksouth.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT     - the deployment name you set in Azure
 *                                 (e.g. "gpt-4o-mini" or "ach-assistant")
 *   AZURE_OPENAI_API_VERSION    - optional, defaults to 2024-08-01-preview
 *
 * Why Azure OpenAI rather than the public OpenAI API or Gemini:
 *   - UK South / UK West data residency available
 *   - Microsoft signs a Data Processing Agreement, useful for the
 *     refugee-data DPIA the IKEA pilot needs
 *   - Microsoft for Nonprofits typically supplies Azure credit so
 *     this is effectively free for the pilot
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';

  if (!apiKey || !endpoint || !deployment) {
    return NextResponse.json(
      {
        ok: false,
        error: 'AI transcript analysis is not configured. ACH admin: set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT in environment.',
      },
      { status: 503 },
    );
  }

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.assessmentId || !body.transcript) {
    return NextResponse.json({ ok: false, error: 'Missing assessmentId or transcript' }, { status: 400 });
  }
  if (body.transcript.length > 30_000) {
    return NextResponse.json({ ok: false, error: 'Transcript too long (max 30,000 chars)' }, { status: 413 });
  }

  const supabase = createClient();

  const { data: assessment } = await supabase
    .from('assessments').select('project_id, candidate_id').eq('id', body.assessmentId).maybeSingle();
  if (!assessment) {
    return NextResponse.json({ ok: false, error: 'Assessment not found' }, { status: 404 });
  }
  const a = assessment as any;

  const [caps, factors, factorDomains, indicators] = await Promise.all([
    supabase.from('project_capabilities').select('domain, role').eq('project_id', a.project_id),
    supabase.from('factors').select('id, name, conversion_factor_type, is_universal, measurement_method'),
    supabase.from('factor_domains').select('factor_id, domain_id'),
    supabase.from('indicators').select('id, factor_id, name'),
  ]);

  const capDomains = new Set(((caps.data as any[]) ?? []).map(c => c.domain));
  const factorsById = new Map(((factors.data as any[]) ?? []).map(f => [f.id, f]));
  const factorDomainList = (factorDomains.data as any[]) ?? [];
  const factorBelongsToCapDomain = new Set<string>();
  for (const fd of factorDomainList) {
    if (capDomains.has(fd.domain_id)) factorBelongsToCapDomain.add(fd.factor_id);
  }

  let relevantIndicators = ((indicators.data as any[]) ?? []).filter(i => factorBelongsToCapDomain.has(i.factor_id));
  if (typeof body.scope === 'object' && body.scope.indicatorIds?.length) {
    const allow = new Set(body.scope.indicatorIds);
    relevantIndicators = relevantIndicators.filter(i => allow.has(i.id));
  }

  const indicatorList = relevantIndicators.map(i => {
    const f = factorsById.get(i.factor_id);
    return `- ${i.id} :: ${i.name} (factor: ${f?.name ?? '?'}, method: ${f?.measurement_method ?? '?'})`;
  }).join('\n');

  const systemPrompt = `You are a careful evaluation analyst for ACH, a UK charity supporting refugees. You read interview transcripts from caseworker conversations with refugees and extract evidence against the HIM capability framework.

For each indicator below, output:
- numericValue: integer 0-5 if evidence supports a score; null if no evidence found
- observableChanges: 1-2 sentences describing concrete changes mentioned in the transcript (empty string if none)
- practices: 1-2 sentences describing what the candidate is doing or being supported with (empty string if none)
- confidence: "low" | "medium" | "high" based on how directly the transcript addresses the indicator

Never fabricate evidence. If the transcript does not address an indicator, set numericValue to null and leave text empty.

Return ONLY a JSON object with a single field "suggestions" containing the array. No markdown, no commentary.`;

  const userPrompt = `Indicators to assess:
${indicatorList}

Transcript:
"""
${body.transcript}
"""

Return JSON: {"suggestions": [{"indicatorId": string, "numericValue": number|null, "observableChanges": string, "practices": string, "confidence": "low"|"medium"|"high"}]}`;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });

    const completion = await client.chat.completions.create({
      // Azure expects an empty model field; it routes by deployment name in the URL
      model: deployment,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    let parsed: { suggestions: PerIndicatorSuggestion[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return NextResponse.json({ ok: false, error: 'AI returned unparseable response' }, { status: 502 });
      parsed = JSON.parse(m[0]);
    }
    const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const allowedIds = new Set(relevantIndicators.map(i => i.id));
    const suggestions = suggestionsRaw
      .filter(s => s && typeof s.indicatorId === 'string' && allowedIds.has(s.indicatorId))
      .map(s => ({
        indicatorId: s.indicatorId,
        numericValue: typeof s.numericValue === 'number' && s.numericValue >= 0 && s.numericValue <= 5 ? s.numericValue : null,
        observableChanges: String(s.observableChanges ?? '').slice(0, 1000),
        practices: String(s.practices ?? '').slice(0, 1000),
        confidence: ['low','medium','high'].includes(s.confidence as any) ? s.confidence : 'low',
      }));
    return NextResponse.json({ ok: true, suggestions });
  } catch (e: any) {
    console.error('[ai/analyze-transcript] Azure OpenAI error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'AI request failed' }, { status: 500 });
  }
}
