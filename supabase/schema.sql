-- ============================================================
-- ECOSISTEMA CONVERSACIONAL HÍBRIDO FISEI - SUPABASE SCHEMA
-- Reto Oficial Hackathon 2026 (FISEI - UTA / GDG Quito / Supabase)
-- ============================================================

-- 1. Habilitar la extensión vectorial para RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de Prospectos / Sesiones de Chat (Telegram)
CREATE TABLE IF NOT EXISTS chats (
  id BIGINT PRIMARY KEY,               -- El chat_id nativo de Telegram
  username TEXT,                       -- @username de Telegram
  full_name TEXT,                      -- Nombre y Apellido del prospecto
  sentiment TEXT DEFAULT 'interesado', -- 'interesado' | 'dudoso' | 'frustrado' | 'lead caliente'
  ai_paused BOOLEAN DEFAULT FALSE,     -- Seamless Handover: true cuando interviene el humano
  summary TEXT,                        -- Whisper Summary para el operador
  security_flag BOOLEAN DEFAULT FALSE, -- Flag si intentó Prompt Injection
  security_reason TEXT,                -- Motivo o tipo de ataque bloqueado
  suggested_reply TEXT,                -- Copiloto: Respuesta sugerida para el operador
  active_course TEXT,                  -- Último curso de interés consultado
  tokens_saved INT DEFAULT 0,          -- Métrica de telemetría RAG
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Mensajes (Sincronización Bidireccional en Tiempo Real)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT REFERENCES chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,                -- 'user' | 'ai' | 'operator'
  content TEXT NOT NULL,
  audio_url TEXT,                      -- Si el usuario mandó nota de voz
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Conocimiento Vectorizado de Cursos (RAG + Precios Inmutables)
CREATE TABLE IF NOT EXISTS course_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_code TEXT NOT NULL,           -- Ej: 'CTT-FISEI-19'
  course_name TEXT NOT NULL,           -- Ej: 'Preparación GitHub Certified: Agentic AI Developer (GH-600)'
  category TEXT NOT NULL,              -- 'overview' | 'syllabus' | 'pricing' | 'faq'
  content TEXT NOT NULL,               -- Texto descriptivo o módulo específico
  official_price NUMERIC(10,2),        -- Precio oficial inmutable (Defensa Anti-Injection)
  max_scholarship_pct INT DEFAULT 15,  -- Tope máximo real de beca (15%)
  embedding VECTOR(768)                -- Embedding de Google text-embedding-004
);

-- 5. Índice HNSW ultrarrápido para búsqueda vectorial (< 5ms)
CREATE INDEX IF NOT EXISTS course_knowledge_embedding_hnsw_idx 
ON course_knowledge USING hnsw (embedding vector_cosine_ops);

-- 6. Función RPC para Búsqueda Vectorial Semántica
CREATE OR REPLACE FUNCTION match_course_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.60,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  course_code TEXT,
  course_name TEXT,
  category TEXT,
  content TEXT,
  official_price NUMERIC,
  max_scholarship_pct INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.course_code,
    ck.course_name,
    ck.category,
    ck.content,
    ck.official_price,
    ck.max_scholarship_pct,
    1 - (ck.embedding <=> query_embedding) AS similarity
  FROM course_knowledge ck
  WHERE 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. Habilitar Supabase Realtime en las tablas chats y messages
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
