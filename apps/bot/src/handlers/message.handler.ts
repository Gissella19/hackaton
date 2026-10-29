/**
 * MessageHandler — "Orquestador del flujo conversacional"
 *
 * Responsabilidad Única (SRP):
 * Ejecutar la secuencia lógica cuando un mensaje (o ráfaga debounced) está listo:
 * 1. Check del semáforo a 0 ms (`stateCache.isAiPaused`).
 * 2. Persistencia del mensaje entrante en Supabase (soporta notas de voz).
 * 3. Ejecución de guardrails heurísticos anti-inyección (mismo rigor para audio y texto).
 * 4. Carga de memoria conversacional y entidades del prospecto (`memoryService`).
 * 5. Inferencia contextualizada con Gemini y búsqueda vectorial RAG.
 * 6. Despacho de la respuesta oficial a Telegram.
 * 7. Persistencia de la respuesta y actualización de memoria acumulativa.
 */

import { Bot } from 'grammy';
import { stateCache } from '../core/stateCache.js';
import { inspectInputHeuristics } from '../services/guardrail.service.js';
import { processProspectMessage } from '../services/gemini.service.js';
import { memoryService } from '../services/memory.service.js';
import { enrollmentService } from '../services/enrollment.service.js';
import {
  saveMessage,
  updateChatMetadata,
  logSecurityIncident
} from '../services/supabase.service.js';

export async function handleConsolidatedMessage(params: {
  bot: Bot;
  chatId: number;
  text: string;
  isVoice?: boolean;
  audioUrl?: string;
}): Promise<void> {
  const { bot, chatId, text, isVoice, audioUrl } = params;

  // 1. SEMÁFORO EN RAM (0 ms reales): ¿La IA está pausada por el operador?
  if (stateCache.isAiPaused(chatId)) {
    console.log(`[Handover Activo] Chat #${chatId} atendido por humano. IA en silencio. Guardando mensaje...`);
    await saveMessage({
      chatId,
      sender: 'user',
      content: text,
      audioUrl
    });
    return; // Corte inmediato. Cero tokens y cero interrupciones al operador humano.
  }

  // 2. Persistir mensaje del usuario en la base de datos (con audioUrl si vino por voz)
  await saveMessage({
    chatId,
    sender: 'user',
    content: text,
    audioUrl
  });

  // 3. ESCUDO ANTI-INYECCIÓN (Fase Heurística 0 ms aplicada a texto limpio)
  const cleanInput = text.replace(/^\[Audio\]:\s*/i, '').trim();
  const heuristic = inspectInputHeuristics(cleanInput);
  if (heuristic.isBlocked) {
    console.warn(
      `[Seguridad] Bloqueo en chat #${chatId} (${isVoice ? 'Audio' : 'Texto'}): ${heuristic.reason}`
    );

    await logSecurityIncident({
      chatId,
      attackType: heuristic.attackType,
      rawInput: text,
      severity: heuristic.severity || 'HIGH'
    });

    await updateChatMetadata({
      chatId,
      securityFlag: true,
      securityReason: `[Heurística: ${heuristic.attackType}] ${heuristic.reason}`,
      sentiment: 'dudoso'
    });

    const replyText =
      heuristic.diplomaticReply ||
      '⚠️ Aviso institucional: Los precios y normativas de los programas CTT-FISEI son de carácter oficial e inalterables. Si requieres atención personalizada, con gusto te comunico con coordinación académica.';

    await bot.api.sendMessage(chatId, replyText);

    await saveMessage({
      chatId,
      sender: 'ai',
      content: replyText
    });
    return;
  }

  // 4. Indicador de "Escribiendo..." en Telegram
  await bot.api.sendChatAction(chatId, 'typing');

  // 5. Cargar memoria conversacional completa (corto y largo plazo)
  const context = await memoryService.loadConversationContext(chatId);

  // 6. Inferencia contextual con Gemini + RAG augmentado
  const decision = await processProspectMessage({
    userInput: cleanInput,
    context
  });

  // 7. Registro si el LLM detectó un intento de ataque sofisticado
  if (decision.security_audit.is_attack) {
    await logSecurityIncident({
      chatId,
      attackType: decision.security_audit.attack_type,
      rawInput: text,
      severity: 'HIGH'
    });
  }

  // 8. Enviar la respuesta oficial por Telegram
  await bot.api.sendMessage(chatId, decision.reply_to_user);

  // 9. Persistir respuesta de la IA en la base de datos
  await saveMessage({
    chatId,
    sender: 'ai',
    content: decision.reply_to_user
  });

  // 10. Despacho proactivo de PDF si el prospecto solicita su orden de pago o ficha
  const wantsPdf =
    /(pdf|orden\s+de\s+pago|ficha\s+de\s+inscripci|ficha\s+t[eé]cnica|comprobante|formulario\s+de\s+inscripci)/i.test(
      cleanInput
    ) ||
    /(dame|envia|enviar|envíame|manda|mandar|mándame|puedes\s+darme|quiero|descargar|generar|pásame|pasame|adjunta|facilita)[\s\w]*(pdf|orden|ficha|comprobante)/i.test(
      cleanInput
    );

  if (wantsPdf) {
    console.log(`[MessageHandler] Prospecto #${chatId} solicitó PDF oficial. Generando y despachando...`);
    await enrollmentService.sendEnrollmentPdfToChat({
      bot,
      chatId,
      userFullNameFallback: context.prospectName
    });
  }

  // 11. Si el modelo detecta que debe pausarse (handover automático)
  if (decision.should_trigger_handover) {
    stateCache.setAiPaused(chatId, true);
  }

  // 12. Persistir memoria consolidada del turno en Supabase (curso activo, nombre, resumen)
  await memoryService.persistTurnMemory({
    chatId,
    decision,
    context,
    userInput: cleanInput
  });
}
