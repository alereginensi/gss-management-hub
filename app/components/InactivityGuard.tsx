'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_TIMEOUT   = 30 * 60 * 1000; // 30 minutes
const WARNING_FIRST_BEFORE = 5 * 60 * 1000;   // primer aviso a 5 min del logout (25 min)
const WARNING_FINAL_BEFORE = 60 * 1000;       // aviso final a 1 min del logout (29 min)

// Pages where we should NOT apply inactivity tracking
const PUBLIC_PAGES = ['/login', '/register'];

export default function InactivityGuard() {
    const router   = useRouter();
    const pathname = usePathname();
    const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningFirstRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningFinalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toastRef        = useRef<HTMLDivElement | null>(null);

    const isPublicPage = PUBLIC_PAGES.includes(pathname);

    const clearTimers = useCallback(() => {
        if (timerRef.current)        clearTimeout(timerRef.current);
        if (warningFirstRef.current) clearTimeout(warningFirstRef.current);
        if (warningFinalRef.current) clearTimeout(warningFinalRef.current);
    }, []);

    const dismissWarningToast = useCallback(() => {
        if (toastRef.current) {
            toastRef.current.style.opacity = '0';
            setTimeout(() => {
                toastRef.current?.remove();
                toastRef.current = null;
            }, 300);
        }
    }, []);

    const showWarningToast = useCallback((variant: 'first' | 'final') => {
        // Remove existing toast if any
        dismissWarningToast();

        const isFinal = variant === 'final';
        const accent = isFinal ? '#dc2626' : '#f59e0b';
        const title  = isFinal ? '⚠️ Tu sesión está por cerrarse' : '⚠️ Sesión por vencer';
        const body   = isFinal
            ? 'Se cerrará en menos de 1 minuto. Movete o hacé clic para mantenerla activa.'
            : 'Tu sesión se cerrará en 5 minutos por inactividad. Movete o hacé clic para continuar.';

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            background: #1f2937;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            font-family: Helvetica, 'Helvetica Neue', Arial, sans-serif;
            font-size: 0.9rem;
            max-width: 320px;
            border-left: 4px solid ${accent};
            transition: opacity 0.3s ease;
            opacity: 1;
        `;
        toast.innerHTML = `
            <div style="font-weight:600;margin-bottom:0.4rem;">${title}</div>
            <div style="color:#d1d5db;font-size:0.82rem;">${body}</div>
        `;
        document.body.appendChild(toast);
        toastRef.current = toast;
    }, [dismissWarningToast]);

    const logout = useCallback(async () => {
        dismissWarningToast();
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch { /* ignore network errors during logout */ }
        // Clear localStorage so TicketContext doesn't re-authenticate on next load
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('user');
        } catch { /* ignore */ }
        // Usar window.location.href para garantizar redirect aunque router.push
        // haya quedado en un estado raro (pestañas inactivas, fetch congelado, etc.)
        try {
            router.push('/login');
        } catch { /* ignore */ }
        window.location.href = '/login';
    }, [router, dismissWarningToast]);

    const resetTimer = useCallback(() => {
        if (isPublicPage) return;
        clearTimers();
        dismissWarningToast();

        // Primer aviso a los 25 min
        warningFirstRef.current = setTimeout(() => showWarningToast('first'), INACTIVITY_TIMEOUT - WARNING_FIRST_BEFORE);
        // Aviso final a los 29 min
        warningFinalRef.current = setTimeout(() => showWarningToast('final'), INACTIVITY_TIMEOUT - WARNING_FINAL_BEFORE);
        // Logout a los 30 min
        timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
    }, [isPublicPage, clearTimers, dismissWarningToast, showWarningToast, logout]);

    useEffect(() => {
        if (isPublicPage) return;

        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
        resetTimer(); // start the timer on mount

        return () => {
            events.forEach(e => window.removeEventListener(e, resetTimer));
            clearTimers();
            dismissWarningToast();
        };
    }, [isPublicPage, resetTimer, clearTimers, dismissWarningToast]);

    // Also reset on route change (navigation = activity)
    useEffect(() => {
        if (!isPublicPage) resetTimer();
    }, [pathname, isPublicPage, resetTimer]);

    return null; // renders nothing
}
