import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: 'Falta el parámetro requerido: chatId' },
        { status: 400 }
      );
    }

    const operatorPdfUrl =
      process.env.OPERATOR_PDF_URL || 'http://localhost:3001/api/operator/send-pdf';

    const res = await fetch(operatorPdfUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: Number(chatId) })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Error en el servidor del bot al despachar PDF' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('[API send-pdf] Error conectando con el bot:', err);
    return NextResponse.json(
      { error: err.message || 'Error conectando con el servicio del bot' },
      { status: 500 }
    );
  }
}
