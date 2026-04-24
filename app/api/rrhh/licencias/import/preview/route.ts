import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { parseLicenciasFromExcel } from '@/lib/licencias-import';

export const maxDuration = 60;

// Cantidad de filas de muestra que devolvemos para mostrar en la UI.
const PREVIEW_ROWS = 50;

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede previsualizar' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const yearParam = form.get('year');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    const year = parseInt(String(yearParam || ''), 10) || new Date().getFullYear();

    const buffer = Buffer.from(await file.arrayBuffer());
    const { validas, errores, totalFilas, descartadas } = parseLicenciasFromExcel(buffer, year);

    // Stats por tipo y por sector — útil para validar la distribución.
    const porTipo: Record<string, number> = {};
    const porSector: Record<string, number> = {};
    let sinFechas = 0;
    let sinSector = 0;
    for (const v of validas) {
      porTipo[v.tipo_licencia] = (porTipo[v.tipo_licencia] || 0) + 1;
      const sectorKey = v.sector || '(sin sector)';
      porSector[sectorKey] = (porSector[sectorKey] || 0) + 1;
      if (!v.desde) sinFechas++;
      if (!v.sector) sinSector++;
    }

    return NextResponse.json({
      totalFilas,
      validas: validas.length,
      descartadas,
      sinFechas,
      sinSector,
      porTipo,
      porSector,
      primeras: validas.slice(0, PREVIEW_ROWS),
      errores: errores.slice(0, 20),
    });
  } catch (err) {
    console.error('Error en preview de licencias:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
