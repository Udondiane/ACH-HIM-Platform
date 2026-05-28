import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'AI transcript analysis is not configured. Set GEMINI_API_KEY in environment.' },
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

  // Load the assessment's project capabilities and all relevant indicators.
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

  /* Build the prompt. We give Gemini the list of indicators with their
     measurement method and ask for a structured JSON response with a
     score, observable_changes, practices, and confidence for each. */
  const indicatorList = relevantIndicators.map(i => {
    const f = factorsById.get(i.factor_id);
    return `- ${i.id} :: ${i.name} (factor: ${f?.name ?? '?'}, method: ${f?.measurement_method ?? '?'})`;
  }).join('\n');

  const systemPrompt = `You are a careful evaluation analyst for ACH (Ashley Community), a charity supporting refugees in the UK. You read interview transcripts from caseworker conversations with refugees and extract evidence against the HIM capability framework.

For each indicator below, output:
- numericValue: integer 0-5 if evidence supports a score; null if no evidence found
- observableChanges: 1-2 sentences describing concrete changes mentioned in the transcript (empty string if none)
- practices: 1-2 sentences describing what the candidate is doing or being supported with (empty string if none)
- confidence: "low" | "medium" | "high" based on how directly the transcript addresses the indicator

Never fabricate evidence. If the transcript does not address an indicator, set numericValue to null and leave text empty.

Output ONLY a JSON array, no markdown fences, no commentary.`;

  const userPrompt = `Indicators to assess:
${indicatorList}

Transcript:
"""
${body.transcript}
"""

Return a JSON array of objects with shape:
{"indicatorId": string, "numericValue": number|null, "observableChanges": string, "practices": string, "confidence": "low"|"medium"|"high"}`;

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const r = await model.generateContent(userPrompt);
    const text = r.response.text();
    let parsed: PerIndicatorSuggestion[];
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to recover from any extra text
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) return NextResponse.json({ ok: false, error: 'AI returned unparseable response' }, { status: 502 });
      parsed = JSON.parse(m[0]);
    }
    // Defensive trimming
    const allowedIds = new Set(relevantIndicators.map(i => i.id));
    const suggestions = parsed
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
    console.error('[ai/analyze-transcript] error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'AI request failed' }, { status: 500 });
  }
}
