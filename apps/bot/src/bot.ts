/**
 * Telegram Bot Configuration
 *
 * Responsabilidad Única (SRP):
 * Configuración de la instancia de grammY y registro de eventos de mensajería (texto y voz/audio),
 * delegando la acumulación a DebounceQueue y la ejecución a MessageHandler.
 */

import { Bot } from 'grammy';
import { config } from './config.js';
import { debounceQueue } from './core/debounceQueue.js';
import { voiceService } from './services/voice.service.js';
import { enrollmentService } from './services/enrollment.service.js';
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

  // Comandos /pdf, /inscripcion, /matricula, /ordendepago
  bot.command(['pdf', 'inscripcion', 'matricula', 'ordendepago'], async (ctx) => {
    const chatId = ctx.chat.id;
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'Prospecto';

    await ctx.replyWithChatAction('upload_document');
    await enrollmentService.sendEnrollmentPdfToChat({
      bot,
      chatId,
      userFullNameFallback: fullName
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

  // Manejo de Notas de Voz y Audios (Multimodal Audio con Gemini)
  bot.on(['message:voice', 'message:audio'], async (ctx) => {
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

      // 1. Obtener la ruta del archivo de audio desde Telegram API
      const file = await ctx.getFile();
      if (!file.file_path) {
        throw new Error('No se pudo obtener la ruta del archivo de audio de Telegram');
      }

      const audioUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
      const mimeType = voiceService.detectAudioMime(file.file_path);

      // 2. Descargar el archivo binario en memoria
      const audioBuffer = await voiceService.downloadTelegramVoice(file.file_path);

      // 3. Transcribir a texto con Gemini Multimodal
      const transcription = await voiceService.transcribeVoiceBuffer(audioBuffer, mimeType);

      console.log(`[Audio Transcrito] Chat #${chatId} (${mimeType}): "${transcription}"`);

      // 4. Pasar la transcripción por la cola de debounce con las mismas reglas de seguridad y persistencia
      debounceQueue.enqueue(chatId, transcription, async (consolidatedText) => {
        await handleConsolidatedMessage({
          bot,
          chatId,
          text: consolidatedText,
          isVoice: true,
          audioUrl
        });
      });
    } catch (err) {
      console.error('[BotVoice] Error procesando audio:', err);
      await ctx.reply('⚠️ No pude procesar con claridad tu mensaje de voz. Por favor envíamelo en texto mientras verifico el audio.');
    }
  });

  return bot;
}
