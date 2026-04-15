import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { parseRemitoText, reconcileOrderVsRemito } from '@/lib/agenda-remito-parser';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

// POST /api/logistica/agenda/remito/parse
// Body: { raw_text, catalog?, order_items? }
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { raw_text, catalog, order_items } = body;

    if (!raw_text?.trim()) {
      return NextResponse.json({ error: 'raw_text requerido' }, { status: 400 });
    }

    const parsed = parseRemitoText(raw_text, catalog);

    let reconciliation = null;
    if (order_items && Array.isArray(order_items)) {
      reconciliation = reconcileOrderVsRemito(order_items, parsed);
    }

    return NextResponse.json({ parsed, reconciliation });
  } catch (err) {
    console.error('Error parseando remito:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
