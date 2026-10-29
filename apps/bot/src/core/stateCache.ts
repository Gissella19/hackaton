/**
 * StateCache — "El semáforo ultrarrápido en RAM a 0 milisegundos"
 *
 * Responsabilidad Única (SRP):
 * Mantener en memoria viva el estado de pausa de la IA (`ai_paused`) para cada chat_id,
 * sincronizándose en tiempo real mediante WebSockets con Supabase. Permite al bot
 * saber si debe responder o guardar silencio absoluto en 0 ms sin hacer queries SQL lentas.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export class StateCache {
  private cache = new Map<number, boolean>();
  private isSynced = false;

  /**
   * Consulta el semáforo en memoria RAM (0 ms reales).
   * Retorna true si la IA está pausada (un humano está al mando).
   */
  public isAiPaused(chatId: number): boolean {
    return this.cache.get(chatId) === true;
  }

  /**
   * Actualiza el semáforo en RAM localmente.
   */
  public setAiPaused(chatId: number, paused: boolean): void {
    this.cache.set(chatId, paused);
    console.log(`[StateCache] Semáforo chat #${chatId} -> ai_paused: ${paused} (RAM)`);
  }

  /**
   * Inicializa la suscripción a Supabase Realtime (WebSockets)
   * y precarga los estados activos en la base de datos.
   */
  public async initRealtimeStateSync(supabase: SupabaseClient): Promise<void> {
    if (this.isSynced) return;

    try {
      // 1. Precarga inicial en memoria
      const { data, error } = await supabase
        .from('chats')
        .select('id, ai_paused');

      if (!error && data) {
        data.forEach((row: { id: number; ai_paused: boolean }) => {
          this.cache.set(Number(row.id), !!row.ai_paused);
        });
        console.log(`[StateCache] Precarga exitosa: ${this.cache.size} chats cacheados en RAM.`);
      }

      // 2. Suscripción a cambios de Postgres vía WebSockets
      supabase
        .channel('state_cache_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chats' },
          (payload: any) => {
            if (payload.new && payload.new.id !== undefined) {
              const chatId = Number(payload.new.id);
              const aiPaused = !!payload.new.ai_paused;
              this.setAiPaused(chatId, aiPaused);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[StateCache] Canal Realtime conectado: ${status}`);
        });

      this.isSynced = true;
    } catch (err) {
      console.error('[StateCache] Error conectando Realtime State Sync:', err);
    }
  }
}

export const stateCache = new StateCache();
