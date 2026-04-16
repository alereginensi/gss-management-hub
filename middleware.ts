import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth-edge';

/**
 * Middleware is now minimal - it only handles page-level redirects
 * for unauthenticated users trying to access protected PAGE routes.
 *
 * API route auth is handled INSIDE each route handler via getSession(request).
 * This avoids issues with Railway's proxy potentially interfering with
 * cookie or Authorization header forwarding at the Edge runtime level.
 *
 * Además aplica enforcement server-side de `panel_access`: si el usuario no
 * es admin y tiene panel_access=0, bloqueamos acceso a rutas del "panel
 * general" y lo mandamos a su módulo asignado.
 */

// Rutas propias del "Panel General". Si el usuario no tiene panel_access lo
// sacamos de estas rutas y lo devolvemos al landing (/) donde verá sus módulos.
// NOTA: `/` NO está en esta lista — el landing debe ser visible para todos
// los usuarios autenticados; la card Panel General se deshabilita ahí.
const PANEL_GENERAL_PREFIXES = [
    '/administracion',
    '/tickets',
    '/new-ticket',
    '/logbook',
    '/notifications',
    '/settings',
    '/admin',
    '/mitrabajo',
];

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) return 'dev-fallback-secret-at-least-32-chars!!';
    return secret;
}

function isPanelGeneralPath(pathname: string): boolean {
    return PANEL_GENERAL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only handle page routes (not API routes, not static assets)
    // API routes handle their own authentication
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next') || pathname.includes('.')) {
        return NextResponse.next();
    }

    // For page routes: check if there's any auth token available
    const publicPages = ['/login', '/register', '/', '/registro-limpieza', '/turno'];
    // Agenda Web: flujo público de empleados (sin sesión GSS requerida)
    const agendaPublicRoutes = ['/logistica/agenda', '/logistica/agenda/pedido', '/logistica/agenda/turno', '/logistica/agenda/confirmacion'];
    const isPublicPage = publicPages.includes(pathname) || agendaPublicRoutes.includes(pathname);

    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
        if (isPublicPage) return NextResponse.next();
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Intentar decodificar la sesión para enforcement de panel_access
    try {
        const result = await verifyJWT(sessionCookie, getJwtSecret());
        const user = result?.payload?.user;

        // Si el usuario NO es admin y tiene panel_access=0, bloquear rutas del panel general
        // y mandarlo de vuelta al landing donde verá sus módulos.
        if (user && user.role !== 'admin' && Number(user.panel_access) === 0) {
            if (isPanelGeneralPath(pathname)) {
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
    } catch {
        // Si no podemos decodificar, dejamos pasar (cada route handler hace su propio getSession()).
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
