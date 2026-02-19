import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth-edge';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Define public paths that DON'T require authentication
    const publicPaths = [
        '/login',
        '/register',
        '/',
        '/api/auth/login',
        '/api/auth/register',
        '/api/validate-email',
        '/api/config/roles',
        '/api/diagnose', // Diagnostic tool
        '/api/admin/debug', // NEW: Allow debug without auth
        '/api/admin/debug-auth', // NEW: Auth debug
        '/api/admin/debug-edge', // NEW: Edge debug
        '/api/admin/debug-cookies', // NEW: Cookie debug
        '/api/admin/debug-decrypt', // NEW: Decrypt debug
        '/api/admin/seed',  // NEW: Allow manual seed without auth (or maybe require secret? keeping public for now as requested)
    ];

    const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith('/api/auth'));
    const isAsset = pathname.startsWith('/_next') || pathname.includes('.');

    if (isPublicPath || isAsset) {
        return NextResponse.next();
    }

    // 2. Check for session cookie
    const session = request.cookies.get('session')?.value;

    if (!session) {
        if (pathname.startsWith('/api/')) {
            const response = NextResponse.json({ error: 'Unauthorized: No session found' }, { status: 401 });
            response.headers.set('X-Auth-Reason', 'missing_cookie');
            return response;
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3. Verify JWT
    try {
        const result = await verifyJWT(session, JWT_SECRET);
        if (!result) throw new Error('Invalid token');

        const { payload } = result;
        const user = (payload as any).user;

        // 4. Role-based Route Protection

        // Admin & Supervisor areas
        if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
            // Exception for debug/seed if they fell through here (though publicPaths should catch them if exact match)
            // But publicPaths logic above uses 'some', so exact match or startsWith /api/auth.
            // /api/admin/debug needs to be in publicPaths to avoid this check if we want it completely public.
            // It IS in publicPaths now.

            if (user.role !== 'admin' && user.role !== 'supervisor') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden: Admin/Supervisor access required' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        // Logbook is for staff only (Admin, Supervisor, Funcionario - with different levels of access, but here we block Solicitante)
        if (pathname.startsWith('/logbook') || pathname.startsWith('/api/logbook')) {
            if (user.role === 'user') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden: Staff access required' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        // Worker tasks page
        if (pathname.startsWith('/tasks')) {
            if (user.role === 'user') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        return NextResponse.next();
    } catch (e: any) {
        // Clear invalid session cookie
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('session');

        if (pathname.startsWith('/api/')) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            const response = NextResponse.json({ error: `Unauthorized: Invalid session (${errorMessage})` }, { status: 401 });
            response.headers.set('X-Auth-Reason', 'invalid_token');
            return response;
        }
        return response;
    }
}

// Match all request paths except for the ones starting with:
// - api/auth (handled inside)
// - _next/static (static files)
// - _next/image (image optimization files)
// - favicon.ico (favicon file)
export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
