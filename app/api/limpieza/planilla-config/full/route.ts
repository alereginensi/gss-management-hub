import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

// Lectura consolidada del config de planillas.
// - Sin cliente: devuelve lista de clientes activos.
// - Con cliente: devuelve el cliente + sectores activos + puestos activos (agrupados por turno).
export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const cliente = searchParams.get('cliente');

        const clientes = await db.query('SELECT id, name FROM limpieza_clientes WHERE active = 1 ORDER BY name ASC');
        if (!cliente) return NextResponse.json({ clientes });

        const clienteRow = clientes.find((c: any) => c.name.toLowerCase() === cliente.toLowerCase());
        if (!clienteRow) return NextResponse.json({ clientes, cliente: null, sectores: [] });

        const sectores = await db.query(
            'SELECT id, name FROM limpieza_sectores WHERE cliente_id = ? AND active = 1 ORDER BY name ASC',
            [clienteRow.id]
        );
        const sectorIds = sectores.map((s: any) => s.id);
        let puestos: any[] = [];
        if (sectorIds.length > 0) {
            const placeholders = sectorIds.map(() => '?').join(',');
            puestos = await db.query(
                `SELECT id, sector_id, turno, nombre, cantidad, orden FROM limpieza_puestos WHERE sector_id IN (${placeholders}) AND active = 1 ORDER BY turno, orden, id`,
                sectorIds
            );
        }

        // Estructura: sectores con turnos agrupados
        const sectoresOut = sectores.map((s: any) => {
            const puestosSec = puestos.filter(p => p.sector_id === s.id);
            const turnosSet = Array.from(new Set(puestosSec.map(p => p.turno)));
            const turnos = turnosSet.map(t => ({
                turno: t,
                puestos: puestosSec.filter(p => p.turno === t).map(p => ({ nombre: p.nombre, cantidad: p.cantidad }))
            }));
            return { id: s.id, name: s.name, turnos };
        });

        return NextResponse.json({ clientes, cliente: clienteRow, sectores: sectoresOut });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
