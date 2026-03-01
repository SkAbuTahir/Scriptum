/**
 * Validates that all required environment variables are set at startup.
 * Fails fast with a clear error message if any are missing.
 */

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
] as const;

const OPTIONAL_VARS = [
  { key: 'GEMINI_API_KEY',      warn: 'AI analysis will be disabled' },
  { key: 'TEXTGEARS_API_KEY',   warn: 'Readability fallback to local Flesch only' },
  { key: 'RAPIDAPI_KEY',        warn: 'Twinword tone analysis disabled, Gemini used instead' },
  { key: 'CLIENT_URL',          warn: 'CORS will default to http://localhost:3000' },
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error('❌  Missing required environment variables:');
    missing.forEach((k) => console.error(`   - ${k}`));
    console.error('\nPlease set them in your .env file and restart the server.');
    process.exit(1);
  }

  // Warn about optional vars
  for (const { key, warn } of OPTIONAL_VARS) {
    if (!process.env[key]?.trim()) {
      console.warn(`⚠️  ${key} not set — ${warn}`);
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.warn('⚠️  JWT_SECRET is shorter than 32 characters — consider using a stronger secret in production');
  }

  console.log('✅  Environment variables validated');
}
