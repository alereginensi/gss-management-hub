import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const cookieList = cookieStore.getAll();

    return NextResponse.json({
        cookies: cookieList,
        count: cookieList.length,
        timestamp: new Date().toISOString()
    });
}
