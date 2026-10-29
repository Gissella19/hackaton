export type AttackType =
  | 'NONE'
  | 'DISCOUNT_MANIPULATION'
  | 'ROLE_HIJACK'
  | 'JAILBREAK'
  | 'OFF_TOPIC';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SecurityIncident {
  id: string;
  conversation_id: string | null;
  attack_type: AttackType;
  raw_input: string;
  severity: SecuritySeverity;
  detected_at: string;
}
