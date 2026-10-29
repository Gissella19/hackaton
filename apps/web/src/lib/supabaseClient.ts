import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

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
    client = createClient(rawUrl, rawKey);
  } catch (err) {
    console.warn('[supabaseClient] Failed to initialize Supabase client:', err);
    client = null;
  }
}

export const supabase = client;
