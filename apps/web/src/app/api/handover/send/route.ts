import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationId, telegramChatId, content } = body;

    if (!conversationId || !telegramChatId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado en servidor web' }, { status: 500 });
    }

    // 1. Enviar mensaje por Telegram bajo la identidad del bot
    const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: content
      })
    });

    if (!tgRes.ok) {
      const errorText = await tgRes.text();
      return NextResponse.json({ error: `Fallo de Telegram API: ${errorText}` }, { status: 502 });
    }

    // 2. Persistir en la tabla messages de Supabase como OPERATOR
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'OPERATOR',
        content
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
