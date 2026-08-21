import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkRateLimit, ipFromHeaders, rateLimitedResponse } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

/**
 * Auto-triage a candidate voice utterance to decide whether it's
 * worth promoting into the featured-quotes library. Reduces the
 * assessor's cognitive load — they don't have to remember to mark
 * something as featured-worthy; the LLM does a first pass and
 * surfaces a suggestion.
 *
 * Never auto-inserts into featured_quotes. Only returns a suggestion
 * with reasoning + confidence — the assessor still clicks to confirm.
 * That keeps consent gating (may_be_named / may_be_quoted) in one
 * place: the existing createFeaturedQuoteAction.
 *
 * Backed by Azure OpenAI to preserve UK data residency and the same
 * DPIA posture as the transcript analyser.
 */
interface TriageBody {
  text: string;
  context?: {
    timepoint?: string;              // baseline / mid_3mo / exit_6mo / followup_12mo
    activities?: string[];           // e.g. ["English classes", "Employability coaching"]
    projectName?: string;
  };
}

interface TriageResult {
  isFeatureWorthy: boolean;
  confidence: 'low' | 'medium' | 'high';
  reason: string;                    // short explanation the assessor can trust
  suggestedQuote: string;            // trimmed / lightly-cleaned version fit for a report
  themes: string[];                  // 1–3 short tags: e.g. ["belonging", "confidence", "employment"]
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit({
    ip: ipFromHeaders(req.headers),
    key: 'ai:triage-quote',
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return rateLimitedResponse(rl);

  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';

  if (!apiKey || !endpoint || !deployment) {
    return NextResponse.json(
      {
        ok: false,
        error: 'AI quote triage is not configured. ACH admin: set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT.',
      },
      { status: 503 },
    );
  }

  let body: TriageBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ ok: false, error: 'text too long (max 4000 chars)' }, { status: 413 });

  // Below ~15 words there's usually not enough substance to feature.
  // Save an API call and short-circuit to a low-confidence "no".
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 15) {
    return NextResponse.json({
      ok: true,
      result: {
        isFeatureWorthy: false,
        confidence: 'high',
        reason: 'Too short to carry the specificity a featured quote needs (under 15 words).',
        suggestedQuote: text,
        themes: [],
      } satisfies TriageResult,
    });
  }

  const contextLine = [
    body.context?.timepoint && `Timepoint: ${body.context.timepoint}`,
    body.context?.projectName && `Project: ${body.context.projectName}`,
    body.context?.activities && body.context.activities.length > 0
      && `Activities: ${body.context.activities.join(', ')}`,
  ].filter(Boolean).join(' · ');

  const systemPrompt = `You are helping ACH — a UK charity supporting refugees into work — decide whether a candidate's own words are worth featuring in an outcomes report or grant application.

A quote is FEATURE-WORTHY when it:
  - Names a concrete change ("I got a job", "I applied for my first interview", "I made a friend at English class")
  - Carries emotional specificity ("I stopped being scared to speak", "I feel like Bristol is my home now")
  - Reveals cause and effect ("Because of the coaching I know how to write a CV")
  - Uses vivid or unusual phrasing that would land in a report

A quote is NOT feature-worthy when it:
  - Is generic ("It was good", "I liked it", "Thank you")
  - Is administrative ("I attended three sessions")
  - Is only a plan/hope with no anchor to change ("I want to get a job")
  - Is confused, contradictory, or too short to stand alone

Always err toward NOT featuring on doubt — feature-worthiness is precious, not routine. Keep the suggested quote in the candidate's exact words; only strip filler ("um", "you know") and fix obvious transcription typos.

Themes must come from this list: employment, education, english_language, confidence, belonging, community, family, mental_health, housing, rights, health, independence, identity, safety.

Return ONLY a JSON object matching this shape:
{
  "isFeatureWorthy": boolean,
  "confidence": "low" | "medium" | "high",
  "reason": "one-sentence explanation for the assessor",
  "suggestedQuote": "cleaned but faithful version of the quote",
  "themes": ["max 3 short tags from the allowed list"]
}`;

  const userPrompt = `${contextLine ? contextLine + '\n\n' : ''}Candidate said:
"""
${text}
"""

Decide feature-worthiness. Return JSON only.`;

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
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    let parsed: Partial<TriageResult>;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return NextResponse.json({ ok: false, error: 'AI returned unparseable response' }, { status: 502 });
      parsed = JSON.parse(m[0]);
    }

    const allowedThemes = new Set(['employment','education','english_language','confidence','belonging','community','family','mental_health','housing','rights','health','independence','identity','safety']);
    const result: TriageResult = {
      isFeatureWorthy: Boolean(parsed.isFeatureWorthy),
      confidence: (['low','medium','high'] as const).includes(parsed.confidence as any)
        ? (parsed.confidence as TriageResult['confidence'])
        : 'low',
      reason: String(parsed.reason ?? '').slice(0, 400),
      suggestedQuote: String(parsed.suggestedQuote ?? text).slice(0, 800),
      themes: Array.isArray(parsed.themes)
        ? parsed.themes.map(t => String(t)).filter(t => allowedThemes.has(t)).slice(0, 3)
        : [],
    };
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error('[ai/triage-quote] Azure OpenAI error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'AI request failed' }, { status: 500 });
  }
}
