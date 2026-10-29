/**
 * DebounceQueue — "El buffer anti-ametralladora"
 *
 * Responsabilidad Única (SRP):
 * Acumular ráfagas de mensajes de un mismo usuario en Telegram durante una ventana
 * de tiempo (1.5s por defecto). Emite un único evento con todos los mensajes concatenados,
 * evitando llamadas múltiples, desordenadas y costosas al modelo de IA.
 */

type DebounceCallback = (consolidatedText: string) => Promise<void> | void;

interface PendingEntry {
  messages: string[];
  timer: NodeJS.Timeout;
  callback: DebounceCallback;
}

export class DebounceQueue {
  private queue = new Map<number, PendingEntry>();
  private readonly delayMs: number;

  constructor(delayMs = 1500) {
    this.delayMs = delayMs;
  }

  /**
   * Encola un mensaje para un usuario específico.
   * Si el usuario sigue escribiendo dentro del tiempo límite, reinicia el temporizador.
   */
  public enqueue(chatId: number, text: string, onExecute: DebounceCallback): void {
    const existing = this.queue.get(chatId);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(text);
      existing.callback = onExecute; // Actualiza el callback al más reciente
      existing.timer = setTimeout(() => this.flush(chatId), this.delayMs);
    } else {
      const timer = setTimeout(() => this.flush(chatId), this.delayMs);
      this.queue.set(chatId, {
        messages: [text],
        timer,
        callback: onExecute
      });
    }
  }

  /**
   * Vence el temporizador: consolida los textos y ejecuta el callback.
   */
  private async flush(chatId: number): Promise<void> {
    const entry = this.queue.get(chatId);
    if (!entry) return;

    this.queue.delete(chatId);

    const consolidatedText = entry.messages.join('\n');
    try {
      await entry.callback(consolidatedText);
    } catch (err) {
      console.error(`[DebounceQueue] Error procesando ráfaga para chat ${chatId}:`, err);
    }
  }

  /**
   * Cancela cualquier cola pendiente para un chat (ej: si se reinicia la sesión).
   */
  public cancel(chatId: number): void {
    const entry = this.queue.get(chatId);
    if (entry) {
      clearTimeout(entry.timer);
      this.queue.delete(chatId);
    }
  }
}

export const debounceQueue = new DebounceQueue(1500);
