import { signJWT, verifyJWT } from './auth-edge';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long';

export async function encrypt(payload: any) {
    return await signJWT(payload, JWT_SECRET, { expires: '2h' });
}

export async function decrypt(input: string): Promise<any> {
    const result = await verifyJWT(input, JWT_SECRET);
    if (!result) throw new Error('Invalid token');
    return result.payload;
}

export async function createSession(user: any) {
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    const sessionToken = await encrypt({ user, expires });

    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
        maxAge: 2 * 60 * 60, // 2 hours in seconds
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        priority: 'high'
    });

    return sessionToken;
}

export async function deleteSession() {
    const cookieStore = await cookies();
    cookieStore.set('session', '', { expires: new Date(0), path: '/' });
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    try {
        return await decrypt(session);
    } catch (e) {
        return null;
    }
}
