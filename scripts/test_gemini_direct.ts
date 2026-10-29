import { processProspectMessage } from '../apps/bot/src/services/gemini.service.js';

async function test() {
  console.log('Iniciando prueba directa de Gemini...');
  const res = await processProspectMessage({
    userInput: '¿Cuánto cuesta el curso de Python 1 y qué requisitos necesito?'
  });
  console.log('\n--- RESPUESTA OBTENIDA ---');
  console.log(res.reply_to_user);
  console.log('\n--- ESTADO DEL LEAD ---');
  console.log(res.lead_status);
}

test().catch(console.error);
