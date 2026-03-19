import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware is now minimal - it only handles page-level redirects
 * for unauthenticated users trying to access protected PAGE routes.
 * 
 * API route auth is handled INSIDE each route handler via getSession(request).
 * This avoids issues with Railway's proxy potentially interfering with
 * cookie or Authorization header forwarding at the Edge runtime level.
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only handle page routes (not API routes, not static assets)
    // API routes handle their own authentication
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname.includes('.')) {
        return NextResponse.next();
    }

    // For page routes: check if there's any auth token available
    const publicPages = ['/login', '/register', '/'];
    const isPublicPage = publicPages.includes(pathname);

    if (isPublicPage) {
        return NextResponse.next();
    }

    // For protected pages, check if any auth token exists
    // (The actual validation happens server-side in route handlers)
    const sessionCookie = request.cookies.get('session')?.value;
    const authTokenCookie = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('Authorization');

    const hasAnyToken = !!(sessionCookie || authTokenCookie || authHeader);

    if (!hasAnyToken) {
        // No token at all - redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
