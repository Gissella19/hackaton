/**
 * MessageHandler — "Orquestador del flujo conversacional"
 *
 * Responsabilidad Única (SRP):
 * Ejecutar la secuencia lógica cuando un mensaje (o ráfaga debounced) está listo:
 * 1. Check del semáforo a 0 ms (`stateCache.isAiPaused`).
 * 2. Persistencia del mensaje entrante en Supabase.
 * 3. Ejecución de guardrails heurísticos y LLM (Gemini 3.8 Flash).
 * 4. Despacho de la respuesta y actualización de metadatos.
 */

import { Bot } from 'grammy';
import { stateCache } from '../core/stateCache.js';
import { inspectInputHeuristics } from '../services/guardrail.service.js';
import { processProspectMessage } from '../services/gemini.service.js';
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
}): Promise<void> {
  const { bot, chatId, text, isVoice } = params;

  // 1. SEMÁFORO EN RAM (0 ms reales): ¿La IA está pausada por el operador?
  if (stateCache.isAiPaused(chatId)) {
    console.log(`[Handover Activo] Chat #${chatId} atendido por humano. IA en silencio. Guardando mensaje...`);
    await saveMessage({
      chatId,
      sender: 'user',
      content: text
    });
    return; // Corte inmediato. Cero tokens y cero interrupciones al operador humano.
  }

  // 2. Persistir mensaje del usuario en la base de datos
  await saveMessage({
    chatId,
    sender: 'user',
    content: text
  });

  // 3. ESCUDO ANTI-INYECCIÓN (Fase Heurística)
  const heuristic = inspectInputHeuristics(text);
  if (heuristic.isBlocked) {
    console.warn(`[Seguridad] Bloqueo en chat #${chatId}: ${heuristic.reason}`);

    await logSecurityIncident({
      chatId,
      attackType: heuristic.attackType,
      rawInput: text,
      severity: 'HIGH'
    });

    await updateChatMetadata({
      chatId,
      securityFlag: true,
      securityReason: `[Heurística: ${heuristic.attackType}] ${heuristic.reason}`,
      sentiment: 'dudoso'
    });

    await bot.api.sendMessage(
      chatId,
      '⚠️ Aviso del sistema: Los precios y normativas de los cursos FISEI son de carácter oficial e inalterables. Si necesitas una consulta personalizada, con gusto te comunico con coordinación académica.'
    );
    return;
  }

  // 4. Indicador de "Escribiendo..." en Telegram
  await bot.api.sendChatAction(chatId, 'typing');

  // 5. Inferencia con Gemini 3.8 Flash
  const decision = await processProspectMessage({
    userInput: text
  });

  // 6. Registro si el LLM detectó un intento de ataque sofisticado
  if (decision.security_audit.is_attack) {
    await logSecurityIncident({
      chatId,
      attackType: decision.security_audit.attack_type,
      rawInput: text,
      severity: 'HIGH'
    });
  }

  // 7. Enviar la respuesta oficial por Telegram
  await bot.api.sendMessage(chatId, decision.reply_to_user);

  // 8. Persistir respuesta de la IA
  await saveMessage({
    chatId,
    sender: 'ai',
    content: decision.reply_to_user
  });

  // 9. Si el modelo detecta que debe pausarse (handover automático)
  if (decision.should_trigger_handover) {
    stateCache.setAiPaused(chatId, true);
  }

  // 10. Actualizar metadatos, termómetro y resumen para el operador
  await updateChatMetadata({
    chatId,
    aiPaused: decision.should_trigger_handover,
    sentiment: decision.lead_status.toLowerCase(),
    summary: `${decision.prospect_profile.interest || 'Consulta general'} | Objeción: ${decision.prospect_profile.main_objection || 'Ninguna'}`,
    suggestedReply: decision.prospect_profile.suggested_human_action || 'Cerrar matriculación con plan de pago oficial.',
    securityFlag: decision.security_audit.is_attack,
    securityReason: decision.security_audit.attack_reason || undefined
  });
}
