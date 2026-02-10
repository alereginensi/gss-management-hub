'use client';

import React, { useEffect, useState } from 'react';
import { useTicketContext } from '../context/TicketContext';
import { useRouter, usePathname } from 'next/navigation';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { theme, isAuthenticated, currentUser } = useTicketContext();
    const router = useRouter();
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const publicRoutes = ['/login', '/register'];
        const isPublicRoute = publicRoutes.includes(pathname);

        if (isAuthenticated) {
            if (isPublicRoute) {
                router.push('/tickets');
            } else if (pathname === '/' && currentUser.role !== 'admin') {
                // Regular users can't see dashboard
                router.push('/tickets');
            }
        } else if (!isPublicRoute) {
            router.push('/login');
        }
    }, [isAuthenticated, pathname, isMounted, router, currentUser.role]);

    if (!isMounted) return null;

    return (
        <div data-theme={theme} style={{ minHeight: '100vh' }}>
            {children}
        </div>
    );
}
