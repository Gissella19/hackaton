'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { SecurityIncident } from '@hackaton/shared';
import { mapSentimentToLeadStatus } from '@/components/LeadThermometer';
import {
  ChatRecord,
  MessageRecord,
  CourseReference,
  DEMO_CHATS,
  DEMO_MESSAGES,
  DEMO_SECURITY_INCIDENTS,
  COURSE_CATALOG
} from '@/data/demoData';

export type ChatFilterTab = 'all' | 'hot' | 'human' | 'alerts';

export function useMissionControl() {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<
    Record<number, MessageRecord[]>
  >({});
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>(
    []
  );
  const [liveCatalog, setLiveCatalog] = useState<CourseReference[]>(COURSE_CATALOG);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<ChatFilterTab>('all');

  // Load live data from Supabase and subscribe to Realtime feeds
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDemoMode(true);
      setChats(DEMO_CHATS);
      setSelectedChatId(DEMO_CHATS[0]?.id ?? null);
      setMessagesByChat(DEMO_MESSAGES);
      setSecurityIncidents(DEMO_SECURITY_INCIDENTS);
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadFromSupabase() {
      setIsLoading(true);
      try {
        const [chatsRes, secRes, coursesRes] = await Promise.all([
          client
            .from('chats')
            .select('*')
            .order('updated_at', { ascending: false }),
          client
            .from('security_logs')
            .select('*')
            .order('detected_at', { ascending: false })
            .limit(25),
          client
            .from('course_knowledge')
            .select('course_code, course_name, official_price, max_scholarship_pct')
            .order('course_code', { ascending: true })
        ]);

        if (!isMounted) return;

        // 1. Process chats
        if (chatsRes.data && chatsRes.data.length > 0) {
          const loadedChats = chatsRes.data as ChatRecord[];
          setChats(loadedChats);
          setSelectedChatId((prev) =>
            prev && loadedChats.some((c) => c.id === prev)
              ? prev
              : loadedChats[0].id
          );
          setIsDemoMode(false);
        } else {
          // If the DB has 0 chats, offer demo fallback so the dashboard isn't blank
          setChats(DEMO_CHATS);
          setSelectedChatId(DEMO_CHATS[0]?.id ?? null);
          setMessagesByChat(DEMO_MESSAGES);
          setSecurityIncidents(DEMO_SECURITY_INCIDENTS);
          setIsDemoMode(true);
        }

        // 2. Process security logs (normalize chat_id -> conversation_id)
        if (secRes.data && secRes.data.length > 0) {
          const normalized: SecurityIncident[] = secRes.data.map((row: any) => ({
            id: String(row.id),
            conversation_id: String(row.chat_id || row.conversation_id || ''),
            attack_type: row.attack_type,
            raw_input: row.raw_input,
            severity: row.severity,
            detected_at: row.detected_at
          }));
          setSecurityIncidents(normalized);
        }

        // 3. Process courses from course_knowledge
        if (coursesRes.data && coursesRes.data.length > 0) {
          const map = new Map<string, CourseReference>();
          coursesRes.data.forEach((item: any) => {
            if (!map.has(item.course_code)) {
              map.set(item.course_code, {
                code: item.course_code,
                name: item.course_name,
                modality: 'Virtual / Presencial CTT-FISEI',
                officialPriceText: `$${item.official_price} USD · Beca máx ${item.max_scholarship_pct}%`
              });
            }
          });
          setLiveCatalog(Array.from(map.values()));
        }
      } catch (err) {
        console.warn('[useMissionControl] Fallback to demo data:', err);
        setChats(DEMO_CHATS);
        setSelectedChatId(DEMO_CHATS[0]?.id ?? null);
        setMessagesByChat(DEMO_MESSAGES);
        setSecurityIncidents(DEMO_SECURITY_INCIDENTS);
        setIsDemoMode(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadFromSupabase();

    // Realtime channel for chats (INSERT / UPDATE)
    const chatsChannel = client
      .channel('realtime_chats_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        (payload) => {
          setIsDemoMode(false);
          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as ChatRecord;
            setChats((prev) => {
              const withoutDemo = prev.filter(
                (c) => !DEMO_CHATS.some((d) => d.id === c.id)
              );
              const exists = withoutDemo.some((c) => c.id === incoming.id);
              return exists
                ? withoutDemo.map((c) => (c.id === incoming.id ? incoming : c))
                : [incoming, ...withoutDemo];
            });
            setSelectedChatId((prev) => prev ?? incoming.id);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ChatRecord;
            setChats((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          }
        }
      )
      .subscribe();

    // Realtime channel for security logs
    const secChannel = client
      .channel('realtime_security_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_logs' },
        (payload) => {
          const incoming = payload.new as any;
          const normalized: SecurityIncident = {
            id: String(incoming.id),
            conversation_id: String(incoming.chat_id || incoming.conversation_id || ''),
            attack_type: incoming.attack_type,
            raw_input: incoming.raw_input,
            severity: incoming.severity,
            detected_at: incoming.detected_at
          };
          setSecurityIncidents((prev) => [normalized, ...prev]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      client.removeChannel(chatsChannel);
      client.removeChannel(secChannel);
    };
  }, []);

  // Load messages for selected chat when connected to Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !selectedChatId || isDemoMode) {
      return;
    }

    const client = supabase;
    let isMounted = true;

    // Fetch historical messages for selected chat
    client
      .from('messages')
      .select('*')
      .eq('chat_id', selectedChatId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (isMounted && data) {
          setMessagesByChat((prev) => ({
            ...prev,
            [selectedChatId]: data as MessageRecord[]
          }));
        }
      });

    // Realtime subscription for incoming messages in this specific chat
    const msgChannel = client
      .channel(`chat_messages_${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${selectedChatId}`
        },
        (payload) => {
          const incoming = payload.new as MessageRecord;
          setMessagesByChat((prev) => {
            const current = prev[selectedChatId] || [];
            if (current.some((m) => m.id === incoming.id)) return prev;
            return {
              ...prev,
              [selectedChatId]: [...current, incoming]
            };
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      client.removeChannel(msgChannel);
    };
  }, [selectedChatId, isDemoMode]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || chats[0] || null,
    [chats, selectedChatId]
  );

  const messages = useMemo(
    () => (selectedChat ? messagesByChat[selectedChat.id] || [] : []),
    [messagesByChat, selectedChat]
  );

  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      const status = mapSentimentToLeadStatus(c.sentiment);
      if (activeFilter === 'hot' && status !== 'HOT_LEAD') {
        return false;
      }
      if (activeFilter === 'human' && !c.ai_paused) {
        return false;
      }
      if (activeFilter === 'alerts' && !c.security_flag) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.full_name?.toLowerCase().includes(q);
        const userMatch = c.username?.toLowerCase().includes(q);
        const courseMatch = c.active_course?.toLowerCase().includes(q);
        return Boolean(nameMatch || userMatch || courseMatch);
      }
      return true;
    });
  }, [chats, activeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = chats.length;
    const hot = chats.filter(
      (c) => mapSentimentToLeadStatus(c.sentiment) === 'HOT_LEAD'
    ).length;
    const human = chats.filter((c) => c.ai_paused).length;
    const alerts = chats.filter((c) => c.security_flag).length;
    return { total, hot, human, alerts };
  }, [chats]);

  const toggleHandover = useCallback(async () => {
    if (!selectedChat) return;
    const nextPaused = !selectedChat.ai_paused;
    const targetId = selectedChat.id;
    const nowIso = new Date().toISOString();

    setChats((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? { ...c, ai_paused: nextPaused, updated_at: nowIso }
          : c
      )
    );

    if (!isDemoMode) {
      try {
        await fetch('/api/handover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: targetId,
            aiPaused: nextPaused
          })
        });
      } catch (err) {
        console.error('[useMissionControl] Error toggling handover:', err);
      }
    }
  }, [selectedChat, isDemoMode]);

  const sendOperatorMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !selectedChat || isSending) return false;

      setIsSending(true);
      const targetId = selectedChat.id;
      const nowIso = new Date().toISOString();

      // Seamless Handover rule: operator message immediately sets ai_paused = true
      setChats((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                ai_paused: true,
                sentiment:
                  c.sentiment === 'frustrado' || c.sentiment === 'frustrated'
                    ? 'interesado'
                    : c.sentiment,
                updated_at: nowIso
              }
            : c
        )
      );

      const optimisticMessage: MessageRecord = {
        id: `op-${Date.now()}`,
        chat_id: targetId,
        sender: 'operator',
        content: trimmed,
        audio_url: null,
        created_at: nowIso
      };

      setMessagesByChat((prev) => ({
        ...prev,
        [targetId]: [...(prev[targetId] || []), optimisticMessage]
      }));

      try {
        if (!isDemoMode) {
          await fetch('/api/handover/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: targetId,
              content: trimmed
            })
          });
        }
        return true;
      } catch (err) {
        console.error('[useMissionControl] Error sending message:', err);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [selectedChat, isSending, isDemoMode]
  );

  const clearSecurityFlag = useCallback(async () => {
    if (!selectedChat) return;
    const targetId = selectedChat.id;
    const nowIso = new Date().toISOString();

    setChats((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? { ...c, security_flag: false, security_reason: null, updated_at: nowIso }
          : c
      )
    );

    if (!isDemoMode && supabase) {
      try {
        await supabase
          .from('chats')
          .update({
            security_flag: false,
            security_reason: null,
            updated_at: nowIso
          })
          .eq('id', targetId);
      } catch (err) {
        console.error('[useMissionControl] Error clearing security flag:', err);
      }
    }
  }, [selectedChat, isDemoMode]);

  const refreshLiveDatabase = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [chatsRes, secRes, coursesRes] = await Promise.all([
        supabase
          .from('chats')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('security_logs')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(25),
        supabase
          .from('course_knowledge')
          .select('course_code, course_name, official_price, max_scholarship_pct')
          .order('course_code', { ascending: true })
      ]);

      if (chatsRes.data && chatsRes.data.length > 0) {
        const loadedChats = chatsRes.data as ChatRecord[];
        setChats(loadedChats);
        setSelectedChatId((prev) =>
          prev && loadedChats.some((c) => c.id === prev)
            ? prev
            : loadedChats[0].id
        );
        setIsDemoMode(false);
      }

      if (secRes.data) {
        const normalized: SecurityIncident[] = secRes.data.map((row: any) => ({
          id: String(row.id),
          conversation_id: String(row.chat_id || row.conversation_id || ''),
          attack_type: row.attack_type,
          raw_input: row.raw_input,
          severity: row.severity,
          detected_at: row.detected_at
        }));
        setSecurityIncidents(normalized);
      }

      if (coursesRes.data && coursesRes.data.length > 0) {
        const map = new Map<string, CourseReference>();
        coursesRes.data.forEach((item: any) => {
          if (!map.has(item.course_code)) {
            map.set(item.course_code, {
              code: item.course_code,
              name: item.course_name,
              modality: 'Virtual / Presencial CTT-FISEI',
              officialPriceText: `$${item.official_price} USD · Beca máx ${item.max_scholarship_pct}%`
            });
          }
        });
        setLiveCatalog(Array.from(map.values()));
      }
    } catch (err) {
      console.error('[useMissionControl] Error refreshing live data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetDemoData = useCallback(() => {
    setChats(DEMO_CHATS);
    setMessagesByChat(DEMO_MESSAGES);
    setSecurityIncidents(DEMO_SECURITY_INCIDENTS);
    setSelectedChatId(DEMO_CHATS[0]?.id ?? null);
    setIsDemoMode(true);
  }, []);

  return {
    chats,
    filteredChats,
    selectedChat,
    selectedChatId,
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
  };
}
