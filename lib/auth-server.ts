import { signJWT, verifyJWT } from './auth-edge';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('❌ JWT_SECRET is not set. Configure it in Railway environment variables.');
        }
        return 'dev-fallback-secret-at-least-32-chars!!';
    }
    return secret;
}

export async function encrypt(payload: any) {
    return await signJWT(payload, getSecret(), { expires: '8h' });
}

export async function decrypt(input: string): Promise<any> {
    const result = await verifyJWT(input, getSecret());
    if (!result) throw new Error('Invalid token');
    return result.payload;
}

export async function createSession(user: any) {
    const expires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    const sessionToken = await encrypt({ user, expires });

    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
        maxAge: 8 * 60 * 60, // 8 hours in seconds
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

/**
 * getSession - reads auth from cookie OR Authorization header.
 *
 * Pass the NextRequest object when calling from a route handler so the
 * Authorization header can be read reliably (avoids dynamic import issues).
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     const session = await getSession(request);
 *     ...
 *   }
 */
export async function getSession(request?: NextRequest | Request): Promise<any> {
    // 1. Try cookie first (works in both middleware and route handlers)
    try {
        const cookieStore = await cookies();
        const cookieToken = cookieStore.get('session')?.value;
        if (cookieToken) {
            return await decrypt(cookieToken);
        }
    } catch {
        // cookies() only works in certain server contexts; fall through to header check
    }

    // 2. Try Authorization header from the passed-in request object
    if (request) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                return await decrypt(token);
            } catch {
                return null;
            }
        }
    }

    return null;
}
