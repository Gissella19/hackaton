'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { SecurityIncident } from '@hackaton/shared';
import {
  ChatRecord,
  MessageRecord,
  DEMO_CHATS,
  DEMO_MESSAGES,
  DEMO_SECURITY_INCIDENTS
} from '@/data/demoData';

export type ChatFilterTab = 'all' | 'hot' | 'human' | 'alerts';

export function useMissionControl() {
  const [chats, setChats] = useState<ChatRecord[]>(DEMO_CHATS);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(
    DEMO_CHATS[0]?.id ?? null
  );
  const [messagesByChat, setMessagesByChat] =
    useState<Record<number, MessageRecord[]>>(DEMO_MESSAGES);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>(
    DEMO_SECURITY_INCIDENTS
  );
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<ChatFilterTab>('all');

  // Initial load & Realtime subscriptions when Supabase is configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDemoMode(true);
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadFromSupabase() {
      try {
        const [chatsRes, secRes] = await Promise.all([
          client
            .from('chats')
            .select('*')
            .order('updated_at', { ascending: false }),
          client
            .from('security_logs')
            .select('*')
            .order('detected_at', { ascending: false })
            .limit(15)
        ]);

        if (!isMounted) return;

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
          // Database has 0 rows yet; keep demo data visible so UI is immediately testable
          setIsDemoMode(true);
        }

        if (secRes.data && secRes.data.length > 0) {
          setSecurityIncidents(secRes.data as SecurityIncident[]);
        }
      } catch (err) {
        console.warn('[useMissionControl] Fallback to demo data:', err);
      }
    }

    loadFromSupabase();

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

    const secChannel = client
      .channel('realtime_security_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_logs' },
        (payload) => {
          setSecurityIncidents((prev) => [
            payload.new as SecurityIncident,
            ...prev
          ]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      client.removeChannel(chatsChannel);
      client.removeChannel(secChannel);
    };
  }, []);

  // Load messages for selected chat when connected to real Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !selectedChatId || isDemoMode) {
      return;
    }

    const client = supabase;
    let isMounted = true;

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
      if (activeFilter === 'hot' && c.sentiment.toLowerCase() !== 'lead caliente') {
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
      (c) => c.sentiment.toLowerCase() === 'lead caliente'
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
                  c.sentiment === 'frustrado' ? 'interesado' : c.sentiment,
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

  const clearSecurityFlag = useCallback(() => {
    if (!selectedChat) return;
    const targetId = selectedChat.id;
    setChats((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? { ...c, security_flag: false, security_reason: null }
          : c
      )
    );
  }, [selectedChat]);

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
    resetDemoData
  };
}
