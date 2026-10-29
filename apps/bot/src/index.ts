import { validateConfig, config } from './config.js';
import { createTelegramBot } from './bot.js';

async function bootstrap() {
  console.log('==============================================');
  console.log('🤖 INICIANDO ECOSISTEMA AGENTE - FISEI UTA 2026');
  console.log('==============================================');

  validateConfig();

  if (!config.telegramBotToken) {
    console.error('❌ ERROR CRÍTICO: No se encontró TELEGRAM_BOT_TOKEN en .env');
    console.log('Configura las variables de entorno en apps/bot/.env para iniciar.');
    return;
  }

  const bot = createTelegramBot();

  console.log('🚀 Iniciando bot en modo Polling para desarrollo local...');
  bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot conectado exitosamente como @${botInfo.username}`);
      console.log('Listo para recibir mensajes de prospectos y pruebas del jurado.');
    }
  });
}

bootstrap().catch((err) => {
  console.error('Fatal crash on bootstrap:', err);
});
