import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica', 'jefe'].includes(session.user.role)) return null;
    return session;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const resolvedParams = await params;
        const id = Number(resolvedParams.id);
        const { status } = await request.json();
        
        if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

        await db.run('UPDATE material_requests SET status = ? WHERE id = ?', [status, id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating material request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const resolvedParams = await params;
        const id = Number(resolvedParams.id);
        
        await db.run('DELETE FROM material_requests WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting material request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
