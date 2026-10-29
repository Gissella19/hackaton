/**
 * PdfService — "Generador de Órdenes de Pago y Fichas de Inscripción CTT-FISEI"
 *
 * Responsabilidad Única (SRP):
 * Construir documentos PDF vectoriales oficiales para formalizar la inscripción
 * y pago de prospectos a los programas del CTT-FISEI (UTA).
 */

import PDFDocument from 'pdfkit';

export interface EnrollmentData {
  chatId: number;
  fullName: string;
  courseCode: string;
  courseName: string;
  category?: string;
  officialPrice: number;
  finalPrice: number;
  studentCategory: string; // e.g. "Estudiante UTA" | "Graduado / Docente" | "Público General"
  registrationCode: string; // e.g. "CTT-UTA-2026-6031202"
  modality: string;
  issueDate?: string;
  expiryDate?: string;
}

export class PdfService {
  /**
   * Genera el buffer del documento PDF oficial en memoria.
   */
  public generateEnrollmentPdf(data: EnrollmentData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 45,
          info: {
            Title: `Orden_Inscripcion_${data.registrationCode}`,
            Author: 'Centro de Transferencia y Capacitación Tecnológica - FISEI UTA',
            Subject: `Orden de Pago Oficial - ${data.courseName}`
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const now = new Date();
        const dateStr =
          data.issueDate ||
          now.toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

        const expiry = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const expiryStr =
          data.expiryDate ||
          expiry.toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

        // ==========================================
        // 1. ENCABEZADO INSTITUCIONAL UTA / FISEI
        // ==========================================
        // Barra superior decorativa UTA (Granate)
        doc.rect(45, 45, 505, 6).fill('#800020'); // Borgoña / Granate institucional

        doc.moveDown(1.2);
        doc
          .fillColor('#800020')
          .fontSize(15)
          .font('Helvetica-Bold')
          .text('UNIVERSIDAD TÉCNICA DE AMBATO', { align: 'center' });

        doc
          .fillColor('#2D3748')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('FACULTAD DE INGENIERÍA EN SISTEMAS, ELECTRÓNICA E INDUSTRIAL', {
            align: 'center'
          });

        doc
          .fillColor('#4A5568')
          .fontSize(9)
          .font('Helvetica')
          .text('Centro de Transferencia y Capacitación Tecnológica (CTT - FISEI)', {
            align: 'center'
          });

        doc.moveDown(0.8);
        doc
          .strokeColor('#CBD5E0')
          .lineWidth(1)
          .moveTo(45, doc.y)
          .lineTo(550, doc.y)
          .stroke();

        doc.moveDown(0.8);

        // ==========================================
        // 2. TÍTULO Y CÓDIGO DE TRÁMITE
        // ==========================================
        doc
          .fillColor('#1A202C')
          .fontSize(13)
          .font('Helvetica-Bold')
          .text('ORDEN DE PAGO Y FICHA DE INSCRIPCIÓN OFICIAL', {
            align: 'center'
          });

        doc.moveDown(0.5);

        // Caja de Metadatos del Trámite
        const metaBoxY = doc.y;
        doc.rect(45, metaBoxY, 505, 38).fillAndStroke('#F7FAFC', '#E2E8F0');

        doc
          .fillColor('#4A5568')
          .fontSize(8.5)
          .font('Helvetica')
          .text(`N° Trámite: `, 55, metaBoxY + 8, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#1A202C')
          .text(data.registrationCode, { continued: true })
          .font('Helvetica')
          .fillColor('#4A5568')
          .text(`   ·   Emisión: `, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#1A202C')
          .text(dateStr, { continued: true })
          .font('Helvetica')
          .fillColor('#4A5568')
          .text(`   ·   Válido hasta: `, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#C53030')
          .text(`${expiryStr} (48h)`);

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#718096')
          .text(
            'Estado: PRE-INSCRIPCIÓN REGISTRADA — Pendiente de validación de pago en Tesorería',
            55,
            metaBoxY + 22
          );

        doc.y = metaBoxY + 50;

        // ==========================================
        // 3. DATOS DEL PARTICIPANTE
        // ==========================================
        doc
          .fillColor('#800020')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('1. DATOS DEL PARTICIPANTE / PROSPECTO');

        doc.moveDown(0.3);

        const partY = doc.y;
        doc.rect(45, partY, 505, 52).fillAndStroke('#FFFFFF', '#CBD5E0');

        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Nombres Completos:', 55, partY + 10)
          .font('Helvetica')
          .fillColor('#1A202C')
          .text(data.fullName || 'No especificado', 160, partY + 10);

        doc
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Identificador / Chat ID:', 55, partY + 24)
          .font('Helvetica')
          .fillColor('#1A202C')
          .text(String(data.chatId), 160, partY + 24);

        doc
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Categoría Arancelaria:', 55, partY + 38)
          .font('Helvetica-Bold')
          .fillColor('#2B6CB0')
          .text(data.studentCategory, 160, partY + 38);

        doc.y = partY + 64;

        // ==========================================
        // 4. PROGRAMA ACADÉMICO SELECCIONADO
        // ==========================================
        doc
          .fillColor('#800020')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('2. PROGRAMA ACADÉMICO APROBADO');

        doc.moveDown(0.3);

        const progY = doc.y;
        doc.rect(45, progY, 505, 62).fillAndStroke('#FFFFFF', '#CBD5E0');

        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Código Oficial:', 55, progY + 10)
          .font('Helvetica')
          .fillColor('#1A202C')
          .text(data.courseCode, 160, progY + 10);

        doc
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Programa / Curso:', 55, progY + 24)
          .font('Helvetica-Bold')
          .fillColor('#1A202C')
          .text(data.courseName, 160, progY + 24, { width: 375 });

        doc
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('Modalidad:', 55, progY + 48)
          .font('Helvetica')
          .fillColor('#1A202C')
          .text(data.modality || 'Virtual / Presencial CTT-FISEI', 160, progY + 48);

        doc.y = progY + 74;

        // ==========================================
        // 5. LIQUIDACIÓN DE ARANCEL OFICIAL
        // ==========================================
        doc
          .fillColor('#800020')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('3. LIQUIDACIÓN DE ARANCEL E INVERSIÓN');

        doc.moveDown(0.3);

        const tableY = doc.y;
        // Encabezado de tabla
        doc.rect(45, tableY, 505, 20).fill('#2D3748');
        doc
          .fillColor('#FFFFFF')
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text('CONCEPTO ACADÉMICO', 55, tableY + 5)
          .text('VALOR REGULADO', 420, tableY + 5, { align: 'right', width: 115 });

        // Fila 1: Arancel base
        doc.rect(45, tableY + 20, 505, 22).fillAndStroke('#F7FAFC', '#E2E8F0');
        doc
          .fillColor('#2D3748')
          .font('Helvetica')
          .fontSize(8.5)
          .text(`Arancel General Oficial — ${data.courseCode}`, 55, tableY + 26)
          .text(`$${data.officialPrice.toFixed(2)} USD`, 420, tableY + 26, {
            align: 'right',
            width: 115
          });

        // Fila 2: Subvención o descuento institucional (si aplica)
        const discountAmount = Math.max(0, data.officialPrice - data.finalPrice);
        doc.rect(45, tableY + 42, 505, 22).fillAndStroke('#FFFFFF', '#E2E8F0');
        doc
          .fillColor('#2F855A')
          .font('Helvetica')
          .fontSize(8.5)
          .text(
            `Beneficio Subvención / Beca Institucional (${data.studentCategory})`,
            55,
            tableY + 48
          )
          .text(`-$${discountAmount.toFixed(2)} USD`, 420, tableY + 48, {
            align: 'right',
            width: 115
          });

        // Fila 3: Total
        doc.rect(45, tableY + 64, 505, 24).fill('#EDF2F7');
        doc
          .fillColor('#1A202C')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('TOTAL FINAL A PAGAR:', 55, tableY + 70)
          .fillColor('#800020')
          .text(`$${data.finalPrice.toFixed(2)} USD`, 420, tableY + 70, {
            align: 'right',
            width: 115
          });

        doc.y = tableY + 98;

        // ==========================================
        // 6. INSTRUCCIONES OFICIALES DE PAGO
        // ==========================================
        doc
          .fillColor('#800020')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('4. CUENTAS BANCARIAS AUTORIZADAS PARA EL PAGO');

        doc.moveDown(0.3);

        const bankY = doc.y;
        doc.rect(45, bankY, 505, 68).fillAndStroke('#FEFCBF', '#ECC94B'); // Amarillo tenue institucional

        doc
          .fillColor('#744210')
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text('BANCO DEL PACÍFICO — CUENTA CORRIENTE NACIONAL', 55, bankY + 8)
          .font('Helvetica')
          .text('• Beneficiario: ', 55, bankY + 22, { continued: true })
          .font('Helvetica-Bold')
          .text('UNIVERSIDAD TÉCNICA DE AMBATO (RUC: 1860001470001)')
          .font('Helvetica')
          .text('• Número de Cuenta Corriente: ', 55, bankY + 34, { continued: true })
          .font('Helvetica-Bold')
          .text('07223941-8 (Sublínea CTT-FISEI Código: 130108)')
          .font('Helvetica')
          .text('• Referencia de Pago Obligatoria: ', 55, bankY + 46, { continued: true })
          .font('Helvetica-Bold')
          .text(data.registrationCode)
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#975A16')
          .text(
            '* También puedes cancelar en efectivo o tarjeta directamente en Ventanillas de Tesorería, Campus Huachi.',
            55,
            bankY + 58
          );

        doc.y = bankY + 78;

        // ==========================================
        // 7. POLÍTICAS Y FIRMA DE VALIDACIÓN
        // ==========================================
        doc
          .fillColor('#718096')
          .fontSize(7.5)
          .font('Helvetica')
          .text(
            'IMPORTANTE: Una vez efectuado el depósito o transferencia, envía el comprobante digital a través de este mismo canal de Telegram (@fisei_asesor_bot) o al correo ctt.fisei@uta.edu.ec para la emisión inmediata de tu matrícula y credenciales de acceso a la plataforma.',
            45,
            doc.y,
            { width: 505, align: 'justify' }
          );

        doc.moveDown(1.5);

        const sigY = doc.y;
        doc
          .strokeColor('#A0AEC0')
          .lineWidth(1)
          .moveTo(175, sigY + 25)
          .lineTo(420, sigY + 25)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#2D3748')
          .text('COORDINACIÓN ACADÉMICA CTT - FISEI', 175, sigY + 30, {
            width: 245,
            align: 'center'
          })
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#718096')
          .text('Universidad Técnica de Ambato · Ambato, Ecuador', 175, sigY + 42, {
            width: 245,
            align: 'center'
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const pdfService = new PdfService();
