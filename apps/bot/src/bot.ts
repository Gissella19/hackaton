import { Bot } from 'grammy';
import { config } from './config.js';
import { inspectInputHeuristics } from './services/guardrail.service.js';
import { processProspectMessage } from './services/gemini.service.js';
import {
  getChatControlMode,
  getOrCreateConversation,
  recordSecurityIncident,
  saveMessage,
  updateConversationState
} from './services/supabase.service.js';

export function createTelegramBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Comando /start
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const fromName = ctx.from?.first_name || 'Prospecto';

    const conversation = await getOrCreateConversation(chatId, fromName);
    const welcome = `¡Hola ${fromName}! 👋 Te doy la bienvenida al Centro de Capacitación Tecnológica FISEI - UTA.\n\nContamos con programas intensivos en Desarrollo Web Fullstack, Inteligencia Artificial y Cloud/DevOps. ¿En qué área te gustaría potenciarte hoy?`;

    await ctx.reply(welcome);

    if (conversation) {
      await saveMessage({
        conversationId: conversation.id,
        senderType: 'AI',
        content: welcome
      });
    }
  });

  // Manejo de mensajes de texto
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();
    const fromName = ctx.from?.first_name || 'Prospecto';

    // 1. Obtener o crear conversación
    const conversation = await getOrCreateConversation(chatId, fromName);
    const conversationId = conversation?.id;

    // 2. CHECK DE ESTADO A 0 MS: ¿Está en modo HUMAN?
    const currentMode = await getChatControlMode(chatId);
    if (currentMode === 'HUMAN') {
      console.log(`[Handover] Chat ${chatId} en modo HUMAN. La IA se congela. Mensaje enviado al Dashboard.`);
      if (conversationId) {
        await saveMessage({
          conversationId,
          senderType: 'USER',
          content: text
        });
      }
      return; // Corta la ejecución. La IA ni se ejecuta ni gasta tokens.
    }

    // 3. Guardar mensaje del usuario
    if (conversationId) {
      await saveMessage({
        conversationId,
        senderType: 'USER',
        content: text
      });
    }

    // 4. ESCUDO ANTI-INYECCIÓN (Fase 1: Heurística Pre-Inferencia)
    const heuristicCheck = inspectInputHeuristics(text);
    if (heuristicCheck.isBlocked) {
      console.warn(`[Seguridad] Ataque bloqueado en chat ${chatId}: ${heuristicCheck.reason}`);

      if (conversationId) {
        await recordSecurityIncident({
          conversationId,
          attackType: heuristicCheck.attackType,
          rawInput: text,
          severity: 'HIGH'
        });

        await updateConversationState({
          conversationId,
          telegramChatId: chatId,
          securityAlert: `[Alerta de Ataque: ${heuristicCheck.attackType}] ${heuristicCheck.reason}`,
          leadStatus: 'DOUBTFUL'
        });
      }

      await ctx.reply(
        '⚠️ Aviso: Las políticas y precios de nuestros programas académicos son inalterables. Si necesitas una consulta personalizada sobre opciones de financiamiento oficiales, puedo comunicarte con un asesor académico.'
      );
      return;
    }

    // 5. INFERENCIA CON GEMINI 3.8 FLASH + STRUCTURED OUTPUT
    await ctx.replyWithChatAction('typing');

    const decision = await processProspectMessage({
      userInput: text,
      leadMemory: conversation?.lead_memory as Record<string, unknown> | undefined
    });

    // 6. Post-evaluación de seguridad detectada por el modelo
    if (decision.security_audit.is_attack && conversationId) {
      await recordSecurityIncident({
        conversationId,
        attackType: decision.security_audit.attack_type,
        rawInput: text,
        severity: 'HIGH'
      });
    }

    // 7. Enviar respuesta generada al usuario
    await ctx.reply(decision.reply_to_user);

    // 8. Actualizar estado y memoria en Supabase
    if (conversationId) {
      await saveMessage({
        conversationId,
        senderType: 'AI',
        content: decision.reply_to_user
      });

      const nextControlMode = decision.should_trigger_handover ? 'HUMAN' : 'AI';

      await updateConversationState({
        conversationId,
        telegramChatId: chatId,
        controlMode: nextControlMode,
        leadStatus: decision.lead_status,
        sentimentScore: decision.sentiment_score,
        securityAlert: decision.security_audit.is_attack
          ? `[Seguridad: ${decision.security_audit.attack_type}] ${decision.security_audit.attack_reason}`
          : null,
        leadMemory: decision.prospect_profile
      });
    }
  });

  // Manejo de Notas de Voz (Multimodal)
  bot.on('message:voice', async (ctx) => {
    const chatId = ctx.chat.id;
    const fromName = ctx.from?.first_name || 'Prospecto';

    const conversation = await getOrCreateConversation(chatId, fromName);
    const conversationId = conversation?.id;

    const notice = '🎙️ Recibí tu nota de voz. Nuestro asistente multimodal está analizando tu consulta...';
    await ctx.reply(notice);

    if (conversationId) {
      await saveMessage({
        conversationId,
        senderType: 'USER',
        content: '[Nota de voz de Telegram]',
        isVoice: true
      });
    }
  });

  return bot;
}
