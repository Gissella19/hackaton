/**
 * Test Memory & Multi-turn Conversational Continuity
 *
 * Simulates the exact conversation flow where amnesia occurred:
 * Turn 1: "me puedes inscribir en el curso de 1. **Fundamentos de Python 1 (Python Essentials 1)"
 * Turn 2: "gisselle camila espin caiza soy estudiante"
 * Turn 3: "ya te habia dicho a que curso me quiero inscribir"
 */

import { memoryService } from '../apps/bot/src/services/memory.service.js';
import { processProspectMessage } from '../apps/bot/src/services/gemini.service.js';

async function runMemoryTests() {
  console.log('====================================================');
  console.log('🧪 VERIFICACIÓN DE MEMORIA CONVERSACIONAL Y ENTIDADES');
  console.log('====================================================\n');

  // Test 1: Course Detection
  console.log('[TEST 1] Detección de cursos en texto...');
  const t1_course = memoryService.detectCourseMention(
    'me puedes inscribir en el curso de 1. **Fundamentos de Python 1 (Python Essentials 1)'
  );
  console.log('  Detectado:', t1_course);
  if (!t1_course?.includes('Python 1')) {
    throw new Error(`Fallo en Test 1: Se esperaba Python 1, se obtuvo: ${t1_course}`);
  }
  console.log('  ✅ Test 1 aprobado: Curso detectado correctamente.\n');

  // Test 2: Name Extraction
  console.log('[TEST 2] Extracción de nombre de prospecto...');
  const t2_name = memoryService.extractUserName(
    'gisselle camila espin caiza soy estudiante'
  );
  console.log('  Nombre extraído:', t2_name);
  if (!t2_name || !t2_name.toLowerCase().includes('gisselle')) {
    throw new Error(`Fallo en Test 2: Se esperaba nombre Gisselle, se obtuvo: ${t2_name}`);
  }
  console.log('  ✅ Test 2 aprobado: Nombre extraído correctamente.\n');

  // Test 3: RAG Query Augmentation
  console.log('[TEST 3] Augmentación de query para RAG...');
  const mockContext = {
    chatId: 999999,
    prospectName: 'Gisselle Camila Espin Caiza',
    activeCourse: 'Fundamentos de Python 1 (Python Essentials 1)',
    summary: 'Interés en Python 1',
    sentiment: 'interesado',
    recentHistory: [
      {
        sender: 'user' as const,
        content: 'me puedes inscribir en el curso de 1. **Fundamentos de Python 1 (Python Essentials 1)'
      },
      {
        sender: 'ai' as const,
        content: '¡Hola! Para inscribirte en Fundamentos de Python 1, confírmame tu nombre y a qué grupo perteneces.'
      }
    ]
  };

  const augmentedQuery = memoryService.buildAugmentedRagQuery(
    'gisselle camila espin caiza soy estudiante',
    mockContext
  );
  console.log('  Query augmentada:', augmentedQuery);
  if (!augmentedQuery.includes('Python 1')) {
    throw new Error(`Fallo en Test 3: La query augmentada debe incluir Python 1: ${augmentedQuery}`);
  }
  console.log('  ✅ Test 3 aprobado: Query augmentada correctamente con el curso activo.\n');

  // Test 4: Live Multi-turn Gemini Inference with Memory (Turn 2)
  console.log('[TEST 4] Inferencia real con Gemini inyectando Memoria de Contexto (Turno 2)...');
  console.log('  Enviando Turno 2: "gisselle camila espin caiza soy estudiante"...');

  const decisionTurn2 = await processProspectMessage({
    userInput: 'gisselle camila espin caiza soy estudiante',
    context: mockContext
  });

  console.log('\n--- RESPUESTA TURNO 2 DE LA IA CON MEMORIA ---');
  console.log(decisionTurn2.reply_to_user);
  console.log('----------------------------------------------\n');

  const reply2Lower = decisionTurn2.reply_to_user.toLowerCase();
  const remembersCourse = reply2Lower.includes('python');
  const remembersOrUsesName = reply2Lower.includes('gisselle') || reply2Lower.includes('camila');
  const doesNotAskWhatCourse = !reply2Lower.includes('¿en qué área o curso te gustaría') &&
                               !reply2Lower.includes('qué curso deseas') &&
                               !reply2Lower.includes('en qué temática te gustaría');

  console.log('  Verificaciones Turno 2:');
  console.log('  - ¿Recuerda que estamos hablando de Python?:', remembersCourse ? '✅ SÍ' : '❌ NO');
  console.log('  - ¿Identifica a Gisselle?:', remembersOrUsesName ? '✅ SÍ' : '❌ NO');
  console.log('  - ¿Evita la amnesia de preguntar qué curso quiere?:', doesNotAskWhatCourse ? '✅ SÍ' : '❌ NO');

  if (!remembersCourse) {
    throw new Error('Fallo en Test 4: La IA no mantuvo el contexto del curso Python 1.');
  }
  if (!doesNotAskWhatCourse) {
    throw new Error('Fallo en Test 4: La IA volvió a preguntar qué curso quería (amnesia conversacional).');
  }

  // Test 5: Reclamo conversacional (Turno 3)
  console.log('\n[TEST 5] Reclamo del prospecto ("ya te habia dicho a que curso me quiero inscribir")...');
  const contextWithHistory3 = {
    ...mockContext,
    recentHistory: [
      ...mockContext.recentHistory,
      {
        sender: 'user' as const,
        content: 'gisselle camila espin caiza soy estudiante'
      },
      {
        sender: 'ai' as const,
        content: decisionTurn2.reply_to_user
      }
    ]
  };

  const decisionTurn3 = await processProspectMessage({
    userInput: 'ya te habia dicho a que curso me quiero inscribir',
    context: contextWithHistory3
  });

  console.log('\n--- RESPUESTA TURNO 3 (RECLAMO) DE LA IA CON MEMORIA ---');
  console.log(decisionTurn3.reply_to_user);
  console.log('--------------------------------------------------------\n');

  const reply3Lower = decisionTurn3.reply_to_user.toLowerCase();
  const stillRemembersPython = reply3Lower.includes('python');
  console.log('  - ¿Mantiene el curso Python 1 en la respuesta al reclamo?:', stillRemembersPython ? '✅ SÍ' : '❌ NO');

  if (!stillRemembersPython) {
    throw new Error('Fallo en Test 5: Tras el reclamo la IA perdió el curso activo.');
  }

  console.log('\n🎉 ¡TODOS LOS TESTS DE MEMORIA CONVERSACIONAL PASARON EXITOSAMENTE!');
  console.log('====================================================\n');
}

runMemoryTests().catch((err) => {
  console.error('❌ Error en tests de memoria:', err);
  process.exit(1);
});
