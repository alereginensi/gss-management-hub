import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function requireAdmin(request: NextRequest) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') return null;
    return session;
}

export async function GET(request: NextRequest) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { searchParams } = new URL(request.url);
        const sectorId = searchParams.get('sector_id');
        if (!sectorId) return NextResponse.json({ error: 'sector_id requerido' }, { status: 400 });
        const rows = await db.query(
            'SELECT id, sector_id, turno, nombre, cantidad, orden, active, lugar_sistema FROM limpieza_puestos WHERE sector_id = ? ORDER BY turno ASC, orden ASC, id ASC',
            [sectorId]
        );
        return NextResponse.json(rows);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { sector_id, turno, nombre, cantidad, orden, lugar_sistema } = await request.json();
        if (!sector_id || !turno || !nombre) return NextResponse.json({ error: 'sector_id, turno, nombre requeridos' }, { status: 400 });
        const cant = Number(cantidad) > 0 ? Number(cantidad) : 1;
        const ord = Number.isFinite(Number(orden)) ? Number(orden) : 0;
        const ls = typeof lugar_sistema === 'string' ? lugar_sistema.trim() || null : null;
        const res = await db.run(
            'INSERT INTO limpieza_puestos (sector_id, turno, nombre, cantidad, orden, lugar_sistema) VALUES (?, ?, ?, ?, ?, ?)',
            [sector_id, String(turno).trim(), String(nombre).trim(), cant, ord, ls]
        );
        return NextResponse.json({ id: res.lastInsertRowid, sector_id, turno, nombre, cantidad: cant, orden: ord, active: 1, lugar_sistema: ls });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
