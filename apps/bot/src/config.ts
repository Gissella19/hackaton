import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Cargar .env de la raíz o de apps/bot
dotenv.config();

const botEnv = path.resolve(process.cwd(), 'apps/bot/.env');
if (fs.existsSync(botEnv)) {
  dotenv.config({ path: botEnv });
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
  isProduction: process.env.NODE_ENV === 'production'
};

export function validateConfig() {
  const missing: string[] = [];
  if (!config.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!config.geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseKey) missing.push('SUPABASE_KEY');

  if (missing.length > 0) {
    console.warn(`[Config] AVISO: Faltan variables de entorno: ${missing.join(', ')}`);
  }
}
