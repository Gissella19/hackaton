/**
 * VoiceService — "El traductor de notas de voz multimodal"
 *
 * Responsabilidad Única (SRP):
 * Descargar notas de voz desde los servidores de Telegram (.ogg) y transcribirlas
 * a texto en alta velocidad utilizando Gemini 3.8 Flash / Gemini Transcribe,
 * permitiendo que el flujo del bot procese audios como si fuesen texto normal.
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
   * Envía el buffer .ogg a Gemini para transcribirlo fielmente en español.
   */
  public async transcribeVoiceBuffer(audioBuffer: Buffer): Promise<string> {
    if (!config.geminiApiKey) {
      console.warn('[VoiceService] No hay GEMINI_API_KEY configurada. Fallback simulado.');
      return '[Audio no transcrito: Falta GEMINI_API_KEY]';
    }

    try {
      const base64Data = audioBuffer.toString('base64');
      const ai = this.getClient();

      const response = await ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: [
          {
            type: 'text',
            text: 'Eres un transcriptor de audio de alta fidelidad para prospectos de cursos universitarios en Ecuador. Transcribe este mensaje de voz palabra por palabra en español. No agregues explicaciones, comentarios ni formato adicional, solo devuelve la transcripción directa.'
          },
          {
            type: 'media',
            mime_type: 'audio/ogg',
            data: base64Data
          } as any
        ]
      });

      const transcription = response.output_text?.trim() || '';
      return transcription || '[Audio ininteligible o vacío]';
    } catch (err) {
      console.error('[VoiceService] Error transcribiendo audio con Gemini:', err);
      return '[Error en transcripción de audio]';
    }
  }
}

export const voiceService = new VoiceService();
