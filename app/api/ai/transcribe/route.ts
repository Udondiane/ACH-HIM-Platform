import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Audio → text transcription backed by Azure OpenAI Whisper.
 *
 * Required env vars (set in Vercel project settings):
 *   AZURE_OPENAI_API_KEY                 - same key as the analyze-transcript route
 *   AZURE_OPENAI_ENDPOINT                - e.g. https://ach-openai-uksouth.openai.azure.com
 *   AZURE_OPENAI_WHISPER_DEPLOYMENT      - deployment name for a Whisper model
 *                                          (e.g. "whisper" or "whisper-1")
 *   AZURE_OPENAI_API_VERSION             - optional, defaults to 2024-08-01-preview
 *
 * Why a separate deployment from the chat one: Whisper is a different model
 * family on Azure and gets its own deployment. The text deployment (gpt-4o-*)
 * cannot transcribe audio.
 *
 * Accepts: multipart/form-data with fields:
 *   audio (Blob)        - the recorded audio (webm/opus, mp3, m4a, wav all work)
 *   language (string?)  - ISO 639-1 hint for the spoken language; "auto" or
 *                         omitted lets Whisper detect
 *
 * Returns: { ok: true, text: string, language: string | null } on success.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview';

  if (!apiKey || !endpoint || !deployment) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Voice transcription is not configured. ACH admin: set AZURE_OPENAI_WHISPER_DEPLOYMENT in environment.',
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid multipart body' }, { status: 400 });
  }

  const audio = form.get('audio');
  const languageRaw = (form.get('language') as string | null) ?? null;

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'audio file missing' }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ ok: false, error: 'audio file is empty' }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'audio file exceeds 25 MB' }, { status: 413 });
  }

  // Build the form-data the Azure endpoint expects. Whisper accepts the same
  // payload shape as the public OpenAI API behind a different URL.
  const azureForm = new FormData();
  azureForm.append('file', audio, audioFilename(audio.type));
  if (languageRaw && languageRaw !== 'auto') azureForm.append('language', languageRaw);
  azureForm.append('response_format', 'verbose_json');

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/audio/transcriptions?api-version=${encodeURIComponent(apiVersion)}`;

  let azureRes: Response;
  try {
    azureRes = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey },
      body: azureForm,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Upstream fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  if (!azureRes.ok) {
    const detail = await safeText(azureRes);
    return NextResponse.json(
      { ok: false, error: `Whisper API ${azureRes.status}: ${detail}` },
      { status: 502 },
    );
  }

  let payload: { text?: string; language?: string };
  try {
    payload = await azureRes.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Whisper returned non-JSON' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    text: (payload.text ?? '').trim(),
    language: payload.language ?? null,
  });
}

function audioFilename(mime: string): string {
  if (mime.includes('webm')) return 'recording.webm';
  if (mime.includes('ogg')) return 'recording.ogg';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'recording.mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'recording.m4a';
  if (mime.includes('wav')) return 'recording.wav';
  return 'recording.webm';
}

async function safeText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 300); } catch { return '(no body)'; }
}
