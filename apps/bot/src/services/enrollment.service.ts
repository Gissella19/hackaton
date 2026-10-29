/**
 * EnrollmentService — "Orquestador de Generación y Envío de Fichas/Órdenes de Pago"
 *
 * Responsabilidad Única (SRP):
 * Resolver los datos del prospecto, aranceles oficiales y generar/despachar
 * el PDF oficial de pre-inscripción y orden de pago a través de Telegram y Supabase.
 */

import { Bot, InputFile } from 'grammy';
import { pdfService, EnrollmentData } from './pdf.service.js';
import { getChatById, saveMessage, getSupabase } from './supabase.service.js';

interface CoursePricing {
  code: string;
  name: string;
  modality: string;
  utaPrice: number;
  gradPrice: number;
  generalPrice: number;
}

const COURSES_PRICING: CoursePricing[] = [
  {
    code: 'CTT-FISEI-01',
    name: 'Fundamentos de Python 1 (Python Essentials 1)',
    modality: 'Virtual autodidacta (Cisco NetAcad)',
    utaPrice: 30,
    gradPrice: 40,
    generalPrice: 50
  },
  {
    code: 'CTT-FISEI-02',
    name: 'Fundamentos de Python 2',
    modality: 'Virtual autodidacta (Cisco NetAcad)',
    utaPrice: 30,
    gradPrice: 40,
    generalPrice: 50
  },
  {
    code: 'CTT-FISEI-03',
    name: 'JavaScript Essentials 1',
    modality: 'Virtual autodidacta (Cisco NetAcad)',
    utaPrice: 40,
    gradPrice: 45,
    generalPrice: 50
  },
  {
    code: 'CTT-FISEI-04',
    name: 'JavaScript Essentials 2',
    modality: 'Virtual autodidacta (Cisco NetAcad)',
    utaPrice: 50,
    gradPrice: 55,
    generalPrice: 60
  },
  {
    code: 'CTT-FISEI-05',
    name: 'Fundamentos de Ciencia y Analítica de Datos',
    modality: 'Virtual autodidacta (Excel, SQL & Tableau)',
    utaPrice: 30,
    gradPrice: 40,
    generalPrice: 50
  },
  {
    code: 'CTT-FISEI-06',
    name: 'Ethical Hacker',
    modality: 'Virtual síncrono (Zoom)',
    utaPrice: 60,
    gradPrice: 65,
    generalPrice: 70
  },
  {
    code: 'CTT-FISEI-11',
    name: 'Introducción al Control Industrial',
    modality: 'Presencial — Laboratorios Campus Huachi',
    utaPrice: 50,
    gradPrice: 55,
    generalPrice: 60
  },
  {
    code: 'CTT-FISEI-17',
    name: 'Linux Essentials – Preparación Linux Essentials Certificate',
    modality: 'Virtual autodidacta',
    utaPrice: 50,
    gradPrice: 55,
    generalPrice: 60
  },
  {
    code: 'CTT-FISEI-19',
    name: 'GitHub Certified: Agentic AI Developer (GH-600)',
    modality: 'Virtual síncrono (Zoom)',
    utaPrice: 40,
    gradPrice: 50,
    generalPrice: 60
  },
  {
    code: 'CTT-FISEI-20',
    name: 'Preparación Arduino Certification Program',
    modality: 'Presencial — Laboratorios Campus Huachi',
    utaPrice: 40,
    gradPrice: 50,
    generalPrice: 60
  }
];

export class EnrollmentService {
  /**
   * Resuelve los datos de inscripción de un prospecto basándose en el estado de Supabase.
   */
  public async resolveEnrollmentData(params: {
    chatId: number;
    userFullNameFallback?: string;
  }): Promise<EnrollmentData> {
    const { chatId, userFullNameFallback } = params;
    const chat = await getChatById(chatId);

    const activeCourseStr = (chat?.active_course || '').toLowerCase();

    // Buscar curso correspondiente
    let matched = COURSES_PRICING.find((c) =>
      activeCourseStr.includes(c.code.toLowerCase()) ||
      activeCourseStr.includes(c.name.toLowerCase()) ||
      (activeCourseStr.includes('python 1') && c.code === 'CTT-FISEI-01') ||
      (activeCourseStr.includes('python 2') && c.code === 'CTT-FISEI-02') ||
      (activeCourseStr.includes('python') && c.code === 'CTT-FISEI-01') ||
      (activeCourseStr.includes('arduino') && c.code === 'CTT-FISEI-20') ||
      (activeCourseStr.includes('hacker') && c.code === 'CTT-FISEI-06') ||
      (activeCourseStr.includes('datos') && c.code === 'CTT-FISEI-05') ||
      (activeCourseStr.includes('github') && c.code === 'CTT-FISEI-19') ||
      (activeCourseStr.includes('javascript') && c.code === 'CTT-FISEI-03')
    );

    if (!matched) {
      // Default al primer curso activo
      matched = COURSES_PRICING[0];
    }

    // Inferir categoría de estudiante según el contexto/resumen
    const summaryStr = (chat?.summary || '').toLowerCase();
    let studentCategory = 'Estudiante Activo UTA';
    let finalPrice = matched.utaPrice;

    if (summaryStr.includes('graduado') || summaryStr.includes('docente')) {
      studentCategory = 'Graduado / Docente UTA';
      finalPrice = matched.gradPrice;
    } else if (summaryStr.includes('publico') || summaryStr.includes('público') || summaryStr.includes('externo')) {
      studentCategory = 'Público General';
      finalPrice = matched.generalPrice;
    }

    const regSuffix = String(chatId).slice(-6);
    const registrationCode = `CTT-UTA-2026-${regSuffix}`;

    return {
      chatId,
      fullName: chat?.full_name || userFullNameFallback || 'Prospecto CTT-FISEI',
      courseCode: matched.code,
      courseName: matched.name,
      modality: matched.modality,
      officialPrice: matched.generalPrice,
      finalPrice,
      studentCategory,
      registrationCode
    };
  }

  /**
   * Genera y despacha la Orden de Pago en PDF directamente al chat de Telegram del prospecto.
   */
  public async sendEnrollmentPdfToChat(params: {
    bot: Bot;
    chatId: number;
    userFullNameFallback?: string;
  }): Promise<boolean> {
    const { bot, chatId, userFullNameFallback } = params;

    try {
      const data = await this.resolveEnrollmentData({
        chatId,
        userFullNameFallback
      });

      console.log(`[EnrollmentService] Generando PDF de inscripción para chat #${chatId} (${data.courseName})...`);
      const pdfBuffer = await pdfService.generateEnrollmentPdf(data);

      const fileName = `Orden_Inscripcion_${data.registrationCode}.pdf`;

      // Enviar documento a Telegram
      await bot.api.sendDocument(chatId, new InputFile(pdfBuffer, fileName), {
        caption:
          `📄 **ORDEN DE PAGO Y FICHA DE INSCRIPCIÓN OFICIAL CTT-FISEI**\n\n` +
          `👤 **Participante:** ${data.fullName}\n` +
          `📚 **Curso:** ${data.courseName}\n` +
          `💰 **Valor a Pagar:** $${data.finalPrice.toFixed(2)} USD (${data.studentCategory})\n` +
          `🏛️ **Banco del Pacífico:** Cta Cte 07223941-8 (Sublínea 130108)\n` +
          `🔖 **Código de Trámite:** \`${data.registrationCode}\`\n\n` +
          `_Por favor realiza tu pago dentro de las próximas 48 horas y envíanos la foto de tu comprobante por este medio para validar tu cupo._`,
        parse_mode: 'Markdown'
      });

      // Persistir el evento en el historial de mensajes de Supabase
      await saveMessage({
        chatId,
        sender: 'ai',
        content: `[Documento PDF Enviado]: Orden de Pago y Ficha de Inscripción Oficial para ${data.courseName} ($${data.finalPrice.toFixed(2)} USD). Trámite: ${data.registrationCode}`
      });

      console.log(`[EnrollmentService] PDF despachado exitosamente a chat #${chatId}.`);
      return true;
    } catch (err) {
      console.error(`[EnrollmentService] Error generando/enviando PDF a chat #${chatId}:`, err);
      await bot.api.sendMessage(
        chatId,
        '⚠️ Ocurrió un inconveniente al generar tu documento PDF. Un coordinador académico te enviará la orden de pago en breves instantes.'
      );
      return false;
    }
  }
}

export const enrollmentService = new EnrollmentService();
