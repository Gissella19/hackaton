/**
 * RAG Service — Búsqueda Semántica Vectorial en Supabase
 *
 * Responsabilidad Única (SRP):
 * Vectorizar la pregunta del usuario y consultar la función RPC `match_course_chunks`
 * en Supabase para obtener fragmentos oficiales de los cursos.
 */

import { getSupabase } from './supabase.service.js';
import { config } from '../config.js';

export interface CourseChunkMatch {
  course_code: string;
  course_name: string;
  category: string;
  content: string;
  official_price: number | null;
  max_scholarship_pct: number | null;
  similarity: number;
}

/**
 * Genera el embedding de 768 dimensiones para la consulta del usuario.
 */
async function getQueryEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.geminiApiKey}`;

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
    throw new Error(`Fallo generando embedding (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

/**
 * Busca fragmentos relevantes de cursos en la base de datos de Supabase.
 * Retorna array vacío [] si no hay coincidencias o si la tabla está vacía.
 */
export async function searchCourseKnowledge(query: string): Promise<CourseChunkMatch[]> {
  const supabase = getSupabase();
  if (!supabase || !config.geminiApiKey) {
    return [];
  }

  try {
    const embedding = await getQueryEmbedding(query);

    const { data, error } = await supabase.rpc('match_course_chunks', {
      query_embedding: embedding,
      match_threshold: 0.55,
      match_count: 3
    });

    if (error) {
      console.error('[RAGService] Error en RPC match_course_chunks:', error);
      return [];
    }

    return (data || []) as CourseChunkMatch[];
  } catch (err) {
    console.error('[RAGService] Error en búsqueda semántica:', err);
    return [];
  }
}
