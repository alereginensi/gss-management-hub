'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar as CalendarIcon, Plus, X, PackageSearch, Download, Search, Trash2, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import { mergeLogisticaClientNames } from '@/lib/logistica-clients';
import { ARTICULOS_MATERIALES as ARTICULOS } from '@/lib/logistica-articulos';
import { ArticuloSearchAdd } from '@/app/components/logistica/ArticuloSearchAdd';

interface MaterialItem {
    article: string;
    quantity: number | string;
}

interface MaterialRequest {
    id: number;
    client: string;
    items: MaterialItem[];
    // legacy support fields if needed:
    article?: string;
    quantity?: number;
    needed_date: string;
    status: 'pending' | 'ordered' | 'fulfilled';
    requested_by: string;
    created_at: string;
    file_url?: string | null;
}

interface PurchaseOrder {
    id: number;
    order_number: string;
    issue_date: string;
    status: string;
    buyer_name: string;
    total_amount?: number | null;
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    ordered: '#3b82f6',
    fulfilled: '#22c55e',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    ordered: 'Ordenada',
    fulfilled: 'Entregada',
};

const PO_STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#3b82f6',
    paid: '#22c55e',
    cancelled: '#e04951',
    partial_received: '#8b5cf6',
    received: '#059669',
};

const PO_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    paid: 'Pagada',
    cancelled: 'Anulada',
    partial_received: 'R. Parcial',
    received: 'Recibida',
};

export default function SolicitudMaterialesPage() {
    const { currentUser, isAuthenticated, loading } = useTicketContext();
    const router = useRouter();

    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [fetching, setFetching] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [locations, setLocations] = useState<string[]>([]);

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Form
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        client: '',
        items: [] as MaterialItem[],
    });
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Mobile Check
    const [isMobile, setIsMobile] = useState(false);
    const [mobileView, setMobileView] = useState<'calendar' | 'list'>('calendar');
    const [showFilters, setShowFilters] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    const fetchAllData = async (df = dateFrom, dt = dateTo) => {
        setFetching(true);
        try {
            // Fetch requests
            const p = new URLSearchParams();
            if (df) p.set('dateFrom', df);
            if (dt) p.set('dateTo', dt);

            const resReq = await fetch(`/api/logistica/solicitudes${p.toString() ? '?'+p.toString() : ''}`, { headers: getAuthHeaders() });
            const dataReq = await resReq.json();
            setRequests(Array.isArray(dataReq) ? dataReq : []);

            // Fetch orders for calendar (orders might not respond to these specific dates but we fetch them globally to match the calendar logic)
            // If the user wants to filter orders as well, we would do it here, but usually calendar needs global fetch or month boundary fetch.
            const resOrd = await fetch('/api/logistica/ordenes', { headers: getAuthHeaders() });
            const dataOrd = await resOrd.json();
            setOrders(Array.isArray(dataOrd) ? dataOrd : []);
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && !['admin', 'logistica', 'jefe'].includes(currentUser.role)) { router.push('/'); return; }
        
        // Fetch locations for the form once
        fetch('/api/config/locations', { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(locs => {
                if (Array.isArray(locs)) setLocations(mergeLogisticaClientNames(locs.map((l: any) => l.name)));
            })
            .catch(console.error);
            
        fetchAllData(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, isAuthenticated, currentUser]);

    // UI Trigger for manual search
    const handleSearch = () => fetchAllData(dateFrom, dateTo);

    const handleCreate = async () => {
        const validItems = form.items.filter(i => i.article.trim() && i.quantity);
        if (validItems.length === 0) return alert('Agregá al menos un artículo a la solicitud');

        setSaving(true);
        try {
            let fileUrl: string | null = null;
            if (attachmentFile) {
                const fd = new FormData();
                fd.append('file', attachmentFile);
                const upRes = await fetch('/api/logistica/solicitudes/upload', { method: 'POST', headers: getAuthHeaders(), body: fd });
                if (upRes.ok) {
                    const upData = await upRes.json();
                    fileUrl = upData.fileUrl;
                }
            }

            const needed_date = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/logistica/solicitudes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ client: form.client, needed_date, items: validItems, file_url: fileUrl })
            });
            if (res.ok) {
                setShowForm(false);
                setForm({ client: '', items: [] });
                setAttachmentFile(null);
                fetchAllData();
            } else {
                const err = await res.json();
                alert('Error: ' + err.error);
            }
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (id: number, status: string) => {
        const res = await fetch(`/api/logistica/solicitudes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            fetchAllData();
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar esta solicitud?')) return;
        await fetch(`/api/logistica/solicitudes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAllData();
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const p = new URLSearchParams();
            if (dateFrom) p.set('dateFrom', dateFrom);
            if (dateTo) p.set('dateTo', dateTo);
            const url = `/api/logistica/solicitudes/export${p.toString() ? '?' + p.toString() : ''}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `solicitudes-materiales-${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(a.href);
        } finally { setExporting(false); }
    };

    // Calendar logic
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const emptyCells = firstDay === 0 ? 6 : firstDay - 1; 
        const days = [];
        for (let i = 0; i < emptyCells; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    }, [currentDate]);

    const eventsMap = useMemo(() => {
        const map: Record<string, { requests: MaterialRequest[], orders: PurchaseOrder[] }> = {};
        requests.forEach(req => {
            if (!req.needed_date) return;
            if (!map[req.needed_date]) map[req.needed_date] = { requests: [], orders: [] };
            map[req.needed_date].requests.push(req);
        });
        orders.forEach(ord => {
            if (!ord.issue_date) return;
            if (!map[ord.issue_date]) map[ord.issue_date] = { requests: [], orders: [] };
            map[ord.issue_date].orders.push(ord);
        });
        return map;
    }, [requests, orders]);

    if (loading || !currentUser) return null;
    const selectedDayEvents = selectedDate ? eventsMap[selectedDate] : null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/logistica" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                        <ArrowLeft size={15} /> Logística
                    </Link>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main className="standalone-page" style={{ flex: 1, padding: isMobile ? '0.5rem 1rem' : '1.5rem', maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Solicitud de Materiales</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>Planificación y suministro</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {(!isMobile || mobileView === 'list') && (
                            <button onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, opacity: exporting ? 0.7 : 1 }}>
                                <Download size={16} /> Exportar Excel
                            </button>
                        )}
                        {['admin', 'jefe'].includes(currentUser.role) && (
                            <button
                                onClick={() => {
                                    setForm({ client: '', items: [] });
                                    setAttachmentFile(null);
                                    setShowForm(true);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                            >
                                <Plus size={16} /> Nueva Solicitud
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtros */}
                {(!isMobile || mobileView === 'list') && (
                    <div className="card" style={{ padding: isMobile ? '0.75rem' : '1rem' }}>
                        {isMobile && (
                            <button
                                onClick={() => setShowFilters(v => !v)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Search size={15} />
                                    Filtrar por fecha
                                    {(dateFrom || dateTo) && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: 'var(--primary-color)', color: 'white' }}>activo</span>}
                                </span>
                                {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        )}
                        {(!isMobile || showFilters) && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: isMobile ? '0.75rem' : 0 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '130px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Desde fecha</label>
                                    <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', width: '100%' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '130px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hasta fecha</label>
                                    <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', width: '100%' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                    <button onClick={handleSearch} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                        <Search size={15} /> Buscar
                                    </button>
                                    {(dateFrom || dateTo) && (
                                        <button onClick={() => { setDateFrom(''); setDateTo(''); fetchAllData('', ''); }} style={{ padding: '0.5rem', background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '1.5rem' }}>
                    {/* Lista */}
                    {(!isMobile || mobileView === 'list') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {isMobile && (
                            <button onClick={() => setMobileView('calendar')} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', padding: '0.5rem 0' }}>
                                <ArrowLeft size={16} /> Volver al Calendario
                            </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <PackageSearch size={18} color="var(--primary-color)" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Solicitudes Activas</h2>
                        </div>
                        
                        {fetching ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Cargando solicitudes...</p>
                        ) : requests.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                No se encontraron solicitudes.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {requests.map(req => (
                                    <div key={req.id} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${STATUS_COLORS[req.status]}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.client}</span>
                                                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: `${STATUS_COLORS[req.status]}20`, color: STATUS_COLORS[req.status], fontWeight: 600 }}>
                                                        {STATUS_LABELS[req.status]}
                                                    </span>
                                                </div>
                                                
                                                <ul style={{ margin: '0 0 0.75rem', padding: '0 0 0 1rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                    {req.items?.map((item, idx) => (
                                                        <li key={idx} style={{ marginBottom: '0.2rem' }}>
                                                            <strong>{item.quantity}x</strong> {item.article}
                                                        </li>
                                                    ))}
                                                </ul>

                                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={13}/> {req.created_at ? new Date(req.created_at).toLocaleDateString('es-UY') : req.needed_date}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ArrowLeft size={13} style={{ transform: 'rotate(45deg)' }}/> Por: {req.requested_by}</span>
                                                    {req.file_url && (
                                                        <a href={`/api/file-proxy?url=${encodeURIComponent(req.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                                                            <Paperclip size={13}/> Adjunto
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                                {['admin', 'logistica'].includes(currentUser.role) && (
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        {req.status === 'pending' && <button onClick={() => updateStatus(req.id, 'ordered')} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '4px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}>Marcar Ordenado</button>}
                                                        {req.status === 'ordered' && <button onClick={() => updateStatus(req.id, 'fulfilled')} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '4px', backgroundColor: '#22c55e', color: 'white', border: 'none', cursor: 'pointer' }}>Entregado</button>}
                                                    </div>
                                                )}
                                                {req.status === 'pending' && currentUser.name === req.requested_by && (
                                                    <button onClick={() => handleDelete(req.id)} style={{ padding: '0.3rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Calendario */}
                    {(!isMobile || mobileView === 'calendar') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: isMobile ? '100%' : '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <CalendarIcon size={18} color="var(--primary-color)" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Calendario</h2>
                        </div>

                        <div className="card" style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>&lt;</button>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                    {currentDate.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>&gt;</button>
                            </div>

                            <div style={{ display: 'flex', width: '100%', marginBottom: '0.5rem' }}>
                                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                                    <div key={d} style={{ width: '14.28%', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{d}</div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%' }}>
                                {calendarGrid.map((day, idx) => {
                                    if (!day) return <div key={`empty-${idx}`} style={{ width: '14.28%', padding: '0.5rem' }} />;
                                    
                                    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                    const events = eventsMap[dateStr];
                                    const hasRequests = events?.requests?.length > 0;
                                    const hasOrders = events?.orders?.length > 0;
                                    const isSelected = selectedDate === dateStr;

                                    return (
                                        <div key={`day-${idx}`} style={{ width: '14.28%', padding: '2px', boxSizing: 'border-box' }}>
                                            <div 
                                                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                                style={{ 
                                                    width: '100%', aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                                    backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-color)', 
                                                    color: isSelected ? 'white' : 'var(--text-primary)',
                                                    borderRadius: '4px', cursor: (hasRequests || hasOrders) ? 'pointer' : 'default',
                                                    border: (hasRequests || hasOrders) ? '1px solid var(--border-color)' : '1px solid transparent',
                                                    transition: 'all 0.2s', position: 'relative'
                                                }}
                                            >
                                                <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500 }}>{day}</span>
                                                <div style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '4px' }}>
                                                    {hasRequests && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? 'white' : '#f59e0b' }} />}
                                                    {hasOrders && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? 'white' : '#3b82f6' }} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Solicitudes</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Órdenes</div>
                            </div>
                        </div>

                        {selectedDate && selectedDayEvents && (
                            <div className="card" style={{ padding: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                    Eventos para {selectedDate.split('-').reverse().join('/')}
                                </h3>

                                {selectedDayEvents.requests.length > 0 && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Solicitudes</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {selectedDayEvents.requests.map(r => (
                                                <div key={`req-${r.id}`} style={{ fontSize: '0.82rem', borderLeft: `3px solid ${STATUS_COLORS[r.status] || '#f59e0b'}`, paddingLeft: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                                        {r.client && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.client}</span>}
                                                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', backgroundColor: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status], fontWeight: 600 }}>
                                                            {STATUS_LABELS[r.status]}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>por {r.requested_by}</span>
                                                    </div>
                                                    <ul style={{ margin: 0, padding: '0 0 0 0.75rem', color: 'var(--text-secondary)' }}>
                                                        {r.items?.map((item, idx) => (
                                                            <li key={idx}><strong>{item.quantity}x</strong> {item.article}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedDayEvents.orders.length > 0 && (
                                    <div>
                                        <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Órdenes de Compra</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedDayEvents.orders.map(o => (
                                                <div key={`ord-${o.id}`} style={{ fontSize: '0.82rem', borderLeft: `3px solid ${PO_STATUS_COLORS[o.status] || '#3b82f6'}`, paddingLeft: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                        <Link href="/logistica/ordenes-compra" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>OC #{o.order_number || o.id}</Link>
                                                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', backgroundColor: `${PO_STATUS_COLORS[o.status] || '#3b82f6'}20`, color: PO_STATUS_COLORS[o.status] || '#3b82f6', fontWeight: 600 }}>
                                                            {PO_STATUS_LABELS[o.status] || o.status}
                                                        </span>
                                                    </div>
                                                    {o.buyer_name && <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{o.buyer_name}</div>}
                                                    {o.total_amount != null && <div style={{ color: 'var(--text-secondary)' }}>${Number(o.total_amount).toLocaleString('es-UY')}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isMobile && (
                            <button onClick={() => setMobileView('list')} style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                <PackageSearch size={16} color="var(--primary-color)" /> Ver solicitudes y filtros
                            </button>
                        )}
                    </div>
                    )}
                </div>
            </main>

            {/* Modal Nueva Solicitud (Multiple Items) */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', zIndex: 100, padding: isMobile ? '0.5rem' : '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: isMobile ? '1rem' : '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '1rem' : '1.25rem' }}>
                            <h2 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Nueva Solicitud</h2>
                            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Cliente / Ubicación (opcional)</label>
                                <select
                                    value={form.client}
                                    onChange={e => setForm({...form, client: e.target.value})}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: isMobile ? '0.3rem 0.5rem' : '0.5rem',
                                        fontSize: isMobile ? '0.8125rem' : '0.85rem',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius)',
                                        backgroundColor: 'var(--bg-color)',
                                        color: 'var(--text-primary)',
                                        minHeight: isMobile ? '2rem' : undefined,
                                    }}
                                >
                                    <option value="">Sin cliente</option>
                                    {locations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', display: 'block' }}>Artículos Solicitados</label>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: isMobile ? '0.45rem' : '0.5rem',
                                            alignItems: isMobile ? 'stretch' : 'flex-start',
                                        }}
                                    >
                                        <ArticuloSearchAdd
                                            compact={isMobile}
                                            options={ARTICULOS.filter((a) => !form.items.some((i) => i.article === a))}
                                            onSelect={(article) => {
                                                if (form.items.some((i) => i.article === article)) return;
                                                setForm({ ...form, items: [...form.items, { article, quantity: '' }] });
                                            }}
                                            placeholder="Buscar artículo…"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, items: [...form.items, { article: '', quantity: '' }] })}
                                            style={{
                                                background: 'none',
                                                border: isMobile ? '1px solid var(--border-color)' : 'none',
                                                borderRadius: 'var(--radius)',
                                                color: 'var(--primary-color)',
                                                fontSize: isMobile ? '0.75rem' : '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: isMobile ? 'center' : 'flex-start',
                                                gap: '0.2rem',
                                                flexShrink: 0,
                                                padding: isMobile ? '0.32rem 0.5rem' : '0.45rem 0',
                                            }}
                                        >
                                            <Plus size={isMobile ? 12 : 14} /> Agregar fila
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {form.items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input 
                                                value={item.article} 
                                                onChange={e => {
                                                    const copy = [...form.items];
                                                    copy[idx].article = e.target.value;
                                                    setForm({...form, items: copy});
                                                }} 
                                                placeholder="Ej: Uniformes talle L"
                                                style={{ flex: 1, padding: isMobile ? '0.35rem 0.5rem' : '0.5rem', fontSize: isMobile ? '0.8125rem' : '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} 
                                            />
                                            <input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={e => {
                                                    const copy = [...form.items];
                                                    copy[idx].quantity = e.target.value;
                                                    setForm({...form, items: copy});
                                                }} 
                                                placeholder="Cant."
                                                style={{ width: '80px', padding: isMobile ? '0.35rem 0.45rem' : '0.5rem', fontSize: isMobile ? '0.8125rem' : '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setForm({...form, items: form.items.filter((_, i) => i !== idx)})}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem', flexShrink: 0 }}
                                                aria-label="Quitar artículo"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {form.items.length === 0 && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.85rem 0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', margin: 0 }}>
                                            Agregá artículos a tu solicitud.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>Archivo adjunto (opcional)</label>
                            <input
                                type="file"
                                accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                                onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
                                style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}
                            />
                            {attachmentFile && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>{attachmentFile.name}</span>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
                            <button onClick={handleCreate} disabled={saving} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                                {saving ? 'Guardando...' : 'Solicitar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
