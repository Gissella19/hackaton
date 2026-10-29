import { validateConfig, config } from './config.js';
import { createTelegramBot } from './bot.js';
import { stateCache } from './core/stateCache.js';
import { getSupabase } from './services/supabase.service.js';
import { startOperatorServer } from './api/operator.server.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🤖 PERSONA 2: CONTROLADOR DE TRÁFICO Y TELEFONISTA');
  console.log('   FISEI UTA 2026 - SISTEMA CONVERSACIONAL HÍBRIDO');
  console.log('====================================================');

  validateConfig();

  // 1. Inicializar Sincronización Realtime del Semáforo en RAM (0 ms)
  const supabase = getSupabase();
  if (supabase) {
    await stateCache.initRealtimeStateSync(supabase);
  } else {
    console.warn('[Bootstrap] AVISO: Supabase no conectado. El semáforo funcionará en memoria local.');
  }

  // 2. Inicializar Bot de Telegram (grammY)
  if (!config.telegramBotToken) {
    console.warn('⚠️ AVISO: Falta TELEGRAM_BOT_TOKEN en .env. Configúralo para iniciar la recepción de mensajes.');
    return;
  }

  const bot = createTelegramBot();

  // 3. Inicializar Servidor HTTP del Operador para Handover (POST /api/operator/send)
  const operatorPort = Number(process.env.OPERATOR_SERVER_PORT) || 3001;
  startOperatorServer(bot, operatorPort);

  // 4. Iniciar Polling de Telegram
  console.log('🚀 Iniciando conexión de Telegram en modo Polling...');
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Conectado exitosamente como @${botInfo.username}`);
      console.log('   - Debounce Buffer: ACTIVO (1.5s)');
      console.log('   - Semáforo en RAM: ACTIVO (0 ms)');
      console.log('   - Traductor de Voz: LISTO');
      console.log(`   - Canal Operador: LISTO en http://localhost:${operatorPort}/api/operator/send`);
      console.log('====================================================');
    }
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error en bootstrap:', err);
});
