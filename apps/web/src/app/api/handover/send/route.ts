import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, content } = body;

    if (!chatId || !content) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: chatId y content' },
        { status: 400 }
      );
    }

    // 1. Try dispatching via the Bot OperatorServer (port 3001)
    const operatorServerUrl =
      process.env.OPERATOR_SERVER_URL || 'http://localhost:3001/api/operator/send';

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
      // Bot server not running on 3001; proceed to fallback
    }

    // 2. Direct Telegram Bot Token fallback if configured
    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const hasValidToken =
      token.length > 10 &&
      token !== 'TU_TELEGRAM_BOT_TOKEN' &&
      !token.startsWith('123456789:');

    if (hasValidToken) {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: content })
      });

      if (!tgRes.ok) {
        const errorText = await tgRes.text();
        return NextResponse.json(
          { error: `Fallo Telegram API: ${errorText}` },
          { status: 502 }
        );
      }
    }

    // 3. Persist message in Supabase if configured
    if (isSupabaseConfigured && supabase) {
      await Promise.all([
        supabase.from('messages').insert({
          chat_id: chatId,
          sender: 'operator',
          content
        }),
        supabase
          .from('chats')
          .update({ ai_paused: true, updated_at: new Date().toISOString() })
          .eq('id', chatId)
      ]);
      return NextResponse.json({
        success: true,
        via: hasValidToken ? 'direct_fallback' : 'supabase_only'
      });
    }

    // 4. Offline / Demo Simulation fallback (never throw 500 when testing locally without keys)
    return NextResponse.json({
      success: true,
      simulated: true,
      via: 'demo_mode'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
