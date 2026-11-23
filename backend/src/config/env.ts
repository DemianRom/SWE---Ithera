import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SECRET_KEY: string;
  PORT: number;
  NODE_ENV: string;
  FRONTEND_URL: string;
  SHARE_LINK_SECRET: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variable de entorno requerida no encontrada: ${key}`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const env: EnvConfig = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SECRET_KEY: requireEnv('SUPABASE_SECRET_KEY'),
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // Firma los enlaces públicos del itinerario. Obligatoria en producción.
  SHARE_LINK_SECRET:
    NODE_ENV === 'production'
      ? requireEnv('SHARE_LINK_SECRET')
      : process.env.SHARE_LINK_SECRET || 'traveling-dev-share-link-secret',
};
