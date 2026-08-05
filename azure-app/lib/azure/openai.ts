/**
 * Shared Azure OpenAI wiring for the four AI routes.
 *
 * The individual routes already read the same env vars; this helper
 * centralises the URL-building + env-check so future routes stay
 * consistent and so a local-dev fallback (direct OpenAI, no Azure) is
 * a single-line switch.
 *
 * Env selection:
 *   AZURE_OPENAI_API_KEY       — Azure resource key
 *   AZURE_OPENAI_ENDPOINT      — e.g. https://ach-openai-uksouth.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT    — chat/completions deployment name
 *   AZURE_OPENAI_WHISPER_DEPLOYMENT — audio deployment name
 *   AZURE_OPENAI_API_VERSION   — optional, defaults to 2024-08-01-preview
 *
 * Local-dev fallback (only when Azure is not configured):
 *   USE_DIRECT_OPENAI=true
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_MODEL=gpt-4o-mini
 *   OPENAI_WHISPER_MODEL=whisper-1
 */

const DEFAULT_VERSION = '2024-08-01-preview';

export interface OpenAiConfig {
  kind: 'azure' | 'direct-openai';
  apiKey: string;
  endpoint: string;                 // fully-qualified URL to POST to
  headers: Record<string, string>;
  bodyModel?: string;               // set for direct-OpenAI; omitted for Azure (deployment is in URL)
}

function useDirectFallback(): boolean {
  return process.env.USE_DIRECT_OPENAI === 'true' && Boolean(process.env.OPENAI_API_KEY);
}

export function getChatConfig(): OpenAiConfig | { kind: 'not-configured'; error: string } {
  const key = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const version = process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_VERSION;

  if (key && endpoint && deployment) {
    return {
      kind: 'azure',
      apiKey: key,
      endpoint: `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(version)}`,
      headers: { 'api-key': key, 'Content-Type': 'application/json' },
    };
  }

  if (useDirectFallback()) {
    return {
      kind: 'direct-openai',
      apiKey: process.env.OPENAI_API_KEY!,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      bodyModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    };
  }

  return {
    kind: 'not-configured',
    error: 'AI is not configured. Set AZURE_OPENAI_* env vars (production) or USE_DIRECT_OPENAI=true with OPENAI_API_KEY (local dev).',
  };
}

export function getWhisperConfig(): OpenAiConfig | { kind: 'not-configured'; error: string } {
  const key = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
  const version = process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_VERSION;

  if (key && endpoint && deployment) {
    return {
      kind: 'azure',
      apiKey: key,
      endpoint: `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/audio/transcriptions?api-version=${encodeURIComponent(version)}`,
      headers: { 'api-key': key },
    };
  }

  if (useDirectFallback()) {
    return {
      kind: 'direct-openai',
      apiKey: process.env.OPENAI_API_KEY!,
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      bodyModel: process.env.OPENAI_WHISPER_MODEL ?? 'whisper-1',
    };
  }

  return {
    kind: 'not-configured',
    error: 'Voice transcription is not configured. Set AZURE_OPENAI_WHISPER_DEPLOYMENT (production) or USE_DIRECT_OPENAI=true with OPENAI_API_KEY (local dev).',
  };
}
