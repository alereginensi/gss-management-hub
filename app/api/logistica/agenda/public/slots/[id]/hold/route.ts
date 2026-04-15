import { NextRequest, NextResponse } from 'next/server';
import { holdSlot, releaseHold, getSlotConfig } from '@/lib/agenda-helpers';

// POST: Intentar retener el turno temporalmente
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const slotId = parseInt(idStr, 10);
    if (isNaN(slotId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const { hold_token } = await request.json();
    if (!hold_token?.trim()) {
      return NextResponse.json({ error: 'hold_token requerido' }, { status: 400 });
    }

    const config = await getSlotConfig();
    const success = await holdSlot(slotId, hold_token, config.hold_duration_seconds);

    if (!success) {
      return NextResponse.json(
        { error: 'El turno ya no está disponible. Otro usuario lo está reservando o ya no tiene cupo.', conflict: true },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      hold_token,
      expires_in_seconds: config.hold_duration_seconds,
    });
  } catch (err) {
    console.error('Error en hold de slot:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE: Liberar hold (si el usuario cambia de turno o cancela)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const slotId = parseInt(idStr, 10);
    if (isNaN(slotId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const { hold_token } = await request.json();
    if (!hold_token) return NextResponse.json({ error: 'hold_token requerido' }, { status: 400 });

    await releaseHold(slotId, hold_token);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error liberando hold:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
