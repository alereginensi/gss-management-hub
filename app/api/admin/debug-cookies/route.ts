import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();
    const cookieList = cookieStore.getAll();

    return NextResponse.json({
        cookies: cookieList,
        count: cookieList.length,
        timestamp: new Date().toISOString()
    });
}
