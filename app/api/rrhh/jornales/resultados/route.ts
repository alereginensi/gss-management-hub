import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole, buildResultados, ResultadoInput } from '@/lib/jornales-helpers';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const umbral = parseInt(searchParams.get('umbral') || '100', 10) || 100;

    // Cálculo por persona: jornales (días únicos) y último servicio (por fecha)
    const rows = await db.query(
      `SELECT p.padron, p.nombre, p.doc, p.efectividad_autorizada,
              COUNT(DISTINCT m.fecha) AS jornales,
              (SELECT m2.lugar FROM jornales_marcas m2
               WHERE m2.padron = p.padron
               ORDER BY m2.fecha DESC
               LIMIT 1) AS ultimo_servicio
       FROM jornales_personal p
       LEFT JOIN jornales_marcas m ON m.padron = p.padron
       GROUP BY p.padron, p.nombre, p.doc, p.efectividad_autorizada`,
    );

    const resultados = buildResultados(rows as ResultadoInput[], umbral);

    const estadisticas = {
      total: resultados.length,
      efectivoAutorizado: resultados.filter((r) => r.estado === 'efectivo_autorizado').length,
      efectivo: resultados.filter((r) => r.estado === 'efectivo').length,
      curso: resultados.filter((r) => r.estado === 'curso').length,
      sinMarcas: resultados.filter((r) => r.estado === 'sinmarcas').length,
    };

    // Estadísticas de marcas (requiere otra query ligera)
    const [totalRegs, totalArchivos, personasEnMarcas, diasUnicos, rango] = await Promise.all([
      db.get(`SELECT COUNT(*) AS c FROM jornales_marcas`, []),
      db.get(`SELECT COUNT(*) AS c FROM jornales_archivos`, []),
      db.get(`SELECT COUNT(DISTINCT padron) AS c FROM jornales_marcas`, []),
      db.get(`SELECT COUNT(DISTINCT fecha) AS c FROM jornales_marcas`, []),
      db.get(`SELECT MIN(fecha) AS fmin, MAX(fecha) AS fmax FROM jornales_marcas`, []),
    ]);

    // PG devuelve `DATE` como objeto Date; SQLite como string. Normalizamos a
    // ISO YYYY-MM-DD para el cliente.
    const toIsoDate = (v: unknown): string | null => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).slice(0, 10);
    };

    return NextResponse.json({
      resultados,
      estadisticas,
      estadisticasMarcas: {
        totalRegistros: Number(totalRegs?.c) || 0,
        totalArchivos: Number(totalArchivos?.c) || 0,
        personasEnMarcas: Number(personasEnMarcas?.c) || 0,
        diasUnicos: Number(diasUnicos?.c) || 0,
        fechaMin: toIsoDate(rango?.fmin),
        fechaMax: toIsoDate(rango?.fmax),
      },
      umbral,
    });
  } catch (err: any) {
    console.error('Error calculando resultados jornales:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}
