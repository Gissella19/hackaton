/**
 * OperatorServer — "El canal de envío del operador humano"
 *
 * Responsabilidad Única (SRP):
 * Exponer un endpoint HTTP (POST /api/operator/send) para que el Dashboard Web
 * pueda inyectar mensajes directos al chat de Telegram del prospecto bajo la
 * misma identidad oficial del bot, persistiendo el evento como `sender: 'operator'`.
 */

import http from 'http';
import { Bot } from 'grammy';
import { saveMessage } from '../services/supabase.service.js';

export function startOperatorServer(bot: Bot, port = 3001) {
  const server = http.createServer(async (req, res) => {
    // CORS headers para permitir llamadas desde el dashboard Next.js
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/operator/send') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const { chatId, text } = payload;

          if (!chatId || !text) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Faltan parámetros: chatId y text son obligatorios' }));
            return;
          }

          // 1. Enviar mensaje por Telegram usando la instancia oficial del bot
          await bot.api.sendMessage(chatId, text);

          // 2. Persistir en la base de datos como 'operator'
          await saveMessage({
            chatId: Number(chatId),
            sender: 'operator',
            content: text
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, chatId, sentAt: new Date().toISOString() }));
          console.log(`[OperatorServer] Mensaje de operador enviado a chat #${chatId}: "${text}"`);
        } catch (err: any) {
          console.error('[OperatorServer] Error enviando mensaje del operador:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Error interno del servidor' }));
        }
      });
      return;
    }

    // Ruta no encontrada o healthcheck
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'bot-operator-server' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  server.listen(port, () => {
    console.log(`[OperatorServer] Servidor HTTP de Handover escuchando en http://localhost:${port}`);
  });

  return server;
}
