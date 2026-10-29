/**
 * Test Suite: Generación y Validación de Fichas/Órdenes de Pago Oficiales en PDF
 *
 * Responsabilidad:
 * Validar la integridad estructural del documento vectorial, resolución de
 * precios por categoría institucional y formato de códigos de inscripción.
 */

import { pdfService, EnrollmentData } from '../apps/bot/src/services/pdf.service.js';
import { enrollmentService } from '../apps/bot/src/services/enrollment.service.js';

async function runPdfTests() {
  console.log('🧪 Iniciando verificación del motor de generación de PDF CTT-FISEI...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Generación de Buffer PDF vectorial
  try {
    const mockData: EnrollmentData = {
      chatId: 6031202863,
      fullName: 'Gisselle Camila Espín Caiza',
      courseCode: 'CTT-FISEI-01',
      courseName: 'Fundamentos de Python 1 (Python Essentials 1)',
      officialPrice: 50,
      finalPrice: 30,
      studentCategory: 'Estudiante Activo UTA',
      registrationCode: 'CTT-UTA-2026-202863',
      modality: 'Virtual autodidacta (Cisco NetAcad)'
    };

    const pdfBuffer = await pdfService.generateEnrollmentPdf(mockData);

    assert(Buffer.isBuffer(pdfBuffer), 'El generador retorna un Buffer binario de Node.js');
    assert(pdfBuffer.length > 1000, `El tamaño del PDF es representativo (${pdfBuffer.length} bytes)`);

    // Validar cabecera mágica de PDF
    const header = pdfBuffer.subarray(0, 5).toString('utf-8');
    assert(header === '%PDF-', `La cabecera binaria es formato estándar PDF ("${header}")`);
  } catch (err: any) {
    assert(false, 'Generación de PDF sin errores en tiempo de ejecución', err.message);
  }

  // TEST 2: Resolución de datos de inscripción para Estudiante UTA
  try {
    const mockStudentResolved = await enrollmentService.resolveEnrollmentData({
      chatId: 6031202863,
      userFullNameFallback: 'Gisselle Camila Espín Caiza'
    });

    assert(
      mockStudentResolved.courseCode.startsWith('CTT-FISEI'),
      'Código de curso CTT-FISEI asignado correctamente'
    );
    assert(
      mockStudentResolved.finalPrice > 0,
      `Arancel asignado correctamente: $${mockStudentResolved.finalPrice} USD`
    );
    assert(
      mockStudentResolved.registrationCode.startsWith('CTT-UTA-2026-'),
      `Código de trámite institucional generado: ${mockStudentResolved.registrationCode}`
    );
  } catch (err: any) {
    assert(false, 'Resolución de aranceles y datos de inscripción sin fallos', err.message);
  }

  console.log(`\n========================================`);
  console.log(`Resumen de pruebas: ${passed} pasadas, ${failed} falladas.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPdfTests().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});
