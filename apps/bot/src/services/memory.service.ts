/**
 * MemoryService — "Memoria Conversacional y Gestión de Estado del Prospecto"
 *
 * Responsabilidad Única (SRP):
 * Centralizar la recuperación, formateo, augmentación de contexto y persistencia
 * de la memoria a corto plazo (buffer de mensajes) y a largo plazo (entidades del prospecto).
 *
 * Resuelve:
 * - Amnesia conversacional en diálogos multi-turno.
 * - Augmentación de queries para RAG cuando el usuario envía respuestas cortas (nombre, rol, dudas).
 * - Sincronización inmutable del curso activo en discusión.
 */

import { AgentDecision } from '@hackaton/shared';
import {
  getChatById,
  getOrCreateChat,
  getRecentMessages,
  updateChatMetadata,
  ChatRecord
} from './supabase.service.js';

export interface ConversationContext {
  chatId: number;
  prospectName: string;
  activeCourse: string | null;
  summary: string | null;
  sentiment: string;
  recentHistory: Array<{
    sender: 'user' | 'ai' | 'operator';
    content: string;
  }>;
}

const KNOWN_COURSES = [
  {
    code: 'CTT-FISEI-01',
    name: 'Fundamentos de Python 1 (Python Essentials 1)',
    patterns: ['python 1', 'python essentials 1', 'python uno', 'fundamentos de python 1', 'python inicial']
  },
  {
    code: 'CTT-FISEI-02',
    name: 'Fundamentos de Python 2',
    patterns: ['python 2', 'python essentials 2', 'python dos', 'fundamentos de python 2', 'python avanzado']
  },
  {
    code: 'CTT-FISEI-03',
    name: 'JavaScript Essentials 1',
    patterns: ['javascript 1', 'js 1', 'javascript essentials 1', 'js essentials 1']
  },
  {
    code: 'CTT-FISEI-04',
    name: 'JavaScript Essentials 2',
    patterns: ['javascript 2', 'js 2', 'javascript essentials 2']
  },
  {
    code: 'CTT-FISEI-05',
    name: 'Fundamentos de Ciencia y Analítica de Datos',
    patterns: ['ciencia de datos', 'analitica de datos', 'analítica de datos', 'datos', 'data science', 'tableau']
  },
  {
    code: 'CTT-FISEI-06',
    name: 'Ethical Hacker',
    patterns: ['ethical hacker', 'hacker', 'hacking', 'seguridad informatica', 'ciberseguridad']
  },
  {
    code: 'CTT-FISEI-11',
    name: 'Introducción al Control Industrial',
    patterns: ['control industrial', 'plc', 'automatizacion', 'automatización']
  },
  {
    code: 'CTT-FISEI-17',
    name: 'Linux Essentials – Preparación Linux Essentials Certificate',
    patterns: ['linux', 'linux essentials']
  },
  {
    code: 'CTT-FISEI-19',
    name: 'GitHub Certified: Agentic AI Developer (GH-600)',
    patterns: ['agentic ai', 'gh-600', 'github certified', 'copilot', 'agentes']
  },
  {
    code: 'CTT-FISEI-20',
    name: 'Preparación Arduino Certification Program',
    patterns: ['arduino', 'robotica', 'robótica']
  }
];

export class MemoryService {
  /**
   * Carga la memoria completa (perfil en `chats` + últimos mensajes en `messages`).
   */
  async loadConversationContext(
    chatId: number,
    fallbackName: string = 'Prospecto'
  ): Promise<ConversationContext> {
    let chat = await getChatById(chatId);
    if (!chat) {
      chat = await getOrCreateChat({
        chatId,
        fullName: fallbackName
      });
    }

    const messages = await getRecentMessages(chatId, 8);

    return {
      chatId,
      prospectName: chat?.full_name || fallbackName,
      activeCourse: chat?.active_course || null,
      summary: chat?.summary || null,
      sentiment: chat?.sentiment || 'interesado',
      recentHistory: messages.map((m) => ({
        sender: m.sender,
        content: m.content
      }))
    };
  }

  /**
   * Detecta si el mensaje actual menciona un curso del catálogo.
   */
  detectCourseMention(text: string): string | null {
    const lower = text.toLowerCase();
    for (const course of KNOWN_COURSES) {
      if (lower.includes(course.code.toLowerCase())) {
        return course.name;
      }
      for (const pattern of course.patterns) {
        if (lower.includes(pattern)) {
          return course.name;
        }
      }
    }
    return null;
  }

  /**
   * Extrae el nombre del usuario considerando formatos naturales:
   * - "Gisselle Camila Espín Caiza soy estudiante"
   * - "Soy Gisselle Camila"
   * - "Me llamo Mateo Villacrés"
   */
  extractUserName(text: string): string | null {
    const trimmed = text.trim();

    // 1. Limpiar sufijos o prefijos de roles institucionales
    const cleanBeforeRole = trimmed
      .replace(/\b(?:soy\s+estudiante|soy\s+docente|soy\s+graduado|estudiante|docente|graduado|publico\s+general|de\s+la\s+uta|uta)\b/gi, '')
      .replace(/[,;.]+/g, ' ')
      .trim();

    // 2. Extraer si viene precedido de "me llamo", "mi nombre es" o "soy"
    const prefixMatch = cleanBeforeRole.match(/(?:me llamo|mi nombre es|soy)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{3,40})/i);
    const candidate = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : cleanBeforeRole;

    // 3. Validar que contenga caracteres alfabéticos válidos
    if (/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{3,40}$/.test(candidate)) {
      const words = candidate.split(/\s+/).filter(Boolean);
      const forbidden = [
        'hola', 'buenos', 'dias', 'tardes', 'noches', 'curso',
        'info', 'python', 'gracias', 'por', 'favor', 'inscribir',
        'inscripcion', 'matricula', 'precio', 'costo', 'arancel'
      ];
      const filtered = words.filter(w => !forbidden.includes(w.toLowerCase()));
      if (filtered.length >= 1) {
        return filtered
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
    return null;
  }

  /**
   * Augmentación de Query para RAG:
   * Si el usuario responde algo contextual ("soy estudiante", "cuanto cuesta?", "ya te habia dicho")
   * y ya hay un curso activo en memoria, fusiona el curso en la búsqueda vectorial.
   */
  buildAugmentedRagQuery(userInput: string, context: ConversationContext): string {
    const directMention = this.detectCourseMention(userInput);
    if (directMention) {
      return `${userInput} ${directMention}`;
    }

    if (context.activeCourse) {
      return `${userInput} curso ${context.activeCourse}`;
    }

    return userInput;
  }

  /**
   * Persiste la memoria consolidada tras la decisión del modelo:
   * actualiza curso activo, nombre, resumen estructurado y estado en Supabase.
   */
  async persistTurnMemory(params: {
    chatId: number;
    decision: AgentDecision;
    context: ConversationContext;
    userInput: string;
  }): Promise<void> {
    const { chatId, decision, context, userInput } = params;

    // 1. Resolver si se detectó un curso nuevo o mantenemos el existente
    const courseInInput = this.detectCourseMention(userInput);
    const courseInDecision =
      decision.prospect_profile.interest &&
      decision.prospect_profile.interest !== 'General'
        ? decision.prospect_profile.interest
        : null;

    const resolvedActiveCourse =
      courseInInput ||
      courseInDecision ||
      context.activeCourse;

    // 2. Resolver nombre del prospecto
    const nameInInput = this.extractUserName(userInput);
    const nameInDecision =
      decision.prospect_profile.name &&
      decision.prospect_profile.name !== 'Prospecto'
        ? decision.prospect_profile.name
        : null;

    const resolvedName =
      nameInInput ||
      nameInDecision ||
      (context.prospectName !== 'Prospecto' ? context.prospectName : undefined);

    // 3. Generar un resumen acumulativo conciso para el operador
    const interestPart = resolvedActiveCourse || 'Interés general';
    const objectionPart = decision.prospect_profile.main_objection || 'Sin objeción';
    const updatedSummary = `${interestPart} | Objeción: ${objectionPart}`;

    await updateChatMetadata({
      chatId,
      fullName: resolvedName,
      activeCourse: resolvedActiveCourse || undefined,
      aiPaused: decision.should_trigger_handover,
      sentiment: decision.lead_status.toLowerCase(),
      summary: updatedSummary,
      suggestedReply:
        decision.prospect_profile.suggested_human_action ||
        'Cerrar matriculación con plan de pago oficial.',
      securityFlag: decision.security_audit.is_attack,
      securityReason: decision.security_audit.attack_reason || undefined
    });
  }
}

export const memoryService = new MemoryService();
