/**
 * VoiceService — "El traductor de notas de voz multimodal"
 *
 * Responsabilidad Única (SRP):
 * Descargar notas de voz y archivos de audio desde los servidores de Telegram (.ogg, .mp3, .wav, .m4a)
 * y transcribirlas a texto en alta velocidad utilizando Gemini Multimodal,
 * permitiendo que el flujo del bot procese audios con las mismas garantías de seguridad que el texto.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

export class VoiceService {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: config.geminiApiKey
      });
    }
    return this.client;
  }

  /**
   * Descarga el archivo de audio desde los servidores de Telegram como Buffer binario.
   */
  public async downloadTelegramVoice(filePath: string): Promise<Buffer> {
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fallo al descargar nota de voz de Telegram: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Detecta el MIME type adecuado según la extensión del archivo de Telegram.
   */
  public detectAudioMime(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.mp3')) return 'audio/mp3';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.m4a')) return 'audio/m4a';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.flac')) return 'audio/flac';
    return 'audio/ogg'; // Default para Telegram voice notes
  }

  /**
   * Envía el buffer a Gemini para transcribirlo fielmente en español.
   * Utiliza fallback multi-modelo con gemini-3.5-flash-lite y gemini-3.8-flash.
   */
  public async transcribeVoiceBuffer(
    audioBuffer: Buffer,
    mimeType: string = 'audio/ogg'
  ): Promise<string> {
    if (!config.geminiApiKey) {
      console.warn('[VoiceService] No hay GEMINI_API_KEY configurada.');
      throw new Error('Falta GEMINI_API_KEY');
    }

    const base64Data = audioBuffer.toString('base64');
    const ai = this.getClient();

    const promptText =
      'Eres un transcriptor de audio de alta fidelidad para el CTT-FISEI en Ecuador.\n' +
      'Transcribe exactamente palabra por palabra lo que la persona dice en español en este audio.\n' +
      'Devuelve ÚNICAMENTE el texto transcrito directo, sin comillas, sin explicaciones ni notas adicionales.';

    const models = ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    // 1. Intentar con models.generateContent (estrategia multimodal nativa)
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        });

        const text = response.text?.trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        console.warn(`[VoiceService] Falló generateContent con ${model}:`, err?.message || err);
      }
    }

    // 2. Intentar con interactions.create ({ type: 'audio' })
    for (const model of models) {
      try {
        const response = await ai.interactions.create({
          model,
          input: [
            { type: 'text', text: promptText },
            {
              type: 'audio',
              data: base64Data,
              mime_type: mimeType
            }
          ]
        });

        const text = response.output_text?.trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        console.warn(`[VoiceService] Falló interactions.create con ${model}:`, err?.message || err);
      }
    }

    throw new Error('No se pudo transcribir el audio tras agotar todos los modelos.');
  }
}

export const voiceService = new VoiceService();
