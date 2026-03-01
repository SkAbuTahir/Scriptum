import { createClient } from '@deepgram/sdk';
import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;

function getClient(): ReturnType<typeof createClient> {
  if (!_client) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY is not set');
    _client = createClient(key);
  }
  return _client;
}

// ─── Temporary key generation ─────────────────────────────────────────────────
// Generates a short-lived Deepgram API key scoped to transcription only.
// The frontend uses this key — our primary key is never exposed.

export interface TempKeyResult {
  key: string;
  expiresAt: string;
}

export async function generateTempKey(ttlSeconds = 900): Promise<TempKeyResult> {
  const client = getClient();

  // Create a temporary key with limited scope
  const response = await client.manage.createProjectKey(
    process.env.DEEPGRAM_PROJECT_ID as string,
    {
      comment: 'teleprompter-session',
      scopes: ['usage:write'],
      time_to_live_in_seconds: ttlSeconds,
    },
  );

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return {
    key: (response.result as { key: string }).key,
    expiresAt,
  };
}

// ─── TTS streaming ────────────────────────────────────────────────────────────
// Uses the official SDK speak.request() pattern.
// Returns a Node.js ReadableStream suitable for piping to an Express response.

export async function streamTTS(text: string, model = 'aura-2-draco-en'): Promise<NodeJS.ReadableStream> {
  const client = getClient();

  const response = await client.speak.request(
    { text },
    { model },
  );

  const webStream = await response.getStream();
  if (!webStream) throw new Error('Deepgram TTS returned no stream');

  // Convert Web ReadableStream → Node PassThrough so Express can pipe it
  const pass = new PassThrough();
  pipeline(webStream as unknown as NodeJS.ReadableStream, pass).catch(() => {
    pass.destroy();
  });

  return pass;
}
