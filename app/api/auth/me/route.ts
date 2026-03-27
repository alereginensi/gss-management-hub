import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
    const session = await getSession(request);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        // Fetch up-to-date user data from DB to reflect permission changes without relogging
        const user = await db.prepare('SELECT id, name, email, role, department, rubro, approved, modules FROM users WHERE id = ?').get(session.user.id);
        
        if (!user) {
            return NextResponse.json({ error: 'User no longer exists' }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        // Fallback to session data if DB fails
        return NextResponse.json({ user: session.user });
    }
}
