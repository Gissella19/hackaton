/**
 * SupabaseService — "Capa de persistencia desacoplada"
 *
 * Responsabilidad Única (SRP):
 * Operaciones CRUD contra las tablas oficiales de Supabase (`chats`, `messages`, `security_logs`)
 * garantizando persistencia bidireccional y actualización de estados del prospecto.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SecuritySeverity } from '@hackaton/shared';
import { config } from '../config.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseClient && config.supabaseUrl && config.supabaseKey) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabaseClient;
}

export interface ChatRecord {
  id: number;
  username: string | null;
  full_name: string;
  sentiment: string;
  ai_paused: boolean;
  summary: string | null;
  security_flag: boolean;
  security_reason: string | null;
  suggested_reply: string | null;
  active_course: string | null;
  tokens_saved: number;
  updated_at: string;
}

/**
 * Obtiene o inicializa la sesión de un prospecto en la tabla `chats`.
 */
export async function getOrCreateChat(params: {
  chatId: number;
  username?: string;
  fullName: string;
}): Promise<ChatRecord | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data: existing, error: selectError } = await client
    .from('chats')
    .select('*')
    .eq('id', params.chatId)
    .single();

  if (existing) {
    return existing as ChatRecord;
  }

  const { data: created, error: insertError } = await client
    .from('chats')
    .insert({
      id: params.chatId,
      username: params.username || null,
      full_name: params.fullName,
      sentiment: 'interesado',
      ai_paused: false,
      summary: 'Conversación iniciada por el prospecto.',
      security_flag: false
    })
    .select()
    .single();

  if (insertError) {
    console.error('[SupabaseService] Error creando registro de chat:', insertError);
    return null;
  }

  return created as ChatRecord;
}

/**
 * Obtiene el registro de un chat por su ID.
 */
export async function getChatById(chatId: number): Promise<ChatRecord | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error || !data) {
    return null;
  }
  return data as ChatRecord;
}

/**
 * Obtiene los mensajes más recientes de una conversación ordenados cronológicamente.
 */
export async function getRecentMessages(
  chatId: number,
  limit: number = 8
): Promise<Array<{ sender: 'user' | 'ai' | 'operator'; content: string; created_at: string }>> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('messages')
    .select('sender, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  // Invertir para que queden en orden cronológico (antiguo -> reciente)
  return (data as Array<{ sender: 'user' | 'ai' | 'operator'; content: string; created_at: string }>).reverse();
}

/**
 * Persiste un mensaje en la tabla `messages`.
 */
export async function saveMessage(params: {
  chatId: number;
  sender: 'user' | 'ai' | 'operator';
  content: string;
  audioUrl?: string;
}) {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from('messages').insert({
    chat_id: params.chatId,
    sender: params.sender,
    content: params.content,
    audio_url: params.audioUrl || null
  });

  if (error) {
    console.error('[SupabaseService] Error guardando mensaje:', error);
  }
}

/**
 * Actualiza el estado y copiloto de un chat.
 */
export async function updateChatMetadata(params: {
  chatId: number;
  fullName?: string;
  aiPaused?: boolean;
  sentiment?: string;
  summary?: string;
  securityFlag?: boolean;
  securityReason?: string;
  suggestedReply?: string;
  activeCourse?: string;
}) {
  const client = getSupabase();
  if (!client) return;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (params.fullName !== undefined) payload.full_name = params.fullName;
  if (params.aiPaused !== undefined) payload.ai_paused = params.aiPaused;
  if (params.sentiment !== undefined) payload.sentiment = params.sentiment;
  if (params.summary !== undefined) payload.summary = params.summary;
  if (params.securityFlag !== undefined) payload.security_flag = params.securityFlag;
  if (params.securityReason !== undefined) payload.security_reason = params.securityReason;
  if (params.suggestedReply !== undefined) payload.suggested_reply = params.suggestedReply;
  if (params.activeCourse !== undefined) payload.active_course = params.activeCourse;

  const { error } = await client
    .from('chats')
    .update(payload)
    .eq('id', params.chatId);

  if (error) {
    console.error('[SupabaseService] Error actualizando metadatos del chat:', error);
  }
}

/**
 * Registra un intento de prompt injection en `security_logs`.
 */
export async function logSecurityIncident(params: {
  chatId: number;
  attackType: string;
  rawInput: string;
  severity?: SecuritySeverity;
}) {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from('security_logs').insert({
    chat_id: params.chatId,
    attack_type: params.attackType,
    raw_input: params.rawInput,
    severity: params.severity || 'HIGH'
  });

  if (error) {
    console.error('[SupabaseService] Error registrando incidente de seguridad:', error);
  }
}
