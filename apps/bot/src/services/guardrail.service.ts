import { AttackType } from '@hackaton/shared';

const SUSPICIOUS_PATTERNS: Array<{ regex: RegExp; type: AttackType; reason: string }> = [
  {
    regex: /(ignore|olvida|ignora|desobedece)\s+(todas\s+las\s+)?(instrucciones|reglas|prompts)/i,
    type: 'JAILBREAK',
    reason: 'Intento de evasión de directrices del sistema (System override attempt)'
  },
  {
    regex: /(sos|actua|comportate|eres|ahora\s+eres)\s+(el\s+)?(administrador|admin|director|rector|dueño|root)/i,
    type: 'ROLE_HIJACK',
    reason: 'Intento de suplantación de rol jerárquico o administrativo'
  },
  {
    regex: /(descuento|beca)\s*(100%|total|gratis|gratuito|sin\s+costo|regalado|0\s*dolares)/i,
    type: 'DISCOUNT_MANIPULATION',
    reason: 'Intento forzado de manipulación indebida de precios o gratuidad'
  },
  {
    regex: /(system\s*prompt|system_instruction|hidden\s*rules|dame\s+tu\s+prompt)/i,
    type: 'JAILBREAK',
    reason: 'Intento de exfiltración del prompt del sistema'
  }
];

export interface GuardrailCheckResult {
  isBlocked: boolean;
  attackType: AttackType;
  reason: string | null;
}

export function inspectInputHeuristics(input: string): GuardrailCheckResult {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(input)) {
      return {
        isBlocked: true,
        attackType: pattern.type,
        reason: pattern.reason
      };
    }
  }

  return {
    isBlocked: false,
    attackType: 'NONE',
    reason: null
  };
}
