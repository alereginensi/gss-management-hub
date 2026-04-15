import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { buildCatalogTemplate } from '@/lib/agenda-import';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const buffer = buildCatalogTemplate();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_catalogo.xlsx"',
    },
  });
}
