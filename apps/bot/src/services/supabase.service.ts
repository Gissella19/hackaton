import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ControlMode, Conversation, LeadStatus, MessageSender } from '@hackaton/shared';
import { config } from '../config.js';

// Cache local en memoria para Check de Estado a 0 ms
const modeCache = new Map<number, ControlMode>();

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabase && config.supabaseUrl && config.supabaseKey) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabase;
}

export async function getChatControlMode(telegramChatId: number): Promise<ControlMode> {
  if (modeCache.has(telegramChatId)) {
    return modeCache.get(telegramChatId)!;
  }

  const client = getSupabase();
  if (!client) return 'AI';

  const { data, error } = await client
    .from('conversations')
    .select('control_mode')
    .eq('telegram_chat_id', telegramChatId)
    .single();

  if (error || !data) {
    return 'AI';
  }

  const mode = data.control_mode as ControlMode;
  modeCache.set(telegramChatId, mode);
  return mode;
}

export function setMemoryControlMode(telegramChatId: number, mode: ControlMode) {
  modeCache.set(telegramChatId, mode);
}

export async function getOrCreateConversation(
  telegramChatId: number,
  prospectName: string
): Promise<Conversation | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data: existing } = await client
    .from('conversations')
    .select('*')
    .eq('telegram_chat_id', telegramChatId)
    .single();

  if (existing) {
    modeCache.set(telegramChatId, existing.control_mode);
    return existing as Conversation;
  }

  const { data: created, error } = await client
    .from('conversations')
    .insert({
      telegram_chat_id: telegramChatId,
      prospect_name: prospectName,
      control_mode: 'AI',
      lead_status: 'INTERESTED',
      sentiment_score: 50
    })
    .select()
    .single();

  if (error) {
    console.error('[SupabaseService] Error creando conversación:', error);
    return null;
  }

  modeCache.set(telegramChatId, 'AI');
  return created as Conversation;
}

export async function saveMessage(params: {
  conversationId: string;
  senderType: MessageSender;
  content: string;
  isVoice?: boolean;
}) {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from('messages').insert({
    conversation_id: params.conversationId,
    sender_type: params.senderType,
    content: params.content,
    is_voice_transcribed: !!params.isVoice
  });

  if (error) {
    console.error('[SupabaseService] Error guardando mensaje:', error);
  }
}

export async function updateConversationState(params: {
  conversationId: string;
  telegramChatId: number;
  controlMode?: ControlMode;
  leadStatus?: LeadStatus;
  sentimentScore?: number;
  securityAlert?: string | null;
  leadMemory?: Record<string, unknown>;
}) {
  const client = getSupabase();
  if (params.controlMode) {
    modeCache.set(params.telegramChatId, params.controlMode);
  }

  if (!client) return;

  const payload: Record<string, unknown> = {};
  if (params.controlMode !== undefined) payload.control_mode = params.controlMode;
  if (params.leadStatus !== undefined) payload.lead_status = params.leadStatus;
  if (params.sentimentScore !== undefined) payload.sentiment_score = params.sentimentScore;
  if (params.securityAlert !== undefined) payload.security_alert = params.securityAlert;
  if (params.leadMemory !== undefined) payload.lead_memory = params.leadMemory;

  const { error } = await client
    .from('conversations')
    .update(payload)
    .eq('id', params.conversationId);

  if (error) {
    console.error('[SupabaseService] Error actualizando estado de conversación:', error);
  }
}

export async function recordSecurityIncident(params: {
  conversationId: string | null;
  attackType: string;
  rawInput: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}) {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from('security_logs').insert({
    conversation_id: params.conversationId,
    attack_type: params.attackType,
    raw_input: params.rawInput,
    severity: params.severity
  });

  if (error) {
    console.error('[SupabaseService] Error registrando incidente de seguridad:', error);
  }
}
