import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { buildEmployeeTemplate, buildArticlesTemplate } from '@/lib/agenda-import';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'employees';

  const buffer = type === 'articles_migration' ? buildArticlesTemplate() : buildEmployeeTemplate();
  const filename = type === 'articles_migration' ? 'plantilla_articulos_migracion.xlsx' : 'plantilla_empleados.xlsx';

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
