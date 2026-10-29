import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, aiPaused } = body;

    if (chatId === undefined || aiPaused === undefined) {
      return NextResponse.json(
        { error: 'Faltan parámetros: chatId y aiPaused' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        simulated: true,
        chatId,
        aiPaused
      });
    }

    const { error } = await supabase
      .from('chats')
      .update({ ai_paused: aiPaused, updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, chatId, aiPaused });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
