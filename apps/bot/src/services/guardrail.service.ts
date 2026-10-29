import { AttackType, SecuritySeverity } from '@hackaton/shared';

export interface GuardrailCheckResult {
  isBlocked: boolean;
  attackType: AttackType;
  severity: SecuritySeverity;
  reason: string | null;
  diplomaticReply: string | null;
}

const SUSPICIOUS_PATTERNS: Array<{
  regex: RegExp;
  type: AttackType;
  severity: SecuritySeverity;
  reason: string;
  reply: string;
}> = [
  {
    regex: /(ignore|ignora|olvida|deshaz|omite|desobedece)[\s\w]*(instructions|instrucciones|reglas|directrices|anteriores|previous|prompts)/i,
    type: 'JAILBREAK',
    severity: 'HIGH',
    reason: 'Intento de reseteo de directrices del sistema (Prompt Reset Attack)',
    reply: 'Comprendo tu inquietud técnica, pero como asesor académico oficial de CTT-FISEI mi función es orientarte sobre el pénsum, fechas de inscripción y certificaciones oficiales. ¿En qué curso de tecnología deseas enfocarte?'
  },
  {
    regex: /(system\s*prompt|system_instruction|hidden\s*rules|prompt\s*de\s*sistema|instrucciones\s*iniciales|muestra\s*tu\s*prompt|repite\s*tu\s*prompt|qué\s*te\s*ordenaron|dime\s*tus\s*reglas|revela\s*tus\s*instrucciones)/i,
    type: 'JAILBREAK',
    severity: 'HIGH',
    reason: 'Intento de extracción de directrices internas (System Prompt Leak)',
    reply: 'Mis directrices están orientadas a brindarte información clara y verificada sobre las capacitaciones avaladas por la Universidad Técnica de Ambato. ¿Te gustaría consultar el temario de algún taller?'
  },
  {
    regex: /(modo\s*(desarrollador|dios|dan|jailbreak|sin\s*filtros|unrestricted)|developer\s*mode|enable\s*dan|jailbreak)/i,
    type: 'JAILBREAK',
    severity: 'CRITICAL',
    reason: 'Intento de activación de modo desarrollador no autorizado (Jailbreak / DAN)',
    reply: 'Todos nuestros canales conversacionales operan bajo las normas de integridad académica de la FISEI - UTA. ¿Puedo ayudarte con los requisitos o fechas de inicio de algún curso?'
  },
  {
    regex: /(act\s*as|act[uú]a\s*como|simula\s*que\s*eres|pretend\s*you\s*are|a\s*partir\s*de\s*ahora\s*eres)/i,
    type: 'ROLE_HIJACK',
    severity: 'MEDIUM',
    reason: 'Intento de cambio de rol o suplantación de identidad del bot',
    reply: 'Soy el asesor académico oficial de CTT-FISEI. Me enfoco exclusivamente en ayudarte con tu formación profesional tecnológica. ¿Qué área de estudio te interesa?'
  },
  {
    regex: /(soy\s*(el|la)?\s*(decano|rector|director|jurado|evaluador|auditor|administrador|superadmin|root)|i\s*am\s*the\s*admin)/i,
    type: 'ROLE_HIJACK',
    severity: 'HIGH',
    reason: 'Intento de suplantación de autoridad institucional o evaluador',
    reply: 'Bienvenido. Todos los procesos de inscripción y acreditación se gestionan mediante los canales oficiales de la UTA. ¿Deseas verificar detalles de algún programa académico?'
  },
  {
    regex: /(100%|99%|90%|80%|70%|50%)[\s\w]*(descuento|rebaja|beca)|(descuento|rebaja|beca|cupón|cupon)[\s\w]*(100%|99%|90%|80%|70%|50%)/i,
    type: 'DISCOUNT_MANIPULATION',
    severity: 'HIGH',
    reason: 'Solicitud de descuento superior al límite institucional (Tope máx 15%)',
    reply: 'Las tarifas están aprobadas por el Honorable Consejo Directivo de la FISEI - UTA. Contamos con tarifa preferencial para estudiantes UTA ($30 - $40 USD) y descuento de pronto pago de hasta el 15%. Para convenios institucionales puedo derivarte a coordinación académica.'
  },
  {
    regex: /(gratis|gratuito|sin\s*costo|costo\s*cero|\$0|0\s*dólares|0\s*dolares|regalado)/i,
    type: 'DISCOUNT_MANIPULATION',
    severity: 'HIGH',
    reason: 'Intento de forzar gratuidad no autorizada por CTT-FISEI',
    reply: 'Nuestros talleres son programas de certificación autofinanciados con tarifa preferencial subvencionada para la comunidad UTA. ¿Perteneces a la comunidad universitaria para aplicarte la tarifa reducida?'
  },
  {
    regex: /(beca\s*completa|beca\s*del\s*100|100%\s*beca|beca\s*total)/i,
    type: 'DISCOUNT_MANIPULATION',
    severity: 'HIGH',
    reason: 'Intento de adjudicación indebida de beca completa',
    reply: 'El comité académico contempla apoyos de hasta el 15% por mérito académico o pronto pago. ¿Deseas que un asesor humano revise los requisitos de postulación para tu caso?'
  },
  {
    regex: /(base64|rot13|hex|binario|morse|cifrado)[\s\S]*(decodifica|interpreta|ejecuta)/i,
    type: 'JAILBREAK',
    severity: 'HIGH',
    reason: 'Intento de evasión mediante ofuscación de texto',
    reply: 'Por políticas de seguridad, solo proceso consultas comerciales y académicas en lenguaje natural estándar. ¿Qué programa tecnológico buscas explorar?'
  }
];

export function inspectInputHeuristics(input: string): GuardrailCheckResult {
  const text = (input || '').trim();
  if (!text) {
    return {
      isBlocked: false,
      attackType: 'NONE',
      severity: 'LOW',
      reason: null,
      diplomaticReply: null
    };
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(text)) {
      return {
        isBlocked: true,
        attackType: pattern.type,
        severity: pattern.severity,
        reason: pattern.reason,
        diplomaticReply: pattern.reply
      };
    }
  }

  return {
    isBlocked: false,
    attackType: 'NONE',
    severity: 'LOW',
    reason: null,
    diplomaticReply: null
  };
}
