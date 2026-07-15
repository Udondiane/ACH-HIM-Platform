import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface ScoreFactorBody {
  assessmentId: string;
  factorId: string;
  assessorScore: number | null;
}

interface AiSuggestion {
  suggested_score: number | null;
  rationale: string;
  evidence_quotes: string[];
  indicators_not_evidenced: string[];
  confidence: 'low' | 'medium' | 'high';
}

const PROMPT_VERSION = 'score-factor.v1';

/**
 * AI scoring assist for a single factor.
 *
 * The assessor has already produced their own independent score. This route
 * runs the AI over the transcript for that factor and returns a suggested
 * score plus rationale. The two are then compared in the UI. The assessor
 * is the decision-maker; the AI is a second opinion for calibration.
 *
 * Consent-gated: if the candidate has not consented to AI transcript
 * analysis (candidate_consent.may_ai_analyse_transcript), the AI is skipped
 * and a suggestion row is written with status='skipped_no_consent'.
 */
export async function POST(req: NextRequest) {
  const apiKey     = process.env.AZURE_OPENAI_API_KEY;
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';

  if (!apiKey || !endpoint || !deployment) {
    return NextResponse.json(
      { ok: false, error: 'AI scoring not configured on server.' },
      { status: 503 },
    );
  }

  let body: ScoreFactorBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.assessmentId || !body.factorId) {
    return NextResponse.json({ ok: false, error: 'Missing assessmentId or factorId' }, { status: 400 });
  }

  const supabase = createClient();

  // Load assessment, factor, indicators, transcript, and consent in parallel.
  const [assessmentRes, factorRes, indicatorsRes, transcriptRes] = await Promise.all([
    supabase.from('assessments').select('id, candidate_id').eq('id', body.assessmentId).maybeSingle(),
    supabase
      .from('factors')
      .select('id, name, measurement_question, behavioural_prompt, measurement_method')
      .eq('id', body.factorId)
      .maybeSingle(),
    supabase
      .from('indicators')
      .select('name, sort_order')
      .eq('factor_id', body.factorId)
      .order('sort_order'),
    supabase
      .from('assessment_factor_responses')
      .select('response_text, captured_via')
      .eq('assessment_id', body.assessmentId)
      .eq('factor_id', body.factorId)
      .maybeSingle(),
  ]);
  if (!assessmentRes.data) return NextResponse.json({ ok: false, error: 'Assessment not found' }, { status: 404 });
  if (!factorRes.data)     return NextResponse.json({ ok: false, error: 'Factor not found' },     { status: 404 });

  const assessment = assessmentRes.data as { id: string; candidate_id: string };
  const factor = factorRes.data as {
    id: string;
    name: string;
    measurement_question: string | null;
    behavioural_prompt: string | null;
    measurement_method: string;
  };
  const bullets = ((indicatorsRes.data as { name: string }[]) ?? []).map(i => i.name);
  const transcript = transcriptRes.data as { response_text: string | null; captured_via: string } | null;
  const transcriptText = transcript?.response_text ?? '';
  const transcriptSource = (transcript?.captured_via as 'typed' | 'voice' | 'voice_edited' | undefined) ?? 'none';

  // Consent check. Read latest consent row.
  const consentRes = await supabase
    .from('candidate_consent')
    .select('may_ai_analyse_transcript, given_at')
    .eq('candidate_id', assessment.candidate_id)
    .order('given_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestConsent = consentRes.data as { may_ai_analyse_transcript?: boolean } | null;
  const hasConsent = !!latestConsent?.may_ai_analyse_transcript;

  if (!hasConsent) {
    await recordSuggestion(supabase, {
      assessment_id: body.assessmentId,
      factor_id: body.factorId,
      assessor_score_at_ai_time: body.assessorScore,
      ai_suggested_score: null,
      ai_rationale: null,
      ai_evidence_quotes: null,
      ai_confidence: null,
      model_version: deployment,
      prompt_version: PROMPT_VERSION,
      transcript_source: 'none',
      transcript_char_count: 0,
      status: 'skipped_no_consent',
      error_message: null,
    });
    return NextResponse.json({ ok: true, status: 'skipped_no_consent' });
  }

  if (!transcriptText || transcriptText.trim().length === 0) {
    await recordSuggestion(supabase, {
      assessment_id: body.assessmentId,
      factor_id: body.factorId,
      assessor_score_at_ai_time: body.assessorScore,
      ai_suggested_score: null,
      ai_rationale: null,
      ai_evidence_quotes: null,
      ai_confidence: null,
      model_version: deployment,
      prompt_version: PROMPT_VERSION,
      transcript_source: 'none',
      transcript_char_count: 0,
      status: 'skipped_no_transcript',
      error_message: null,
    });
    return NextResponse.json({ ok: true, status: 'skipped_no_transcript' });
  }

  const bulletList = bullets.length > 0
    ? bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : '(no observable indicators supplied for this factor)';

  const systemPrompt = `You are a careful evaluation analyst supporting a HIM (Holistic Impact Metric) assessor. You independently review a candidate's response to a specific factor and produce a suggested score, so the assessor has a second opinion to compare against their own.

Rules:
- Score on the scale defined by the measurement method (0-5 for likert_1_5, 0-5 for count/checklist, 0 or 5 for yes_no).
- Ground every claim in specific quotes from the transcript. Never fabricate evidence.
- If the transcript does not evidence an observable indicator, list it as "not_evidenced" rather than assuming.
- Confidence: 'low' if the transcript barely addresses the factor, 'medium' if partial evidence, 'high' if clear direct evidence.
- Return ONLY JSON. No markdown. No preamble.`;

  const userPrompt = `Factor: ${factor.name}
Measurement method: ${factor.measurement_method}
Measurement question asked: ${factor.measurement_question ?? '(none specified)'}
Behavioural prompt: ${factor.behavioural_prompt ?? '(none specified)'}

Observable indicators to look for:
${bulletList}

Candidate's response transcript (source: ${transcriptSource}):
"""
${transcriptText.slice(0, 20_000)}
"""

Return JSON:
{
  "suggested_score": number | null,
  "rationale": "one paragraph explaining the score",
  "evidence_quotes": ["quote 1", "quote 2"],
  "indicators_not_evidenced": ["indicator text 1"],
  "confidence": "low" | "medium" | "high"
}`;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });

    const completion = await client.chat.completions.create({
      model: deployment,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    let parsed: AiSuggestion;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned unparseable response');
      parsed = JSON.parse(m[0]);
    }

    const score = typeof parsed.suggested_score === 'number' && parsed.suggested_score >= 0 && parsed.suggested_score <= 5
      ? parsed.suggested_score
      : null;
    const confidence = (['low', 'medium', 'high'] as const).includes(parsed.confidence)
      ? parsed.confidence
      : 'low';
    const evidence = Array.isArray(parsed.evidence_quotes)
      ? parsed.evidence_quotes.filter((q): q is string => typeof q === 'string').slice(0, 10)
      : [];
    const notEvidenced = Array.isArray(parsed.indicators_not_evidenced)
      ? parsed.indicators_not_evidenced.filter((q): q is string => typeof q === 'string').slice(0, 10)
      : [];
    const rationale = String(parsed.rationale ?? '').slice(0, 3000);

    await recordSuggestion(supabase, {
      assessment_id: body.assessmentId,
      factor_id: body.factorId,
      assessor_score_at_ai_time: body.assessorScore,
      ai_suggested_score: score,
      ai_rationale: rationale,
      ai_evidence_quotes: { quotes: evidence, not_evidenced: notEvidenced },
      ai_confidence: confidence,
      model_version: deployment,
      prompt_version: PROMPT_VERSION,
      transcript_source: transcriptSource,
      transcript_char_count: transcriptText.length,
      status: 'completed',
      error_message: null,
    });

    return NextResponse.json({
      ok: true,
      status: 'completed',
      suggestion: {
        suggested_score: score,
        rationale,
        evidence_quotes: evidence,
        indicators_not_evidenced: notEvidenced,
        confidence,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI request failed';
    console.error('[ai/score-factor] error', e);
    await recordSuggestion(supabase, {
      assessment_id: body.assessmentId,
      factor_id: body.factorId,
      assessor_score_at_ai_time: body.assessorScore,
      ai_suggested_score: null,
      ai_rationale: null,
      ai_evidence_quotes: null,
      ai_confidence: null,
      model_version: deployment,
      prompt_version: PROMPT_VERSION,
      transcript_source: transcriptSource,
      transcript_char_count: transcriptText.length,
      status: 'failed',
      error_message: msg.slice(0, 500),
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

type SupabaseLike = ReturnType<typeof createClient>;

async function recordSuggestion(
  supabase: SupabaseLike,
  row: {
    assessment_id: string;
    factor_id: string;
    assessor_score_at_ai_time: number | null;
    ai_suggested_score: number | null;
    ai_rationale: string | null;
    ai_evidence_quotes: unknown;
    ai_confidence: 'low' | 'medium' | 'high' | null;
    model_version: string;
    prompt_version: string;
    transcript_source: 'typed' | 'voice' | 'voice_edited' | 'none';
    transcript_char_count: number;
    status: 'completed' | 'skipped_no_consent' | 'skipped_no_transcript' | 'failed';
    error_message: string | null;
  },
) {
  await supabase.from('ai_score_suggestions').insert(row as never);
}
