import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project configuration for Hackathon FISEI UTA 2026
const DEFAULT_SUPABASE_URL = 'https://ytohpzpmexlqsngmnczb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_y7ocEyzuHSOy_u8YySOilQ_YvTcwlIm';

const rawUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL
).trim();

const rawKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  process.env.SUPABASE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY
).trim();

function isValidSupabaseConfig(url: string, key: string): boolean {
  if (!url || !key) return false;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return false;
  if (
    url.includes('tu-proyecto.supabase.co') ||
    url.includes('xyzproject.supabase.co') ||
    key === 'TU_SUPABASE_ANON_KEY'
  ) {
    return false;
  }
  return true;
}

export const isSupabaseConfigured = isValidSupabaseConfig(rawUrl, rawKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(rawUrl, rawKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  } catch (err) {
    console.warn('[supabaseClient] Failed to initialize Supabase client:', err);
    client = null;
  }
}

export const supabase = client;
