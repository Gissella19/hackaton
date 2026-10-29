export type ControlMode = 'AI' | 'HUMAN';

export type LeadStatus = 'INTERESTED' | 'DOUBTFUL' | 'FRUSTRATED' | 'HOT_LEAD';

export type MessageSender = 'USER' | 'AI' | 'OPERATOR';

export interface LeadMemory {
  name: string;
  interest: string;
  budget_or_schedule: string | null;
  main_objection: string | null;
  suggested_human_action: string | null;
}

export interface Conversation {
  id: string;
  telegram_chat_id: number;
  prospect_name: string;
  control_mode: ControlMode;
  lead_status: LeadStatus;
  sentiment_score: number;
  security_alert: string | null;
  lead_memory: LeadMemory;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: MessageSender;
  content: string;
  is_voice_transcribed: boolean;
  raw_metadata?: Record<string, unknown>;
  created_at: string;
}
