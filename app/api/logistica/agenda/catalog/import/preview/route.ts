import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { parseCatalogPreviewFromBuffer } from '@/lib/agenda-import';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'];

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = parseCatalogPreviewFromBuffer(buffer);
    if (preview.total === 0) return NextResponse.json({ error: 'No se encontraron artículos en el archivo' }, { status: 400 });
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error('Error en preview catálogo:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
