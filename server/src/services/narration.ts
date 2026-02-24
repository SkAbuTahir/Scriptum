import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AudioSegmentData, NarrationJob } from '../types';

const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────────

async function generateWithElevenLabs(
  text: string,
  voiceId: string
): Promise<{ buffer: Buffer; duration: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(
    url,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60_000,
    }
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  // Estimate duration: average 150 words/min, ~5 chars/word
  const estimatedWords = text.split(/\s+/).length;
  const duration = (estimatedWords / 150) * 60;

  return { buffer, duration };
}

// ─── Google TTS ───────────────────────────────────────────────────────────────

async function generateWithGoogle(text: string): Promise<{ buffer: Buffer; duration: number }> {
  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_KEY is not configured');

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const response = await axios.post(
    url,
    {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    },
    { timeout: 30_000 }
  );

  const audioContent = (response.data as { audioContent: string }).audioContent;
  const buffer = Buffer.from(audioContent, 'base64');

  const estimatedWords = text.split(/\s+/).length;
  const duration = (estimatedWords / 150) * 60;

  return { buffer, duration };
}

// ─── Save audio file ──────────────────────────────────────────────────────────

function saveAudioFile(buffer: Buffer): { fileName: string; audioUrl: string; localPath: string } {
  const fileName = `${uuidv4()}.mp3`;
  const localPath = path.join(AUDIO_DIR, fileName);
  fs.writeFileSync(localPath, buffer);

  const audioUrl = `/uploads/audio/${fileName}`;
  return { fileName, audioUrl, localPath };
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generateNarrationForSentence(
  job: NarrationJob,
  sentenceIndex: number
): Promise<AudioSegmentData> {
  const voiceId =
    job.voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  let buffer: Buffer;
  let duration: number;

  if (job.provider === 'elevenlabs') {
    ({ buffer, duration } = await generateWithElevenLabs(job.text, voiceId));
  } else if (job.provider === 'google') {
    ({ buffer, duration } = await generateWithGoogle(job.text));
  } else {
    throw new Error(`Unknown TTS provider: ${job.provider}`);
  }

  const { audioUrl } = saveAudioFile(buffer);

  return {
    documentId: job.documentId,
    sentenceText: job.text,
    audioUrl,
    duration,
  };
}

// ─── Batch generation ─────────────────────────────────────────────────────────

export async function generateNarrationBatch(
  documentId: string,
  sentences: string[],
  provider: 'elevenlabs' | 'google' = 'elevenlabs',
  onProgress?: (completed: number, total: number) => void
): Promise<AudioSegmentData[]> {
  const results: AudioSegmentData[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const job: NarrationJob = {
      documentId,
      text: sentences[i],
      provider,
    };

    try {
      const segment = await generateNarrationForSentence(job, i);
      results.push(segment);
    } catch (err) {
      console.error(`Failed to generate audio for sentence ${i}:`, err);
      // Continue with other sentences
    }

    onProgress?.(i + 1, sentences.length);

    // Rate limiting: small delay between requests
    if (i < sentences.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
