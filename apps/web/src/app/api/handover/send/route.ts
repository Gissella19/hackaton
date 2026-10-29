import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, content } = body;

    if (!chatId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos: chatId y content' }, { status: 400 });
    }

    // 1. Intentar enviar a través del OperatorServer de Persona 2 (puerto 3001)
    const operatorServerUrl = process.env.OPERATOR_SERVER_URL || 'http://localhost:3001/api/operator/send';

    try {
      const res = await fetch(operatorServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: Number(chatId), text: content })
      });

      if (res.ok) {
        return NextResponse.json({ success: true, via: 'operator_server' });
      }
    } catch {
      console.warn('[HandoverAPI] Servidor del bot no disponible en puerto 3001, usando fallback directo a Telegram...');
    }

    // 2. Fallback Directo con TELEGRAM_BOT_TOKEN si el bot corre en otro contenedor/proceso
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: content })
      });

      if (!tgRes.ok) {
        const errorText = await tgRes.text();
        return NextResponse.json({ error: `Fallo Telegram API: ${errorText}` }, { status: 502 });
      }

      // Persistir en Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender: 'operator',
          content
        });
      }

      return NextResponse.json({ success: true, via: 'direct_fallback' });
    }

    return NextResponse.json({ error: 'No se pudo despachar el mensaje al bot ni a Telegram' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
