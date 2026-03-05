import { createClient } from '@deepgram/sdk';
import axios from 'axios';

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client:    ReturnType<typeof createClient> | null = null;
let _cachedKey: string | undefined;

function getClient(): ReturnType<typeof createClient> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY is not set in .env file');
  // Re-create client if key changed (e.g. after .env hot-reload)
  if (!_client || _cachedKey !== key) {
    _client    = createClient(key);
    _cachedKey = key;
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
  const projectId = process.env.DEEPGRAM_PROJECT_ID;
  if (!projectId) {
    throw new Error('DEEPGRAM_PROJECT_ID is not set in .env file. Get it from https://console.deepgram.com/');
  }

  const client = getClient();

  // Create a temporary key with limited scope
  const response = await client.manage.createProjectKey(
    projectId,
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
// Uses Deepgram REST API directly so we can check HTTP status before streaming.
// Returns a Node.js ReadableStream suitable for piping to an Express response.

export async function streamTTS(text: string, model = 'aura-2-draco-en'): Promise<NodeJS.ReadableStream> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY is not set');

  const response = await axios.post(
    `https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`,
    { text },
    {
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: 60_000,
      validateStatus: null, // don't throw on non-2xx — we'll check manually
    },
  );

  if (response.status !== 200) {
    // Drain the error body so we can surface a useful message
    const chunks: Buffer[] = [];
    for await (const chunk of response.data as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    throw new Error(body || `Deepgram TTS error: HTTP ${response.status}`);
  }

  return response.data as NodeJS.ReadableStream;
}
