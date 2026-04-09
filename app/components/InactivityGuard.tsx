'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE   = 5 * 60 * 1000;   // warn 5 min before logout (at 25 min)

// Pages where we should NOT apply inactivity tracking
const PUBLIC_PAGES = ['/login', '/register'];

export default function InactivityGuard() {
    const router   = useRouter();
    const pathname = usePathname();
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toastRef   = useRef<HTMLDivElement | null>(null);

    const isPublicPage = PUBLIC_PAGES.includes(pathname);

    const clearTimers = useCallback(() => {
        if (timerRef.current)   clearTimeout(timerRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
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

    const showWarningToast = useCallback(() => {
        // Remove existing toast if any
        dismissWarningToast();

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
            font-family: var(--font-inter, sans-serif);
            font-size: 0.9rem;
            max-width: 320px;
            border-left: 4px solid #f59e0b;
            transition: opacity 0.3s ease;
            opacity: 1;
        `;
        toast.innerHTML = `
            <div style="font-weight:600;margin-bottom:0.4rem;">⚠️ Sesión por vencer</div>
            <div style="color:#d1d5db;font-size:0.82rem;">Tu sesión se cerrará en 5 minutos por inactividad. Movete o hacé clic para continuar.</div>
        `;
        document.body.appendChild(toast);
        toastRef.current = toast;
    }, [dismissWarningToast]);

    const logout = useCallback(async () => {
        dismissWarningToast();
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch { /* ignore network errors during logout */ }
        // Clear localStorage
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        router.push('/login');
    }, [router, dismissWarningToast]);

    const resetTimer = useCallback(() => {
        if (isPublicPage) return;
        clearTimers();
        dismissWarningToast();

        // Warning at 25 min
        warningRef.current = setTimeout(showWarningToast, INACTIVITY_TIMEOUT - WARNING_BEFORE);
        // Logout at 30 min
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
