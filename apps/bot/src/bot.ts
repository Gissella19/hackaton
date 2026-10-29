/**
 * Telegram Bot Configuration
 *
 * Responsabilidad Única (SRP):
 * Configuración de la instancia de grammY y registro de eventos de mensajería (texto y voz),
 * delegando la acumulación a DebounceQueue y la ejecución a MessageHandler.
 */

import { Bot } from 'grammy';
import { config } from './config.js';
import { debounceQueue } from './core/debounceQueue.js';
import { voiceService } from './services/voice.service.js';
import { getOrCreateChat, saveMessage } from './services/supabase.service.js';
import { handleConsolidatedMessage } from './handlers/message.handler.js';

export function createTelegramBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Comando /start
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from?.username;
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Prospecto';

    await getOrCreateChat({
      chatId,
      username,
      fullName
    });

    const welcome = `¡Hola ${fullName}! 👋 Te doy la bienvenida al Centro de Transferencia y Capacitación Tecnológica (CTT) de la FISEI - UTA.\n\nContamos con programas oficiales en Python, Inteligencia Artificial y JavaScript con certificación CISCO y universitaria. ¿En qué temática te gustaría especializarte?`;

    await ctx.reply(welcome);

    await saveMessage({
      chatId,
      sender: 'ai',
      content: welcome
    });
  });

  // Manejo de Mensajes de Texto con Buffer Debounce
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();
    const username = ctx.from?.username;
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Prospecto';

    // Asegurar registro inicial del chat
    await getOrCreateChat({
      chatId,
      username,
      fullName
    });

    // Encolar en el buffer anti-ametralladora (espera 1.5s antes de disparar)
    debounceQueue.enqueue(chatId, text, async (consolidatedText) => {
      await handleConsolidatedMessage({
        bot,
        chatId,
        text: consolidatedText
      });
    });
  });

  // Manejo de Notas de Voz (Multimodal Audio con Gemini)
  bot.on('message:voice', async (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from?.username;
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Prospecto';

    await getOrCreateChat({
      chatId,
      username,
      fullName
    });

    try {
      await ctx.replyWithChatAction('typing');

      // 1. Obtener la ruta del archivo de voz desde Telegram API
      const voiceFile = await ctx.getFile();
      if (!voiceFile.file_path) {
        throw new Error('No se pudo obtener la ruta del archivo de audio de Telegram');
      }

      // 2. Descargar el archivo .ogg en memoria
      const audioBuffer = await voiceService.downloadTelegramVoice(voiceFile.file_path);

      // 3. Transcribir a texto con Gemini Multimodal
      const transcription = await voiceService.transcribeVoiceBuffer(audioBuffer);

      console.log(`[Audio Transcrito] Chat #${chatId}: "${transcription}"`);

      // 4. Pasar la transcripción por la cola de debounce y el flujo unificado
      debounceQueue.enqueue(chatId, `[Audio]: ${transcription}`, async (consolidatedText) => {
        await handleConsolidatedMessage({
          bot,
          chatId,
          text: consolidatedText,
          isVoice: true
        });
      });
    } catch (err) {
      console.error('[BotVoice] Error procesando nota de voz:', err);
      await ctx.reply('⚠️ No pude procesar tu mensaje de voz en este momento. Por favor envíamelo en texto mientras lo reviso.');
    }
  });

  return bot;
}
