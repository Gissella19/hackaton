'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, SecurityIncident } from '@hackaton/shared';
import { supabase } from '@/lib/supabaseClient';
import { LeadThermometer } from '@/components/LeadThermometer';
import { SecurityRadar } from '@/components/SecurityRadar';
import {
  Bot,
  UserCheck,
  Send,
  MessageSquare,
  Sparkles,
  Zap,
  Activity,
  Layers,
  PauseCircle,
  PlayCircle
} from 'lucide-react';

export default function MissionControlDashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);
  const [operatorInput, setOperatorInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carga inicial y suscripción a Realtime
  useEffect(() => {
    if (!supabase) return;

    // 1. Cargar conversaciones
    supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setConversations(data as Conversation[]);
          if (data.length > 0 && !selectedChat) {
            setSelectedChat(data[0] as Conversation);
          }
        }
      });

    // 2. Cargar incidentes de seguridad
    supabase
      .from('security_logs')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setSecurityIncidents(data as SecurityIncident[]);
      });

    // 3. Suscripción a cambios en conversaciones (Realtime)
    const convChannel = supabase
      .channel('realtime_conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConversations((prev) => [payload.new as Conversation, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setConversations((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Conversation) : c))
            );
            if (selectedChat?.id === payload.new.id) {
              setSelectedChat(payload.new as Conversation);
            }
          }
        }
      )
      .subscribe();

    // 4. Suscripción a incidentes de seguridad (Realtime)
    const secChannel = supabase
      .channel('realtime_security')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_logs' },
        (payload) => {
          setSecurityIncidents((prev) => [payload.new as SecurityIncident, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(secChannel);
    };
  }, [selectedChat]);

  // Cargar mensajes cuando cambia el chat seleccionado
  useEffect(() => {
    if (!supabase || !selectedChat) return;

    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedChat.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    // Suscripción a nuevos mensajes en el chat activo
    const msgChannel = supabase
      .channel(`chat_${selectedChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat.id}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Alternar Handover (Pausar IA / Reanudar IA)
  const toggleHandover = async () => {
    if (!selectedChat) return;
    const nextMode = selectedChat.control_mode === 'AI' ? 'HUMAN' : 'AI';

    try {
      await fetch('/api/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedChat.id,
          controlMode: nextMode
        })
      });

      setSelectedChat({ ...selectedChat, control_mode: nextMode });
    } catch (err) {
      console.error('Error toggling handover:', err);
    }
  };

  // Enviar mensaje como operador
  const handleSendOperatorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorInput.trim() || !selectedChat || isSending) return;

    setIsSending(true);
    const content = operatorInput.trim();
    setOperatorInput('');

    try {
      await fetch('/api/handover/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedChat.id,
          telegramChatId: selectedChat.telegram_chat_id,
          content
        })
      });
    } catch (err) {
      console.error('Error enviando mensaje de operador:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* HEADER TOP BAR */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 flex items-center gap-2">
              FISEI UTA 2026 <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">MISSION CONTROL</span>
            </h1>
            <p className="text-xs text-slate-400">Ecosistema Multi-Agente & Seamless Handover</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">Supabase Realtime:</span>
            <span className="text-emerald-400 font-mono font-semibold">ACTIVO</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400">Total Hilos:</span>
            <span className="text-slate-200 font-mono font-bold">{conversations.length}</span>
          </div>
        </div>
      </header>

      {/* MAIN 3-COLUMN WORKSPACE */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* COLUMNA 1: LISTA DE PROSPECTOS CONCURRENTES (3 COLS) */}
        <aside className="col-span-3 border-r border-slate-800 bg-slate-900/30 flex flex-col">
          <div className="p-3.5 border-b border-slate-800 font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Interacciones en Vivo</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {conversations.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Esperando interacciones de Telegram... Inicia una conversación enviando /start al bot.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = selectedChat?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChat(c)}
                    className={`w-full text-left p-3.5 transition-colors flex flex-col gap-2 ${
                      isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-200 truncate">
                        {c.prospect_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        #{c.telegram_chat_id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <LeadThermometer status={c.lead_status} score={c.sentiment_score} />
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                          c.control_mode === 'AI'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {c.control_mode === 'AI' ? '🤖 IA ACTIVA' : '👤 HUMANO'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMNA 2: CHAT DETAIL & INTERVENCIÓN HUMANA (6 COLS) */}
        <main className="col-span-6 flex flex-col bg-slate-950">
          {selectedChat ? (
            <>
              {/* CHAT HEADER & HANDOVER CONTROLS */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    {selectedChat.prospect_name}
                    <span className="text-xs font-normal text-slate-400">
                      (ID Telegram: {selectedChat.telegram_chat_id})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modo actual: <strong className="text-indigo-400">{selectedChat.control_mode}</strong>
                  </p>
                </div>

                {/* BOTÓN SEAMLESS HANDOVER */}
                <button
                  onClick={toggleHandover}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
                    selectedChat.control_mode === 'AI'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                  }`}
                >
                  {selectedChat.control_mode === 'AI' ? (
                    <>
                      <PauseCircle className="w-4 h-4" />
                      Intervenir (Congelar IA)
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      Reanudar IA Automática
                    </>
                  )}
                </button>
              </div>

              {/* MESSAGE STREAM */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No hay mensajes en este hilo aún.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isUser = m.sender_type === 'USER';
                    const isOp = m.sender_type === 'OPERATOR';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow ${
                            isUser
                              ? 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'
                              : isOp
                              ? 'bg-amber-600 text-white rounded-br-sm'
                              : 'bg-indigo-600 text-white rounded-br-sm'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-75 font-semibold">
                            {isUser && <MessageSquare className="w-3 h-3" />}
                            {!isUser && !isOp && <Bot className="w-3 h-3" />}
                            {isOp && <UserCheck className="w-3 h-3" />}
                            <span>{isUser ? 'Prospecto' : isOp ? 'Operador (Vos)' : 'Agente IA'}</span>
                            {m.is_voice_transcribed && (
                              <span className="bg-black/30 px-1 rounded text-[9px]">Transcriptor</span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 px-1">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* OPERATOR INPUT BOX */}
              <form onSubmit={handleSendOperatorMessage} className="p-3 border-t border-slate-800 bg-slate-900/60 flex gap-2">
                <input
                  type="text"
                  placeholder={
                    selectedChat.control_mode === 'HUMAN'
                      ? 'Escribe tu respuesta como operador humano...'
                      : 'La IA está respondiendo en automático (Haz clic en Intervenir para tomar control)...'
                  }
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  disabled={isSending}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!operatorInput.trim() || isSending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Selecciona un chat en la lista para auditar o intervenir.
            </div>
          )}
        </main>

        {/* COLUMNA 3: COPILOTO DE HANDOVER & RADAR DE SEGURIDAD (3 COLS) */}
        <aside className="col-span-3 border-l border-slate-800 bg-slate-900/30 p-4 space-y-4 overflow-y-auto">
          {/* COPILOTO DE HANDOVER (WHISPER SUMMARY) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-indigo-400">
              <Sparkles className="w-4 h-4" />
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-200">
                Copiloto de Handover
              </h3>
            </div>

            {selectedChat?.lead_memory ? (
              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Interés:</span>
                  <p className="font-medium text-slate-200">{selectedChat.lead_memory.interest || 'General'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Principal Objeción:</span>
                  <p className="font-medium text-amber-400">{selectedChat.lead_memory.main_objection || 'Ninguna registrada'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Acción Recomendada:</span>
                  <p className="p-2 rounded bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 text-[11px] font-medium leading-relaxed">
                    {selectedChat.lead_memory.suggested_human_action || 'Cerrar matriculación con plan de pago oficial.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-3">Sin memoria de prospecto aún.</p>
            )}
          </div>

          {/* RADAR DE SEGURIDAD */}
          <SecurityRadar incidents={securityIncidents} />
        </aside>
      </div>
    </div>
  );
}
