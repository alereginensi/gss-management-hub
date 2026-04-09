'use client';

import { useEffect, useState, useMemo, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Plus, X, Trash2, CalendarDays,
    Truck, PackageCheck, ClipboardList, FileText, Loader2,
    Download, Search, PenLine
} from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import { mergeLogisticaClientNames } from '@/lib/logistica-clients';
import { ARTICULOS_MATERIALES } from '@/lib/logistica-articulos';
import { ArticuloSearchAdd } from '@/app/components/logistica/ArticuloSearchAdd';

// ── Types ──────────────────────────────────────────────────────────────────
type EventType = 'entrega' | 'despacho' | 'solicitud';

interface CalEvent {
    id: number;
    fecha: string;
    tipo: EventType;
    titulo: string | null;
    descripcion: string | null;
    items: { article: string; quantity: number | string }[];
    file_url: string | null;
    firma_url: string | null;
    created_by: string;
}

interface MaterialRequest {
    id: number;
    client: string;
    items: { article: string; quantity: number | string }[];
    needed_date: string;
    status: 'pending' | 'ordered' | 'fulfilled';
    requested_by: string;
    created_at: string;
    file_url?: string | null;
}

// ── Config ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<EventType, { label: string; color: string; icon: React.ReactNode }> = {
    entrega: { label: 'Entrega', color: '#22c55e', icon: <PackageCheck size={14} /> },
    despacho: { label: 'Ingreso mercadería', color: '#e04951', icon: <Truck size={14} /> },
    solicitud: { label: 'Solicitud', color: '#f59e0b', icon: <ClipboardList size={14} /> },
};

const SOL_STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b', ordered: '#3b82f6', fulfilled: '#22c55e',
};
const SOL_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente', ordered: 'Ordenada', fulfilled: 'Entregada',
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function todayIso() {
    return new Date().toISOString().split('T')[0];
}

// ── Signature canvas utilities ───────────────────────────────────────────────
type SigEvent = React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>;

function getSigPos(e: SigEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
        const t = e.touches[0];
        return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function sigStart(e: SigEvent, canvas: HTMLCanvasElement | null, setDrawing: (v: boolean) => void) {
    e.preventDefault();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setDrawing(true);
    const { x, y } = getSigPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function sigMove(e: SigEvent, canvas: HTMLCanvasElement | null, drawing: boolean, setHasStrokes: (v: boolean) => void) {
    e.preventDefault();
    if (!canvas || !drawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigPos(e, canvas);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStrokes(true);
}

function sigEnd(e: SigEvent, setDrawing: (v: boolean) => void) {
    e.preventDefault();
    setDrawing(false);
}

function sigClear(canvas: HTMLCanvasElement | null, setHasStrokes: (v: boolean) => void) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
}

async function uploadSig(canvas: HTMLCanvasElement, authHeaders: HeadersInit): Promise<string> {
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const fd = new FormData();
    fd.append('file', blob, `firma-${Date.now()}.png`);
    const res = await fetch('/api/logistica/calendario/upload-firma', { method: 'POST', headers: authHeaders, body: fd });
    if (!res.ok) throw new Error('Error al subir firma');
    const { fileUrl } = await res.json();
    return fileUrl;
}

export default function CalendarioPage() {
    const { currentUser, isAuthenticated, loading } = useTicketContext();
    const router = useRouter();

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ── Data ──────────────────────────────────────────────────────────────
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [fetching, setFetching] = useState(true);
    const [locations, setLocations] = useState<string[]>([]);

    // ── Calendar navigation ───────────────────────────────────────────────
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // ── Modal state ───────────────────────────────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [modalDate, setModalDate] = useState<string>('');
    const [modalTab, setModalTab] = useState<'entrega' | 'despacho' | 'solicitud'>('entrega');

    // Entrega / Despacho form
    const [calForm, setCalForm] = useState({
        titulo: '',
        descripcion: '',
        items: [{ article: '', quantity: '' as string | number }],
    });
    const [calFile, setCalFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [calFileUrl, setCalFileUrl] = useState('');
    const calFileRef = useRef<HTMLInputElement>(null);

    // Solicitud form
    const [solForm, setSolForm] = useState({
        client: '',
        items: [] as { article: string; quantity: string | number }[],
    });
    const [solFile, setSolFile] = useState<File | null>(null);
    const [solFileUrl, setSolFileUrl] = useState('');
    const solFileRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);

    // ── Firma modal state ─────────────────────────────────────────────────
    const [firmaEvent, setFirmaEvent] = useState<CalEvent | null>(null);
    const firmaCanvasRef = useRef<HTMLCanvasElement>(null);
    const [firmaDrawing, setFirmaDrawing] = useState(false);
    const [firmaHasStrokes, setFirmaHasStrokes] = useState(false);
    const [firmaSaving, setFirmaSaving] = useState(false);
    // canvas for creation modal (entrega only)
    const calFirmaCanvasRef = useRef<HTMLCanvasElement>(null);
    const [calFirmaDrawing, setCalFirmaDrawing] = useState(false);
    const [calFirmaHasStrokes, setCalFirmaHasStrokes] = useState(false);

    // ── List view filters ─────────────────────────────────────────────────
    const [listDateFrom, setListDateFrom] = useState('');
    const [listDateTo, setListDateTo] = useState('');
    const [listSearch, setListSearch] = useState('');
    const [listTab, setListTab] = useState<EventType>('entrega');
    const [exporting, setExporting] = useState(false);

    // ── Auth ──────────────────────────────────────────────────────────────
    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && !['admin', 'logistica', 'jefe'].includes(currentUser.role)) {
            router.push('/'); return;
        }
        fetch('/api/config/locations', { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(l => {
                if (Array.isArray(l)) setLocations(mergeLogisticaClientNames(l.map((x: any) => x.name)));
            })
            .catch(() => {});
        fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, isAuthenticated, currentUser]);

    async function fetchAll() {
        setFetching(true);
        try {
            const [evRes, reqRes] = await Promise.all([
                fetch('/api/logistica/calendario', { headers: getAuthHeaders() }),
                fetch('/api/logistica/solicitudes', { headers: getAuthHeaders() }),
            ]);
            const evData = await evRes.json();
            const reqData = await reqRes.json();
            setEvents(Array.isArray(evData) ? evData : []);
            setRequests(Array.isArray(reqData) ? reqData : []);
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    }

    // ── Calendar grid ─────────────────────────────────────────────────────
    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const emptyCells = firstDay === 0 ? 6 : firstDay - 1;
        const days: (number | null)[] = [];
        for (let i = 0; i < emptyCells; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    }, [currentDate]);

    // ── Events map ────────────────────────────────────────────────────────
    const eventsMap = useMemo(() => {
        const map: Record<string, { entrega: CalEvent[]; despacho: CalEvent[]; solicitud: MaterialRequest[] }> = {};
        events.forEach(ev => {
            if (!ev.fecha) return;
            if (!map[ev.fecha]) map[ev.fecha] = { entrega: [], despacho: [], solicitud: [] };
            if (ev.tipo === 'entrega') map[ev.fecha].entrega.push(ev);
            else if (ev.tipo === 'despacho') map[ev.fecha].despacho.push(ev);
        });
        requests.forEach(r => {
            const d = r.needed_date || r.created_at?.split('T')[0];
            if (!d) return;
            if (!map[d]) map[d] = { entrega: [], despacho: [], solicitud: [] };
            map[d].solicitud.push(r);
        });
        return map;
    }, [events, requests]);

    // ── PDF parse ─────────────────────────────────────────────────────────
    async function handlePdfParse(file: File, target: 'cal' | 'sol') {
        setParsing(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/logistica/calendario/parse-pdf', {
                method: 'POST', headers: getAuthHeaders(), body: fd,
            });
            if (!res.ok) { alert('Error al procesar el PDF'); return; }
            const data = await res.json();

            if (target === 'cal') {
                setCalFileUrl(data.fileUrl || '');
                setCalForm(prev => ({
                    titulo: data.titulo || prev.titulo,
                    descripcion: data.descripcion || prev.descripcion,
                    items: data.items?.length > 0
                        ? data.items.map((i: any) => ({ article: i.article, quantity: i.quantity }))
                        : prev.items,
                }));
                if (data.fecha) setModalDate(data.fecha);
            } else {
                setSolFileUrl(data.fileUrl || '');
                setSolForm(prev => ({
                    ...prev,
                    items: data.items?.length > 0
                        ? data.items.map((i: any) => ({ article: i.article, quantity: i.quantity }))
                        : prev.items,
                }));
            }
        } finally {
            setParsing(false);
        }
    }

    // ── Open modal ────────────────────────────────────────────────────────
    function openModal(date: string, defaultTab: 'entrega' | 'despacho' | 'solicitud' = 'entrega') {
        setModalDate(date);
        setModalTab(defaultTab);
        setCalForm({ titulo: '', descripcion: '', items: [{ article: '', quantity: '' }] });
        setCalFile(null);
        setCalFileUrl('');
        setSolForm({ client: '', items: [] });
        setSolFile(null);
        setSolFileUrl('');
        // reset creation firma
        setCalFirmaHasStrokes(false);
        setTimeout(() => {
            const c = calFirmaCanvasRef.current;
            if (c) { const ctx = c.getContext('2d'); ctx?.clearRect(0, 0, c.width, c.height); }
        }, 50);
        setShowModal(true);
    }

    // ── Save ──────────────────────────────────────────────────────────────
    async function handleSave() {
        setSaving(true);
        try {
            if (modalTab === 'solicitud') {
                const validItems = solForm.items.filter(i => i.article.trim() && i.quantity);
                if (!validItems.length) { alert('Agregá al menos un artículo a la solicitud'); return; }
                let fileUrl = solFileUrl;
                if (solFile && !fileUrl) {
                    const fd = new FormData(); fd.append('file', solFile);
                    const r = await fetch('/api/logistica/solicitudes/upload', { method: 'POST', headers: getAuthHeaders(), body: fd });
                    if (r.ok) fileUrl = (await r.json()).fileUrl;
                }
                const res = await fetch('/api/logistica/solicitudes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({ client: solForm.client, needed_date: modalDate, items: validItems, file_url: fileUrl }),
                });
                if (!res.ok) { alert((await res.json()).error || 'Error'); return; }
            } else {
                if (!modalDate) { alert('Seleccioná una fecha'); return; }
                let firmaUrl: string | null = null;
                if (modalTab === 'entrega' && calFirmaHasStrokes && calFirmaCanvasRef.current) {
                    try { firmaUrl = await uploadSig(calFirmaCanvasRef.current, getAuthHeaders()); } catch { /* non-critical */ }
                }
                const res = await fetch('/api/logistica/calendario', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        fecha: modalDate,
                        tipo: modalTab,
                        titulo: calForm.titulo || null,
                        descripcion: calForm.descripcion || null,
                        items: calForm.items.filter(i => i.article.trim()),
                        file_url: calFileUrl || null,
                        firma_url: firmaUrl,
                    }),
                });
                if (!res.ok) { alert((await res.json()).error || 'Error'); return; }
            }
            setShowModal(false);
            fetchAll();
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteEvent(id: number) {
        if (!confirm('¿Eliminar este evento?')) return;
        await fetch(`/api/logistica/calendario?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAll();
    }

    async function handleDeleteSolicitud(id: number) {
        if (!confirm('¿Eliminar esta solicitud?')) return;
        await fetch(`/api/logistica/solicitudes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAll();
    }

    async function firmaSave() {
        const canvas = firmaCanvasRef.current;
        if (!canvas || !firmaEvent || !firmaHasStrokes) return;
        setFirmaSaving(true);
        try {
            const fileUrl = await uploadSig(canvas, getAuthHeaders());
            const res = await fetch(`/api/logistica/calendario?id=${firmaEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ firma_url: fileUrl }),
            });
            if (!res.ok) { alert('Error al guardar firma'); return; }
            setFirmaEvent(null);
            setFirmaHasStrokes(false);
            fetchAll();
        } catch { alert('Error al subir firma'); }
        finally { setFirmaSaving(false); }
    }

    // ── Filtered list data ────────────────────────────────────────────────
    const filteredEvents = useMemo(() => {
        return events.filter(ev => {
            if (listDateFrom && ev.fecha < listDateFrom) return false;
            if (listDateTo && ev.fecha > listDateTo) return false;
            if (listSearch) {
                const s = listSearch.toLowerCase();
                const hay = `${ev.titulo || ''} ${ev.descripcion || ''} ${ev.created_by || ''} ${ev.items?.map((i: any) => i.article).join(' ') || ''}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            return true;
        });
    }, [events, listDateFrom, listDateTo, listSearch]);

    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            if (listDateFrom && r.needed_date < listDateFrom) return false;
            if (listDateTo && r.needed_date > listDateTo) return false;
            if (listSearch) {
                const s = listSearch.toLowerCase();
                const hay = `${r.client || ''} ${r.requested_by || ''} ${r.items?.map((i: any) => i.article).join(' ') || ''}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            return true;
        });
    }, [requests, listDateFrom, listDateTo, listSearch]);

    async function handleExport() {
        setExporting(true);
        try {
            const p = new URLSearchParams();
            if (listDateFrom) p.set('desde', listDateFrom);
            if (listDateTo) p.set('hasta', listDateTo);
            if (listSearch) p.set('search', listSearch);
            const res = await fetch(`/api/logistica/calendario/export?${p.toString()}`, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `calendario-logistico-${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(a.href);
        } finally {
            setExporting(false); }
    }

    if (loading || !currentUser) return null;

    const todayStr = todayIso();
    /** Campos del modal "Nuevo Evento" más compactos en móvil */
    const m = isMobile;
    const modalField: CSSProperties = {
        width: '100%',
        boxSizing: 'border-box',
        padding: m ? '0.3rem 0.5rem' : '0.5rem',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        fontSize: m ? '0.8125rem' : '0.85rem',
        backgroundColor: 'var(--bg-color)',
        color: 'var(--text-primary)',
    };
    const modalBodyGap = m ? '0.75rem' : '1rem';
    const selectedDayData = selectedDate ? eventsMap[selectedDate] : null;
    const hasSelectedEvents = selectedDayData && (
        selectedDayData.entrega.length > 0 ||
        selectedDayData.despacho.length > 0 ||
        selectedDayData.solicitud.length > 0
    );

    return (
        <>
            <style jsx global>{`
                @media (max-width: 768px) {
                    .cal-grid-container {
                        grid-template-columns: 1fr !important;
                    }
                    .cal-grid-container .card {
                        overflow: hidden;
                    }
                    .logistica-table-wrap {
                        display: block;
                        width: 100%;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                    }
                    .logistica-table-wrap table {
                        font-size: 0.75rem;
                    }
                    .historial-filters {
                        flex-direction: column !important;
                        gap: 0.5rem !important;
                    }
                    .historial-filters > div {
                        width: 100% !important;
                        min-width: 0 !important;
                        flex: none !important;
                    }
                    .historial-filters .filter-clear-btn {
                        align-self: stretch !important;
                        text-align: center;
                        padding: 0.4rem !important;
                        border: 1px solid var(--border-color) !important;
                        border-radius: var(--radius) !important;
                        text-decoration: none !important;
                        background: var(--bg-color);
                    }
                    .historial-tabs {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                        padding-bottom: 2px;
                    }
                    .historial-tabs::-webkit-scrollbar {
                        display: none;
                    }
                    .historial-tabs button {
                        flex-shrink: 0;
                        font-size: 0.78rem !important;
                        padding: 0.45rem 0.7rem !important;
                    }
                    .historial-section-header {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                    .historial-section-header button {
                        width: 100% !important;
                        justify-content: center;
                    }
                }
            `}</style>
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <Link href="/logistica" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Logística
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1100px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflow: 'hidden' }}>

                {/* Page title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <CalendarDays size={24} color="var(--primary-color)" /> Calendario Logístico
                        </h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>Entregas, ingresos de mercadería y solicitudes</p>
                    </div>
                    <button
                        onClick={() => openModal(todayStr)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.6rem 1.1rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                        <Plus size={16} /> Nuevo Evento
                    </button>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {(Object.entries(TYPE_CONFIG) as [EventType, typeof TYPE_CONFIG[EventType]][]).map(([key, cfg]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color }} />
                            {cfg.label}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: '1.5rem', minWidth: 0 }} className="cal-grid-container">

                    {/* ── Calendar ── */}
                    <div className="card" style={{ padding: '1.25rem' }}>
                        {/* Month nav */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem' }}>&lt;</button>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize', fontSize: '1rem' }}>
                                {currentDate.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem' }}>&gt;</button>
                        </div>

                        {/* Day headers */}
                        <div style={{ display: 'flex', marginBottom: '0.4rem' }}>
                            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                                <div key={d} style={{ width: '14.285%', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.2rem', flexShrink: 0 }}>{d}</div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {calendarGrid.map((day, idx) => {
                                if (!day) return <div key={`e-${idx}`} style={{ width: '14.285%', flexShrink: 0 }} />;
                                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayData = eventsMap[dateStr];
                                const hasEntrega = (dayData?.entrega?.length ?? 0) > 0;
                                const hasDespacho = (dayData?.despacho?.length ?? 0) > 0;
                                const hasSolicitud = (dayData?.solicitud?.length ?? 0) > 0;
                                const hasAny = hasEntrega || hasDespacho || hasSolicitud;
                                const isSelected = selectedDate === dateStr;
                                const isToday = dateStr === todayStr;

                                // Pick dominant background color when there are events (and not selected)
                                const bgColor = isSelected
                                    ? 'var(--primary-color)'
                                    : hasEntrega
                                        ? 'rgba(34,197,94,0.15)'
                                        : hasDespacho
                                            ? 'rgba(224,73,81,0.13)'
                                            : hasSolicitud
                                                ? 'rgba(245,158,11,0.14)'
                                                : isToday
                                                    ? 'rgba(41,65,107,0.08)'
                                                    : 'transparent';

                                const borderColor = isSelected
                                    ? 'transparent'
                                    : hasEntrega
                                        ? '#22c55e'
                                        : hasDespacho
                                            ? '#e04951'
                                            : hasSolicitud
                                                ? '#f59e0b'
                                                : isToday
                                                    ? 'var(--primary-color)'
                                                    : 'transparent';

                                return (
                                    <div key={`d-${idx}`} style={{ width: '14.285%', flexShrink: 0, padding: '1px', boxSizing: 'border-box' }}>
                                    <div
                                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '7px', cursor: 'pointer', position: 'relative',
                                            backgroundColor: bgColor,
                                            border: `2px solid ${borderColor}`,
                                            transition: 'all 0.15s',
                                            boxShadow: hasAny && !isSelected ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                        onMouseOver={e => { if (!isSelected) { e.currentTarget.style.opacity = '0.8'; } }}
                                        onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}
                                    >
                                        <span style={{ fontSize: '0.82rem', fontWeight: hasAny || isToday || isSelected ? 700 : 400, color: isSelected ? 'white' : 'var(--text-primary)', lineHeight: 1 }}>{day}</span>
                                        {hasAny && !isSelected && (
                                            <div style={{ display: 'flex', gap: '2px', marginTop: '3px' }}>
                                                {hasEntrega && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: TYPE_CONFIG.entrega.color }} />}
                                                {hasDespacho && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: TYPE_CONFIG.despacho.color }} />}
                                                {hasSolicitud && <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: TYPE_CONFIG.solicitud.color }} />}
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add event button for selected date */}
                        {selectedDate && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtDate(selectedDate)}</span>
                                <button
                                    onClick={() => openModal(selectedDate)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.8rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                                >
                                    <Plus size={14} /> Agregar evento
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Side panel ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {!selectedDate ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                Seleccioná un día para ver sus eventos
                            </div>
                        ) : !hasSelectedEvents ? (
                            <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1rem' }}>Sin eventos el {fmtDate(selectedDate)}</p>
                                <button onClick={() => openModal(selectedDate)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600, padding: '0.4rem 0.9rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                                    <Plus size={14} /> Agregar evento
                                </button>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '1rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    {fmtDate(selectedDate)}
                                </h3>

                                {/* Entregas */}
                                {selectedDayData!.entrega.length > 0 && (
                                    <EventSection
                                        type="entrega"
                                        items={selectedDayData!.entrega}
                                        onDelete={handleDeleteEvent}
                                        onFirma={setFirmaEvent}
                                    />
                                )}

                                {/* Ingresos mercadería */}
                                {selectedDayData!.despacho.length > 0 && (
                                    <EventSection
                                        type="despacho"
                                        items={selectedDayData!.despacho}
                                        onDelete={handleDeleteEvent}
                                    />
                                )}

                                {/* Solicitudes */}
                                {selectedDayData!.solicitud.length > 0 && (
                                    <div style={{ marginTop: selectedDayData!.entrega.length + selectedDayData!.despacho.length > 0 ? '1rem' : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                            {TYPE_CONFIG.solicitud.icon}
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: TYPE_CONFIG.solicitud.color }}>Solicitudes</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedDayData!.solicitud.map(r => (
                                                <div key={r.id} style={{ borderLeft: `3px solid ${SOL_STATUS_COLORS[r.status]}`, paddingLeft: '0.6rem', fontSize: '0.82rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <span style={{ fontWeight: 600 }}>{r.client || 'Sin cliente'}</span>
                                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', backgroundColor: `${SOL_STATUS_COLORS[r.status]}20`, color: SOL_STATUS_COLORS[r.status], fontWeight: 600 }}>
                                                                {SOL_STATUS_LABELS[r.status]}
                                                            </span>
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>por {r.requested_by}</div>
                                                            <ul style={{ margin: '0.3rem 0 0', padding: '0 0 0 0.8rem', color: 'var(--text-secondary)' }}>
                                                                {r.items?.map((it, i) => <li key={i}><strong>{it.quantity}x</strong> {it.article}</li>)}
                                                            </ul>
                                                        </div>
                                                        {['admin', 'jefe'].includes(currentUser.role) && (
                                                            <button onClick={() => handleDeleteSolicitud(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}>
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {r.file_url && (
                                                        <a href={`/api/file-proxy?url=${encodeURIComponent(r.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--primary-color)', marginTop: '0.25rem' }}>
                                                            <FileText size={11} /> Ver adjunto
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick access upcoming events */}
                        <UpcomingEvents events={events} requests={requests} onDayClick={d => { setSelectedDate(d); const [y, m] = d.split('-'); setCurrentDate(new Date(Number(y), Number(m) - 1, 1)); }} />
                    </div>
                </div>
            </main>

            {/* ── List view ── */}
            <section style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '0 1.5rem 2rem', minWidth: 0, overflow: 'hidden' }}>
                <div className="card" style={{ padding: '1.25rem', minWidth: 0, overflow: 'hidden' }}>
                    {/* Section header */}
                    <div className="historial-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Historial completo</h2>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600, opacity: exporting ? 0.7 : 1, flexShrink: 0 }}
                        >
                            <Download size={15} /> {exporting ? 'Exportando...' : 'Exportar Excel'}
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="historial-filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Desde</label>
                            <input type="date" value={listDateFrom} onChange={e => setListDateFrom(e.target.value)} style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hasta</label>
                            <input type="date" value={listDateTo} onChange={e => setListDateTo(e.target.value)} style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Buscar</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    value={listSearch}
                                    onChange={e => setListSearch(e.target.value)}
                                    placeholder="Cliente, artículo, usuario..."
                                    style={{ width: '100%', padding: '0.4rem 0.6rem 0.4rem 1.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                        {(listDateFrom || listDateTo || listSearch) && (
                            <button className="filter-clear-btn" onClick={() => { setListDateFrom(''); setListDateTo(''); setListSearch(''); }} style={{ padding: '0.4rem 0.7rem', background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-end' }}>
                                Limpiar
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="historial-tabs" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)' }}>
                        {(['entrega', 'despacho', 'solicitud'] as EventType[]).map(t => {
                            const count = t === 'solicitud' ? filteredRequests.length : filteredEvents.filter(e => e.tipo === t).length;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setListTab(t)}
                                    style={{
                                        padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                                        fontSize: '0.85rem', fontWeight: listTab === t ? 700 : 500,
                                        color: listTab === t ? TYPE_CONFIG[t].color : 'var(--text-secondary)',
                                        borderBottom: listTab === t ? `3px solid ${TYPE_CONFIG[t].color}` : '3px solid transparent',
                                        marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {TYPE_CONFIG[t].icon}{' '}
                                    {t === 'solicitud' ? 'Solicitudes' : t === 'despacho' ? 'Ingresos de mercadería' : `${TYPE_CONFIG[t].label}s`}
                                    <span style={{ fontSize: '0.7rem', backgroundColor: listTab === t ? `${TYPE_CONFIG[t].color}20` : 'var(--bg-color)', color: listTab === t ? TYPE_CONFIG[t].color : 'var(--text-secondary)', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 700 }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Table/Cards: Entregas / Ingresos mercadería */}
                    {(listTab === 'entrega' || listTab === 'despacho') && (() => {
                        const rows = filteredEvents.filter(e => e.tipo === listTab);
                        if (fetching) return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.85rem' }}>Cargando...</p>;
                        if (rows.length === 0) return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.85rem' }}>Sin resultados.</p>;
                        if (isMobile) return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
                                {rows.map(ev => (
                                    <div key={ev.id} style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{ev.titulo || <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Sin título</span>}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{fmtDate(ev.fecha)}</div>
                                            </div>
                                            <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.15rem', flexShrink: 0 }}><Trash2 size={15} /></button>
                                        </div>
                                        {/* Items */}
                                        {ev.items?.length > 0 && (
                                            <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '6px', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                {ev.items.map((it, j) => (
                                                    <div key={j} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{it.quantity}x</span> {it.article}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Footer row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>por {ev.created_by}</span>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {ev.descripcion && <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.descripcion}</span>}
                                                {ev.file_url && (
                                                    <a href={`/api/file-proxy?url=${encodeURIComponent(ev.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                                        <FileText size={13} /> Doc
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                        return (
                            <div className="logistica-table-wrap" style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                            {['Fecha', 'Cliente', 'Artículos', 'Notas', 'Registrado por', 'Doc.', ''].map(h => (
                                                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((ev, i) => (
                                            <tr key={ev.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(ev.fecha)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>{ev.titulo || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {ev.items?.length > 0
                                                        ? ev.items.map((it, j) => <div key={j}><strong>{it.quantity}x</strong> {it.article}</div>)
                                                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{ev.descripcion || '—'}</td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{ev.created_by}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {ev.file_url
                                                        ? <a href={`/api/file-proxy?url=${encodeURIComponent(ev.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><FileText size={13} /> Ver</a>
                                                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}><Trash2 size={13} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

                    {/* Table/Cards: Solicitudes */}
                    {listTab === 'solicitud' && (() => {
                        const rows = filteredRequests;
                        if (fetching) return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.85rem' }}>Cargando...</p>;
                        if (rows.length === 0) return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontSize: '0.85rem' }}>Sin resultados.</p>;
                        if (isMobile) return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
                                {rows.map(r => (
                                    <div key={r.id} style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{r.client || <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Sin cliente</span>}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{fmtDate(r.needed_date)}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: `${SOL_STATUS_COLORS[r.status]}20`, color: SOL_STATUS_COLORS[r.status], fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {SOL_STATUS_LABELS[r.status]}
                                                </span>
                                                {['admin', 'jefe'].includes(currentUser.role) && (
                                                    <button onClick={() => handleDeleteSolicitud(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.15rem' }}><Trash2 size={15} /></button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Items */}
                                        {r.items?.length > 0 && (
                                            <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '6px', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                {r.items.map((it, j) => (
                                                    <div key={j} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{it.quantity}x</span> {it.article}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>por {r.requested_by}</span>
                                            {r.file_url && (
                                                <a href={`/api/file-proxy?url=${encodeURIComponent(r.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                                    <FileText size={13} /> Doc
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                        return (
                            <div className="logistica-table-wrap" style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                            {['Fecha', 'Cliente', 'Artículos', 'Estado', 'Solicitado por', 'Doc.', ''].map(h => (
                                                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, i) => (
                                            <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(r.needed_date)}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>{r.client || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {r.items?.map((it, j) => <div key={j}><strong>{it.quantity}x</strong> {it.article}</div>)}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: `${SOL_STATUS_COLORS[r.status]}20`, color: SOL_STATUS_COLORS[r.status], fontWeight: 700 }}>
                                                        {SOL_STATUS_LABELS[r.status]}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{r.requested_by}</td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {r.file_url
                                                        ? <a href={`/api/file-proxy?url=${encodeURIComponent(r.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><FileText size={13} /> Ver</a>
                                                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    {['admin', 'jefe'].includes(currentUser.role) && (
                                                        <button onClick={() => handleDeleteSolicitud(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}><Trash2 size={13} /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </section>

            {/* ── Modal ── */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: m ? '0.5rem' : '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: m ? '1rem' : '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: m ? '0.85rem' : '1.25rem' }}>
                            <h2 style={{ fontSize: m ? '0.98rem' : '1.05rem', fontWeight: 700, margin: 0 }}>Nuevo Evento</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        {/* Date input */}
                        <div style={{ marginBottom: modalBodyGap }}>
                            <label style={{ display: 'block', fontSize: m ? '0.78rem' : '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Fecha</label>
                            <input
                                type="date"
                                value={modalDate}
                                onChange={e => setModalDate(e.target.value)}
                                style={{ ...modalField, minHeight: m ? '2rem' : undefined }}
                            />
                        </div>

                        {/* Tab selector */}
                        <div style={{ display: 'flex', gap: m ? '0.25rem' : '0.4rem', marginBottom: m ? '0.85rem' : '1.25rem', backgroundColor: 'var(--bg-color)', padding: m ? '0.2rem' : '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                            {(['entrega', 'despacho', 'solicitud'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setModalTab(t)}
                                    style={{
                                        flex: 1, padding: m ? '0.32rem 0.2rem' : '0.45rem', borderRadius: 'calc(var(--radius) - 2px)', border: 'none',
                                        backgroundColor: modalTab === t ? TYPE_CONFIG[t].color : 'transparent',
                                        color: modalTab === t ? 'white' : 'var(--text-secondary)',
                                        fontSize: m ? '0.7rem' : '0.78rem', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: m ? '0.15rem' : '0.3rem',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
                                </button>
                            ))}
                        </div>

                        {/* ── Entrega / Despacho form ── */}
                        {(modalTab === 'entrega' || modalTab === 'despacho') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: modalBodyGap }}>
                                {/* PDF upload */}
                                <div style={{ backgroundColor: 'var(--bg-color)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                                        📄 Subir PDF para autocompletar
                                    </label>
                                    <input
                                        ref={calFileRef}
                                        type="file"
                                        accept="application/pdf"
                                        style={{ display: 'none' }}
                                        onChange={async e => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            setCalFile(f);
                                            await handlePdfParse(f, 'cal');
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => calFileRef.current?.click()}
                                        disabled={parsing}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.82rem', cursor: parsing ? 'wait' : 'pointer' }}
                                    >
                                        {parsing ? <><Loader2 size={14} className="spin" /> Leyendo PDF...</> : <><FileText size={14} /> Seleccionar PDF</>}
                                    </button>
                                    {calFile && !parsing && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{calFile.name}</span>}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: m ? '0.78rem' : '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Cliente</label>
                                    <input
                                        list="cal-clientes-list"
                                        value={calForm.titulo}
                                        onChange={e => setCalForm({ ...calForm, titulo: e.target.value })}
                                        placeholder="Seleccionar o escribir cliente..."
                                        style={modalField}
                                    />
                                    <datalist id="cal-clientes-list">
                                        {locations.map(loc => <option key={loc} value={loc} />)}
                                    </datalist>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Artículos</label>
                                        <button type="button" onClick={() => setCalForm({ ...calForm, items: [...calForm.items, { article: '', quantity: '' }] })} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                            <Plus size={13} /> Agregar fila
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {calForm.items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                <input
                                                    value={item.article}
                                                    onChange={e => { const c = [...calForm.items]; c[idx].article = e.target.value; setCalForm({ ...calForm, items: c }); }}
                                                    placeholder="Artículo"
                                                    style={{ flex: 1, padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                                />
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => { const c = [...calForm.items]; c[idx].quantity = e.target.value; setCalForm({ ...calForm, items: c }); }}
                                                    placeholder="Cant."
                                                    style={{ width: '70px', padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                                />
                                                {calForm.items.length > 1 && (
                                                    <button type="button" onClick={() => setCalForm({ ...calForm, items: calForm.items.filter((_, i) => i !== idx) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}><X size={15} /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>Notas (opcional)</label>
                                    <textarea
                                        value={calForm.descripcion}
                                        onChange={e => setCalForm({ ...calForm, descripcion: e.target.value })}
                                        rows={2}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }}
                                    />
                                </div>

                                {/* Firma del receptor — solo para entrega */}
                                {modalTab === 'entrega' && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                <PenLine size={13} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                                                Firma del receptor <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>(opcional)</span>
                                            </label>
                                            {calFirmaHasStrokes && (
                                                <button type="button" onClick={() => sigClear(calFirmaCanvasRef.current, setCalFirmaHasStrokes)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar</button>
                                            )}
                                        </div>
                                        <canvas
                                            ref={calFirmaCanvasRef}
                                            width={460}
                                            height={120}
                                            onMouseDown={e => sigStart(e, calFirmaCanvasRef.current, setCalFirmaDrawing)}
                                            onMouseMove={e => sigMove(e, calFirmaCanvasRef.current, calFirmaDrawing, setCalFirmaHasStrokes)}
                                            onMouseUp={e => sigEnd(e, setCalFirmaDrawing)}
                                            onMouseLeave={e => sigEnd(e, setCalFirmaDrawing)}
                                            onTouchStart={e => sigStart(e, calFirmaCanvasRef.current, setCalFirmaDrawing)}
                                            onTouchMove={e => sigMove(e, calFirmaCanvasRef.current, calFirmaDrawing, setCalFirmaHasStrokes)}
                                            onTouchEnd={e => sigEnd(e, setCalFirmaDrawing)}
                                            style={{ width: '100%', height: '120px', border: `2px solid ${calFirmaHasStrokes ? '#22c55e' : 'var(--border-color)'}`, borderRadius: 'var(--radius)', backgroundColor: 'white', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                                        />
                                        {!calFirmaHasStrokes && (
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', textAlign: 'center' }}>Dibujá la firma del receptor aquí</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Solicitud form ── */}
                        {modalTab === 'solicitud' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: modalBodyGap }}>
                                {/* Cliente */}
                                <div>
                                    <label style={{ display: 'block', fontSize: m ? '0.78rem' : '0.82rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Cliente</label>
                                    <select
                                        value={solForm.client}
                                        onChange={e => setSolForm({ ...solForm, client: e.target.value })}
                                        style={{ ...modalField, minHeight: m ? '2rem' : undefined }}
                                    >
                                        <option value="">Seleccionar cliente...</option>
                                        {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                {/* Lista de artículos — dropdown para seleccionar */}
                                <div>
                                    <label style={{ display: 'block', fontSize: m ? '0.78rem' : '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>Artículos Solicitados</label>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: m ? 'column' : 'row',
                                            gap: m ? '0.45rem' : '0.4rem',
                                            alignItems: m ? 'stretch' : 'flex-start',
                                            marginBottom: '0.4rem',
                                        }}
                                    >
                                        <ArticuloSearchAdd
                                            compact={m}
                                            options={ARTICULOS_MATERIALES.filter(a => !solForm.items.some(i => i.article === a))}
                                            onSelect={(article) => {
                                                if (solForm.items.some(i => i.article === article)) return;
                                                setSolForm({ ...solForm, items: [...solForm.items, { article, quantity: '' }] });
                                            }}
                                            placeholder="Buscar artículo…"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setSolForm({ ...solForm, items: [...solForm.items, { article: '', quantity: '' }] })}
                                            style={{
                                                background: 'none',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius)',
                                                padding: m ? '0.32rem 0.5rem' : '0.35rem 0.55rem',
                                                color: 'var(--text-primary)',
                                                fontSize: m ? '0.75rem' : '0.78rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: m ? 'center' : 'flex-start',
                                                gap: '0.25rem',
                                                flexShrink: 0,
                                                whiteSpace: m ? undefined : 'nowrap',
                                            }}
                                        >
                                            <Plus size={m ? 12 : 13} /> Artículo manual
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {solForm.items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                <input
                                                    value={item.article}
                                                    onChange={e => {
                                                        const c = [...solForm.items];
                                                        c[idx].article = e.target.value;
                                                        setSolForm({ ...solForm, items: c });
                                                    }}
                                                    placeholder="Nombre del artículo"
                                                    style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.6rem' }}
                                                />
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => { const c = [...solForm.items]; c[idx].quantity = e.target.value; setSolForm({ ...solForm, items: c }); }}
                                                    placeholder="Cant."
                                                    style={{ width: '80px', padding: '0.45rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.82rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                                />
                                                <button type="button" onClick={() => setSolForm({ ...solForm, items: solForm.items.filter((_, i) => i !== idx) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}><X size={15} /></button>
                                            </div>
                                        ))}
                                        {solForm.items.length === 0 && (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.85rem 0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)' }}>
                                                Agregá artículos a tu solicitud.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: m ? '0.4rem' : '0.5rem', marginTop: m ? '1.1rem' : '1.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: m ? '0.4rem 0.85rem' : '0.5rem 1rem', fontSize: m ? '0.8rem' : '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || parsing}
                                style={{ padding: m ? '0.4rem 0.95rem' : '0.5rem 1.1rem', fontSize: m ? '0.8rem' : '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: TYPE_CONFIG[modalTab].color, color: 'white', cursor: 'pointer', fontWeight: 600, opacity: saving || parsing ? 0.7 : 1 }}
                            >
                                {saving ? 'Guardando...' : `Guardar ${TYPE_CONFIG[modalTab].label}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

            {/* ── Firma edit modal ── */}
            {firmaEvent && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Firma del receptor</h2>
                                {firmaEvent.titulo && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>{firmaEvent.titulo} — {fmtDate(firmaEvent.fecha)}</p>}
                            </div>
                            <button onClick={() => { setFirmaEvent(null); setFirmaHasStrokes(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        {firmaEvent.firma_url ? (
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Firma registrada:</p>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={firmaEvent.firma_url} alt="Firma" style={{ maxWidth: '100%', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'white' }} />
                                <button
                                    onClick={() => setFirmaEvent({ ...firmaEvent, firma_url: null })}
                                    style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Reemplazar firma
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Dibujá la firma en el recuadro:</p>
                                    {firmaHasStrokes && (
                                        <button type="button" onClick={() => sigClear(firmaCanvasRef.current, setFirmaHasStrokes)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar</button>
                                    )}
                                </div>
                                <canvas
                                    ref={firmaCanvasRef}
                                    width={600}
                                    height={160}
                                    onMouseDown={e => sigStart(e, firmaCanvasRef.current, setFirmaDrawing)}
                                    onMouseMove={e => sigMove(e, firmaCanvasRef.current, firmaDrawing, setFirmaHasStrokes)}
                                    onMouseUp={e => sigEnd(e, setFirmaDrawing)}
                                    onMouseLeave={e => sigEnd(e, setFirmaDrawing)}
                                    onTouchStart={e => sigStart(e, firmaCanvasRef.current, setFirmaDrawing)}
                                    onTouchMove={e => sigMove(e, firmaCanvasRef.current, firmaDrawing, setFirmaHasStrokes)}
                                    onTouchEnd={e => sigEnd(e, setFirmaDrawing)}
                                    style={{ width: '100%', height: '160px', border: `2px solid ${firmaHasStrokes ? '#22c55e' : 'var(--border-color)'}`, borderRadius: 'var(--radius)', backgroundColor: 'white', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
                                />
                                {!firmaHasStrokes && (
                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0', textAlign: 'center' }}>Área de firma</p>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                                    <button onClick={() => { setFirmaEvent(null); setFirmaHasStrokes(false); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={firmaSave}
                                        disabled={!firmaHasStrokes || firmaSaving}
                                        style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: '#22c55e', color: 'white', cursor: !firmaHasStrokes || firmaSaving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: !firmaHasStrokes || firmaSaving ? 0.6 : 1 }}
                                    >
                                        {firmaSaving ? 'Guardando...' : 'Guardar firma'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EventSection({ type, items, onDelete, onFirma }: {
    type: 'entrega' | 'despacho';
    items: CalEvent[];
    onDelete: (id: number) => void;
    onFirma?: (ev: CalEvent) => void;
}) {
    const cfg = TYPE_CONFIG[type];
    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {cfg.icon}
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: cfg.color }}>
                    {type === 'despacho' ? 'Ingresos de mercadería' : `${cfg.label}s`}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map(ev => (
                    <div key={ev.id} style={{ borderLeft: `3px solid ${cfg.color}`, paddingLeft: '0.6rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                {ev.titulo && <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{ev.titulo}</div>}
                                {ev.items?.length > 0 && (
                                    <ul style={{ margin: '0.2rem 0', padding: '0 0 0 0.8rem', color: 'var(--text-secondary)' }}>
                                        {ev.items.map((it, i) => (
                                            <li key={i}><strong>{it.quantity}x</strong> {it.article}</li>
                                        ))}
                                    </ul>
                                )}
                                {ev.descripcion && <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{ev.descripcion}</div>}
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '0.2rem' }}>por {ev.created_by}</div>
                                {ev.file_url && (
                                    <a href={`/api/file-proxy?url=${encodeURIComponent(ev.file_url)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--primary-color)', marginTop: '0.2rem' }}>
                                        <FileText size={11} /> Ver documento
                                    </a>
                                )}
                                {/* Firma */}
                                {ev.firma_url ? (
                                    <div style={{ marginTop: '0.4rem' }}>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', fontWeight: 600, textTransform: 'uppercase' }}>Firma del receptor</div>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={ev.firma_url} alt="Firma" style={{ maxWidth: '120px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'white' }} />
                                    </div>
                                ) : (
                                    type === 'entrega' && onFirma && (
                                        <button
                                            onClick={() => onFirma(ev)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                        >
                                            <PenLine size={11} /> Agregar firma
                                        </button>
                                    )
                                )}
                            </div>
                            <button onClick={() => onDelete(ev.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function UpcomingEvents({ events, requests, onDayClick }: {
    events: CalEvent[];
    requests: MaterialRequest[];
    onDayClick: (date: string) => void;
}) {
    const today = todayIso();
    const upcoming = useMemo(() => {
        const items: { date: string; label: string; color: string }[] = [];
        events
            .filter(e => e.fecha >= today)
            .forEach(e => items.push({ date: e.fecha, label: `${TYPE_CONFIG[e.tipo].label}: ${e.titulo || ''}`, color: TYPE_CONFIG[e.tipo].color }));
        requests
            .filter(r => r.needed_date >= today && r.status !== 'fulfilled')
            .forEach(r => items.push({ date: r.needed_date, label: `Solicitud: ${r.client || r.items?.[0]?.article || ''}`, color: TYPE_CONFIG.solicitud.color }));
        return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    }, [events, requests, today]);

    if (upcoming.length === 0) return null;

    return (
        <div className="card" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>Próximos eventos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {upcoming.map((ev, i) => (
                    <button
                        key={i}
                        onClick={() => onDayClick(ev.date)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0.3rem 0', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                    >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ev.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{fmtDate(ev.date)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
