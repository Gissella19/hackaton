const fs = require('fs');
const path = require('path');

// Cargar variables de entorno de .env si existe
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) {
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!GEMINI_API_KEY) {
  console.error('\n❌ ERROR: Falta GEMINI_API_KEY en las variables de entorno o archivo .env');
  process.exit(1);
}

async function getGeminiEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text }]
      },
      outputDimensionality: 768
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en API Gemini (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.embedding.values; // Array de 768 floats
}

async function run() {
  const chunksPath = path.resolve(__dirname, '../course_chunks.json');
  if (!fs.existsSync(chunksPath)) {
    console.error('❌ No se encontró course_chunks.json.');
    process.exit(1);
  }

  const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
  console.log(`\n=== INICIANDO VECTORIZACIÓN DE ${chunks.length} CHUNKS CON gemini-embedding-001 (768d) ===\n`);

  const vectorized = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`[${i + 1}/${chunks.length}] Vectorizando: ${chunk.course_code} (${chunk.category})... `);
    
    try {
      const embedding = await getGeminiEmbedding(chunk.content);
      vectorized.push({
        ...chunk,
        embedding
      });
      console.log('✓ OK (768 dims)');
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

    // Pequeño delay de 150ms
    await new Promise(r => setTimeout(r, 150));
  }

  // Guardar copia local de respaldo
  fs.writeFileSync(path.resolve(__dirname, '../course_embeddings.json'), JSON.stringify(vectorized, null, 2), 'utf8');
  console.log(`\n✓ Guardado archivo local course_embeddings.json con ${vectorized.length} vectores listos.`);

  // Subir a Supabase
  if (SUPABASE_URL && SUPABASE_KEY && vectorized.length > 0) {
    console.log(`\n=== SUBIENDO VECTORES A SUPABASE (pgvector) ===`);
    
    const batchSize = 10;
    for (let i = 0; i < vectorized.length; i += batchSize) {
      const batch = vectorized.slice(i, i + batchSize).map(item => ({
        course_code: item.course_code,
        course_name: item.course_name,
        category: item.category,
        content: item.content,
        official_price: item.official_price,
        max_scholarship_pct: item.max_scholarship_pct,
        embedding: item.embedding
      }));

      const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/course_knowledge`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(batch)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ Error subiendo lote ${i / batchSize + 1}:`, errText);
      } else {
        console.log(`✓ Lote ${i / batchSize + 1} (${batch.length} registros) insertado en Supabase`);
      }
    }

    console.log('\n🎉 ¡Base de conocimiento RAG completamente cargada en Supabase!');
  }
}

run().catch(console.error);
