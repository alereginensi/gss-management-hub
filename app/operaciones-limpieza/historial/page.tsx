'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    ArrowLeft, Calendar, ChevronRight, Folder, 
    FileText, Search, Clock, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface GroupedReports {
    [month: string]: string[];
}

export default function HistorialInformesPage() {
    const { currentUser, isAuthenticated, loading, getAuthHeaders, logout } = useTicketContext() as any;
    const router = useRouter();
    
    const [dates, setDates] = useState<string[]>([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
        else fetchDates();
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchDates = async () => {
        try {
            const res = await fetch('/api/limpieza/asistencia?action=list_dates', {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setDates(data);
                
                // Expand the current month by default
                if (data.length > 0) {
                    const firstDate = data[0];
                    const monthKey = getMonthKey(firstDate);
                    setExpandedMonths([monthKey]);
                }
            }
        } catch (error) {
            console.error('Error fetching dates:', error);
        } finally {
            setLoadingDates(false);
        }
    };

    const getMonthKey = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    const formatDisplayDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const groupDates = (datesList: string[]): GroupedReports => {
        const filtered = datesList.filter(d => d.includes(searchTerm));
        return filtered.reduce((acc: GroupedReports, date) => {
            const month = getMonthKey(date);
            if (!acc[month]) acc[month] = [];
            acc[month].push(date);
            return acc;
        }, {});
    };

    const toggleMonth = (month: string) => {
        setExpandedMonths(prev => 
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    if (loading || !currentUser) return null;

    const grouped = groupDates(dates);
    const months = Object.keys(grouped);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ 
                backgroundColor: '#1d3461', color: '#fff', padding: '0.75rem 1rem', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Link href="/operaciones-limpieza" style={{ color: '#fff', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Historial</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }} className="mobile-hide">
                        {dates.length} Informes
                    </div>
                    <button 
                        onClick={() => { logout(); router.push('/login'); }} 
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '0.4rem' }}
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '1rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                {/* Search Bar */}
                <div style={{ 
                    backgroundColor: '#fff', borderRadius: '12px', padding: '0.75rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem',
                    border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <Search size={18} color="#64748b" />
                    <input 
                        type="text" 
                        placeholder="Buscar por fecha (AAAA-MM-DD)..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#1e293b' }}
                    />
                </div>

                {loadingDates ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        <Clock size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                        Cargando historial...
                    </div>
                ) : months.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                        <FileText size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.1rem', color: '#334155', margin: '0 0 0.5rem' }}>No se encontraron informes</h2>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                            {searchTerm ? 'Prueba con otro término de búsqueda' : 'Aún no se han generado informes operativos.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {months.map(month => (
                            <div key={month} style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <button 
                                    onClick={() => toggleMonth(month)}
                                    style={{ 
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem 1.25rem', backgroundColor: '#f8fafc', border: 'none', cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Folder size={20} color="#3b82f6" fill="#3b82f633" />
                                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{month}</span>
                                        <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.1rem 0.5rem', borderRadius: '10px' }}>
                                            {grouped[month].length}
                                        </span>
                                    </div>
                                    {expandedMonths.includes(month) ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                                </button>

                                {expandedMonths.includes(month) && (
                                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                                        {grouped[month].map((date, idx) => (
                                            <Link 
                                                key={date} 
                                                href={`/operaciones-limpieza/informes?fecha=${date}&from=history`}
                                                style={{ 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '0.85rem 1.25rem', textDecoration: 'none', color: '#334155',
                                                    borderBottom: idx === grouped[month].length - 1 ? 'none' : '1px solid #f1f5f9',
                                                    transition: 'background-color 0.15s'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Calendar size={16} color="#64748b" />
                                                    <span style={{ fontSize: '0.9rem' }}>{formatDisplayDate(date)}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    Ver Informe
                                                    <ChevronRight size={14} />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}
