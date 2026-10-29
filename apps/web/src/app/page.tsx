'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMissionControl, ChatFilterTab } from '@/hooks/useMissionControl';
import {
  LeadThermometer,
  mapSentimentToLeadStatus
} from '@/components/LeadThermometer';
import { SecurityRadar } from '@/components/SecurityRadar';
import { resolveCourseReference } from '@/data/demoData';
import {
  Bot,
  UserCheck,
  Send,
  Search,
  Mic,
  ArrowUpRight,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  FileText
} from 'lucide-react';

const SSR_REFERENCE_MS = Date.parse('2026-10-29T17:45:00.000Z');

function formatRelativeTime(isoDate: string, nowMs: number): string {
  const diffMs = nowMs - new Date(isoDate).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h`;
  return `${Math.floor(diffHours / 24)} d`;
}

function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const FILTER_TABS: Array<{ id: ChatFilterTab; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'hot', label: 'Calientes' },
  { id: 'human', label: 'Humano' },
  { id: 'alerts', label: 'Alertas' }
];

export default function MissionControlDashboard() {
  const {
    filteredChats,
    selectedChat,
    setSelectedChatId,
    messages,
    securityIncidents,
    liveCatalog,
    isLoading,
    isDemoMode,
    isSending,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    stats,
    toggleHandover,
    sendOperatorMessage,
    clearSecurityFlag,
    refreshLiveDatabase,
    resetDemoData
  } = useMissionControl();

  const [operatorInput, setOperatorInput] = useState('');
  const [isSendingPdf, setIsSendingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(SSR_REFERENCE_MS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!textarea.value) {
      textarea.style.height = '44px';
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 180)}px`;
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [operatorInput, syncTextareaHeight]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedChat?.id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = operatorInput.trim();
    if (!content || !selectedChat || isSending) return;

    setOperatorInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    await sendOperatorMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleInsertSuggestedReply = () => {
    if (!selectedChat?.suggested_reply) return;
    setOperatorInput(selectedChat.suggested_reply);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 180)}px`;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
  };

  const handleSendSuggestedNow = async () => {
    if (!selectedChat?.suggested_reply || isSending) return;
    await sendOperatorMessage(selectedChat.suggested_reply);
  };

  const handleEmitPdf = async () => {
    if (!selectedChat || isSendingPdf) return;
    setIsSendingPdf(true);
    setPdfSuccessMessage(null);
    try {
      const res = await fetch('/api/handover/send-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id })
      });
      if (res.ok) {
        setPdfSuccessMessage('¡Orden de pago enviada con éxito!');
        setTimeout(() => setPdfSuccessMessage(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al emitir PDF: ${err.error || 'No se pudo generar el documento'}`);
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
    } finally {
      setIsSendingPdf(false);
    }
  };

  const courseRef = resolveCourseReference(
    selectedChat?.active_course ?? null,
    liveCatalog
  );

  const chatIncidents = selectedChat
    ? securityIncidents.filter(
        (inc) =>
          !inc.conversation_id ||
          String(inc.conversation_id) === String(selectedChat.id)
      )
    : securityIncidents;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#07090E] text-slate-100">
      {/* 1. CLEAN TOP HEADER (56px) */}
      <header className="h-14 shrink-0 border-b border-[#1E2638] bg-[#0B0F17] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-tight text-slate-100">
            FISEI · Centro de Control
          </span>
          <span className="h-3.5 w-[1px] bg-[#1E2638]" />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                isDemoMode
                  ? 'bg-sky-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span>
              {isDemoMode ? 'Modo demostración' : 'Supabase en vivo'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1E2638] bg-[#07090E] px-3 py-1">
            <span className="text-slate-400">Conversaciones</span>
            <span className="font-mono font-semibold text-slate-200">
              {stats.total}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1">
            <span className="text-emerald-300/90">Leads calientes</span>
            <span className="font-mono font-semibold text-emerald-400">
              {stats.hot}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
              stats.alerts > 0
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-[#1E2638] bg-[#07090E] text-slate-400'
            }`}
          >
            <span>Alertas</span>
            <span className="font-mono font-semibold">{stats.alerts}</span>
          </div>

          {!isDemoMode ? (
            <button
              type="button"
              onClick={refreshLiveDatabase}
              title="Refrescar datos en vivo de Supabase"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1E2638] bg-[#07090E] hover:bg-slate-800/60 px-2.5 py-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading ? 'animate-spin text-sky-400' : ''}`}
              />
              <span>Refrescar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={resetDemoData}
              title="Restaurar conversación de prueba"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1E2638] bg-[#07090E] hover:bg-slate-800/60 px-2.5 py-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reiniciar demo</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN 3-COLUMN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* 2. LEFT SIDEBAR — CONVERSACIONES (310px) */}
        <aside className="w-[310px] shrink-0 border-r border-[#1E2638] bg-[#090D15] flex flex-col">
          <div className="p-3 space-y-2.5 border-b border-[#1E2638]">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar prospecto o curso..."
                className="w-full rounded-lg border border-[#1E2638] bg-[#07090E] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#07090E] p-1 border border-[#1E2638]">
              {FILTER_TABS.map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`rounded-md py-1 text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[#182235] text-slate-100 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#1E2638]/60">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                Sincronizando con Supabase...
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <p>No hay conversaciones que coincidan con este filtro.</p>
                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={resetDemoData}
                    className="text-sky-400 hover:underline text-[11px]"
                  >
                    Cargar conversaciones de prueba
                  </button>
                ) : null}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = selectedChat?.id === chat.id;
                const leadStatus = mapSentimentToLeadStatus(chat.sentiment);

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`w-full text-left px-3.5 py-3 transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-[#121929] border-l-2 border-l-sky-400'
                        : 'hover:bg-[#0E1420]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs text-slate-100 truncate">
                        {chat.full_name || 'Prospecto'}
                      </span>
                      <span
                        suppressHydrationWarning
                        className="font-mono text-[11px] text-slate-500 shrink-0"
                      >
                        {formatRelativeTime(chat.updated_at, nowMs)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate">
                      {chat.active_course || 'Consulta general CTT-FISEI'}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <LeadThermometer status={leadStatus} compact />

                      <div className="flex items-center gap-1.5">
                        {chat.security_flag ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Alerta
                          </span>
                        ) : null}

                        {chat.ai_paused ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            Humano
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            IA activa
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* 3. CENTER COLUMN — CHAT STREAM & AUTO-EXPANDING INPUT */}
        <main className="flex-1 flex flex-col bg-[#07090E] min-w-0">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 shrink-0 border-b border-[#1E2638] bg-[#0B0F17]/80 px-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-semibold text-sm text-slate-100 truncate">
                      {selectedChat.full_name}
                    </h2>
                    {selectedChat.username ? (
                      <span className="font-mono text-xs text-slate-400 truncate">
                        @{selectedChat.username}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {selectedChat.active_course || courseRef.name}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      selectedChat.ai_paused
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selectedChat.ai_paused ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                    />
                    {selectedChat.ai_paused
                      ? 'Control humano activo'
                      : 'IA respondiendo'}
                  </span>

                  <button
                    type="button"
                    onClick={toggleHandover}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                      selectedChat.ai_paused
                        ? 'border-[#1E2638] bg-[#121929] hover:bg-[#192338] text-slate-200'
                        : 'border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
                    }`}
                  >
                    {selectedChat.ai_paused
                      ? 'Devolver a la IA'
                      : 'Tomar control humano'}
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No hay mensajes registrados en esta conversación.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isUser = m.sender === 'user';
                    const isOp = m.sender === 'operator';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          isUser ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                          {isUser ? (
                            <span className="font-medium text-slate-300">
                              {selectedChat.full_name}
                            </span>
                          ) : isOp ? (
                            <span className="font-medium text-emerald-300 flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              Operador humano
                            </span>
                          ) : (
                            <span className="font-medium text-sky-300 flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              Asesor IA
                            </span>
                          )}
                          <span
                            suppressHydrationWarning
                            className="font-mono text-[10px] text-slate-500"
                          >
                            {formatMessageTime(m.created_at)}
                          </span>
                        </div>

                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                            isUser
                              ? 'bg-[#101622] border-[#1E2638] text-slate-100 rounded-tl-sm'
                              : isOp
                              ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-50 rounded-tr-sm'
                              : 'bg-[#0D1829] border-sky-500/25 text-slate-100 rounded-tr-sm'
                          }`}
                        >
                          {m.audio_url ? (
                            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[11px] text-sky-300">
                              <Mic className="h-3 w-3" />
                              <span>Nota de voz transcrita</span>
                            </div>
                          ) : null}

                          <p className="whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Auto-Expanding Textarea Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 border-t border-[#1E2638] bg-[#0B0F17] px-5 py-3"
              >
                <div className="flex items-end gap-2.5">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={operatorInput}
                    onChange={(e) => {
                      setOperatorInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(
                        Math.max(e.target.scrollHeight, 44),
                        180
                      )}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    placeholder={
                      selectedChat.ai_paused
                        ? 'Escribe tu respuesta para el prospecto...'
                        : 'Escribe un mensaje para tomar el control y responder directamente...'
                    }
                    style={{ height: '44px', maxHeight: '180px' }}
                    className="flex-1 resize-none overflow-y-auto rounded-xl border border-[#1E2638] bg-[#07090E] px-3.5 py-2.5 text-xs leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!operatorInput.trim() || isSending}
                    className="h-[44px] shrink-0 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 px-4 text-xs font-semibold text-slate-950 flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>Enter para enviar · Shift+Enter para salto de línea</span>
                  <span>
                    {selectedChat.ai_paused
                      ? 'La IA está en pausa en este chat'
                      : 'Al enviar un mensaje tomarás el control automáticamente'}
                  </span>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Selecciona una conversación a la izquierda para revisar el hilo.
            </div>
          )}
        </main>

        {/* 4. RIGHT SIDEBAR — COPILOTO & SEGURIDAD (330px) */}
        <aside className="w-[330px] shrink-0 border-l border-[#1E2638] bg-[#090D15] p-4 space-y-4 overflow-y-auto">
          {selectedChat ? (
            <>
              {/* Resumen de la conversación */}
              <section className="rounded-xl border border-[#1E2638] bg-[#0B0F17] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-slate-200">
                    Resumen de la conversación
                  </h3>
                  <LeadThermometer
                    status={mapSentimentToLeadStatus(selectedChat.sentiment)}
                    compact
                  />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedChat.summary ||
                    'El agente está recopilando el perfil e interés académico del prospecto.'}
                </p>

                <div className="pt-2 border-t border-[#1E2638] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Arancel oficial</span>
                    <span className="font-mono text-slate-200">
                      {courseRef.officialPriceText}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Tokens ahorrados (RAG)</span>
                    <span className="font-mono text-slate-400">
                      {selectedChat.tokens_saved || 0}
                    </span>
                  </div>
                </div>
              </section>

              {/* Respuesta sugerida */}
              <section className="rounded-xl border border-[#1E2638] bg-[#0B0F17] p-4 space-y-3">
                <div className="flex items-center gap-2 text-sky-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <h3 className="text-xs font-medium text-slate-200">
                    Respuesta sugerida
                  </h3>
                </div>

                <p className="rounded-lg border border-[#1E2638] bg-[#07090E] p-3 text-xs text-slate-300 leading-relaxed">
                  {selectedChat.suggested_reply ||
                    'Hola, te saluda el coordinador académico del CTT-FISEI. ¿En qué puedo ayudarte para completar tu inscripción?'}
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleInsertSuggestedReply}
                    className="w-full rounded-lg border border-[#1E2638] bg-[#121929] hover:bg-[#192338] px-3 py-2 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
                    <span>Pasar al cuadro de texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendSuggestedNow}
                    disabled={isSending}
                    className="w-full rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-40 px-3 py-2 text-xs font-medium text-emerald-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="h-3 w-3" />
                    <span>Enviar ahora</span>
                  </button>
                </div>
              </section>

              {/* Formalización y Orden de Pago Oficial (PDF) */}
              <section className="rounded-xl border border-[#1E2638] bg-[#0B0F17] p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300">
                  <FileText className="h-3.5 w-3.5" />
                  <h3 className="text-xs font-medium text-slate-200">
                    Orden de Pago & Ficha (PDF)
                  </h3>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Genera la orden oficial en formato A4 con arancel de {courseRef.officialPriceText}, datos del prospecto, código de trámite y cuenta institucional.
                </p>

                {pdfSuccessMessage ? (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-center text-xs text-emerald-300">
                    {pdfSuccessMessage}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleEmitPdf}
                  disabled={isSendingPdf}
                  className="w-full rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 disabled:opacity-40 px-3 py-2 text-xs font-medium text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileText className={`h-3 w-3 ${isSendingPdf ? 'animate-bounce' : ''}`} />
                  <span>{isSendingPdf ? 'Generando PDF...' : 'Emitir Orden de Pago a Telegram'}</span>
                </button>
              </section>

              {/* Estado de seguridad */}
              <SecurityRadar
                incidents={chatIncidents}
                activeSecurityFlag={selectedChat.security_flag}
                activeSecurityReason={selectedChat.security_reason}
                onClearSecurityFlag={clearSecurityFlag}
              />
            </>
          ) : (
            <div className="rounded-xl border border-[#1E2638] bg-[#0B0F17] p-4 text-xs text-slate-500">
              Selecciona una conversación para ver el resumen y sugerencias.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
