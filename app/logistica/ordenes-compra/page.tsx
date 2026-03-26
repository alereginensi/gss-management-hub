'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Download, Trash2, LogOut, Search, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface OrderItem { id: number; quantity: number; article: string; unit_price: number | null; discount: number; subtotal: number | null; }
interface PurchaseOrder {
    id: number; order_number: string | null; adenda_id: string | null;
    rut_emisor: string | null; rut_comprador: string | null; buyer_name: string | null;
    issue_date: string | null; due_date: string | null;
    total_amount: number | null; neto_basica: number | null; neto_minima: number | null;
    iva_basica: number | null; iva_minima: number | null; discounts: number | null; exempt: number | null;
    status: 'pending' | 'approved' | 'paid' | 'cancelled' | 'partial_received' | 'received';
    notes: string | null; file_url: string | null; created_by: string | null; created_at: string;
    items?: OrderItem[];
    received_items?: string | null;
}

const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', paid: 'Pagada', cancelled: 'Anulada', partial_received: 'Recibida parcial', received: 'Recibida total' };
const STATUS_COLORS: Record<string, string> = { pending: '#f59e0b', approved: '#3b82f6', paid: '#22c55e', cancelled: '#e04951', partial_received: '#8b5cf6', received: '#059669' };
const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2 })}` : '-';

const EMPTY_FORM = {
    order_number: '', adenda_id: '', rut_emisor: '', rut_comprador: '', buyer_name: '',
    issue_date: '', due_date: '', total_amount: '', neto_basica: '', neto_minima: '',
    iva_basica: '', iva_minima: '', discounts: '', exempt: '', notes: '', file_url: '',
};

export default function OrdenesCompraPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext();
    const router = useRouter();

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [fetching, setFetching] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [items, setItems] = useState<Omit<OrderItem, 'id'>[]>([]);
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [parsedRawText, setParsedRawText] = useState('');
    const [parsing, setParsing] = useState(false);

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState('');
    const isFirstRender = useRef(true);

    // Partial receive modal state
    const [partialReceiveModal, setPartialReceiveModal] = useState<{ orderId: number; items: OrderItem[] } | null>(null);
    const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});

    // Mobile Check
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'logistica') router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    const buildUrl = () => {
        const p = new URLSearchParams();
        if (statusFilter) p.set('status', statusFilter);
        if (dateFrom) p.set('dateFrom', dateFrom);
        if (dateTo) p.set('dateTo', dateTo);
        if (search) p.set('search', search);
        return `/api/logistica/ordenes?${p.toString()}`;
    };

    const fetchOrders = async () => {
        try {
            const res = await fetch(buildUrl(), { headers: getAuthHeaders() });
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch { /* ignore */ } finally { setFetching(false); }
    };

    useEffect(() => { if (!loading && isAuthenticated) fetchOrders(); }, [loading, isAuthenticated]);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        fetchOrders();
    }, [statusFilter, dateFrom, dateTo, search]);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setParsing(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const authHeaders = getAuthHeaders() as Record<string, string>;
            const { 'Content-Type': _, ...headersWithoutContentType } = authHeaders;
            const res = await fetch('/api/logistica/ordenes/parse-pdf', {
                method: 'POST',
                headers: headersWithoutContentType,
                body: fd,
            });
            const data = await res.json();
            if (res.ok) {
                setForm(prev => ({
                    ...prev,
                    order_number: data.orderNumber || prev.order_number,
                    adenda_id: data.adendaId || prev.adenda_id,
                    rut_emisor: data.rutEmisor || prev.rut_emisor,
                    rut_comprador: data.rutComprador || prev.rut_comprador,
                    issue_date: data.issueDate ? toInputDate(data.issueDate) : prev.issue_date,
                    due_date: data.dueDate ? toInputDate(data.dueDate) : prev.due_date,
                    total_amount: data.totalAmount != null ? String(data.totalAmount) : prev.total_amount,
                    neto_basica: data.netoBasica != null ? String(data.netoBasica) : prev.neto_basica,
                    neto_minima: data.netoMinima != null ? String(data.netoMinima) : prev.neto_minima,
                    iva_basica: data.ivaBasica != null ? String(data.ivaBasica) : prev.iva_basica,
                    iva_minima: data.ivaMinima != null ? String(data.ivaMinima) : prev.iva_minima,
                    discounts: data.discounts != null ? String(data.discounts) : prev.discounts,
                    exempt: data.exempt != null ? String(data.exempt) : prev.exempt,
                    file_url: data.fileUrl || prev.file_url,
                }));
                if (data.items?.length) setItems(data.items);
                setParsedRawText(data.text || '');
            }
        } catch { /* ignore */ } finally { setParsing(false); }
    };

    // Convert dd/mm/yyyy → yyyy-mm-dd for date inputs
    const toInputDate = (d: string) => {
        const parts = d.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return d;
    };

    const openModal = () => { setForm(EMPTY_FORM); setItems([]); setFormErrors({}); setParsedRawText(''); setShowModal(true); };
    const closeModal = () => setShowModal(false);

    const validate = () => {
        const errors: Record<string, string> = {};
        if (!form.issue_date) errors.issue_date = 'La fecha de emisión es obligatoria';
        if (!form.total_amount) errors.total_amount = 'El total es obligatorio';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validate() || saving) return;
        setSaving(true);
        try {
            const body = {
                ...form,
                total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
                neto_basica: form.neto_basica ? parseFloat(form.neto_basica) : null,
                neto_minima: form.neto_minima ? parseFloat(form.neto_minima) : null,
                iva_basica: form.iva_basica ? parseFloat(form.iva_basica) : null,
                iva_minima: form.iva_minima ? parseFloat(form.iva_minima) : null,
                discounts: form.discounts ? parseFloat(form.discounts) : null,
                exempt: form.exempt ? parseFloat(form.exempt) : null,
                items,
            };
            const res = await fetch('/api/logistica/ordenes', { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) { await fetchOrders(); closeModal(); }
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar esta orden?')) return;
        await fetch(`/api/logistica/ordenes/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        setOrders(prev => prev.filter(o => o.id !== id));
    };

    const handleStatusChange = async (id: number, status: string) => {
        const res = await fetch(`/api/logistica/ordenes/${id}`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        if (res.ok) { const updated = await res.json(); setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o)); }
    };

    const handleStatusSelectChange = async (orderId: number, newStatus: string) => {
        if (newStatus === 'partial_received') {
            const order = orders.find(o => o.id === orderId);
            let orderItems = order?.items;
            if (!orderItems?.length) {
                const res = await fetch(`/api/logistica/ordenes/${orderId}`, { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    orderItems = data.items;
                    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: data.items } : o));
                }
            }
            if (orderItems?.length) {
                setReceivedQtys({});
                setPartialReceiveModal({ orderId, items: orderItems });
            } else {
                handleStatusChange(orderId, newStatus);
            }
        } else {
            handleStatusChange(orderId, newStatus);
        }
    };

    const handlePartialReceiveConfirm = async () => {
        if (!partialReceiveModal) return;
        const receivedItems = partialReceiveModal.items.map((item, idx) => ({
            article: item.article,
            quantity_ordered: item.quantity,
            quantity_received: parseInt(receivedQtys[idx] || '0') || 0,
        }));
        const res = await fetch(`/api/logistica/ordenes/${partialReceiveModal.orderId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'partial_received', received_items: JSON.stringify(receivedItems) }),
        });
        if (res.ok) {
            const updated = await res.json();
            setOrders(prev => prev.map(o => o.id === partialReceiveModal.orderId ? { ...o, ...updated } : o));
        }
        setPartialReceiveModal(null);
    };

    const handleExport = async () => {
        const p = new URLSearchParams();
        if (statusFilter) p.set('status', statusFilter);
        if (dateFrom) p.set('dateFrom', dateFrom);
        if (dateTo) p.set('dateTo', dateTo);
        const res = await fetch(`/api/logistica/ordenes/export?${p.toString()}`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'ordenes-compra.xlsx'; a.click();
        URL.revokeObjectURL(url);
    };

    const toggleExpand = async (order: PurchaseOrder) => {
        if (expandedId === order.id) { setExpandedId(null); return; }
        setExpandedId(order.id);
        if (!order.items) {
            const res = await fetch(`/api/logistica/ordenes/${order.id}`, { headers: getAuthHeaders() });
            if (res.ok) { const data = await res.json(); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, items: data.items } : o)); }
        }
    };

    if (loading || !currentUser) return null;

    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', boxSizing: 'border-box' };
    const labelStyle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/logistica" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Logística
                </Link>
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main className="standalone-page" style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '0.5rem 1rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                {/* Title + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Órdenes de Compra</h1>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <Download size={15} /> Excel
                        </button>
                        <button onClick={openModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Plus size={15} /> Nueva orden
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle }} />
                        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={13} /></button>}
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, flex: '1 1 140px', minWidth: '140px' }}>
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobada</option>
                        <option value="paid">Pagada</option>
                        <option value="partial_received">Recibida parcial</option>
                        <option value="received">Recibida total</option>
                        <option value="cancelled">Anulada</option>
                    </select>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, flex: '1 1 130px', minWidth: '130px' }} title="Desde" />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, flex: '1 1 130px', minWidth: '130px' }} title="Hasta" />
                    {(statusFilter || dateFrom || dateTo || search) && (
                        <button onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Limpiar</button>
                    )}
                </div>

                {/* Orders list */}
                {fetching ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando...</div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                        No hay órdenes registradas
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {orders.map(order => (
                            <div key={order.id} style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                {/* Order header row (Mobile adapted) */}
                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}>
                                    
                                    {/* Top section: Title and chevron and Amount (on mobile) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button onClick={() => toggleExpand(order)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex', alignItems: 'center' }}>
                                                    {expandedId === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                    {order.order_number ? `#${order.order_number}` : `Orden #${order.id}`}
                                                </span>
                                                {order.adenda_id && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Ad. {order.adenda_id}</span>}
                                            </div>
                                            
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                {order.rut_emisor && <div>RUT Emi: {order.rut_emisor}</div>}
                                                {order.rut_comprador && <div>RUT Comp: {order.rut_comprador}</div>}
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {order.issue_date && <span>Emi: {order.issue_date}</span>}
                                                    {order.due_date && <span>Vto: {order.due_date}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Amount on Mobile vs Desktop */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                {fmt(order.total_amount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bottom section: Actions and Status */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: '0.75rem', marginTop: isMobile ? '0.5rem' : 0, width: isMobile ? '100%' : 'auto', borderTop: isMobile ? '1px solid var(--border-color)' : 'none', paddingTop: isMobile ? '0.75rem' : 0 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {order.file_url && (
                                                <a href={order.file_url} target="_blank" rel="noopener noreferrer" title="Ver PDF" style={{ color: 'var(--primary-color)', display: 'flex', padding: '0.3rem' }}>
                                                    <FileText size={18} />
                                                </a>
                                            )}
                                            <button onClick={() => handleDelete(order.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e04951', padding: '0.3rem', display: 'flex' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        
                                        <select value={order.status} onChange={e => handleStatusSelectChange(order.id, e.target.value)}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: `${STATUS_COLORS[order.status]}15`, color: STATUS_COLORS[order.status], fontWeight: 600, cursor: 'pointer', maxWidth: '180px', flex: 1 }}>
                                            <option value="pending" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Pendiente</option>
                                            <option value="approved" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Aprobada</option>
                                            <option value="paid" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Pagada</option>
                                            <option value="partial_received" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Recibida parcial</option>
                                            <option value="received" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Recibida total</option>
                                            <option value="cancelled" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>Anulada</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Expanded items */}
                                {expandedId === order.id && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1rem' }}>
                                        {(() => {
                                            const parsedReceived = order.received_items ? JSON.parse(order.received_items) : null;
                                            return order.items?.length ? (
                                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -1rem' }}>
                                                <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                                            {['Cant.', 'Artículo', 'P. Unit.', 'Desc.', 'Subtotal', ...(parsedReceived ? ['Recibido'] : [])].map(h => (
                                                                <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.items.map((item, i) => {
                                                            const recvItem = parsedReceived?.find((r: any) => r.article === item.article);
                                                            return (
                                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{item.quantity}</td>
                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{item.article}</td>
                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{fmt(item.unit_price)}</td>
                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{item.discount || 0}</td>
                                                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                                                                {parsedReceived && (
                                                                    <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: recvItem && recvItem.quantity_received < recvItem.quantity_ordered ? '#f59e0b' : '#22c55e' }}>
                                                                        {recvItem ? `${recvItem.quantity_received} / ${recvItem.quantity_ordered}` : '-'}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            ) : <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', margin: 0 }}>Sin artículos registrados</p>;
                                        })()}

                                        {/* Totals summary */}
                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            {order.neto_basica != null && <span>Neto básica: <b>{fmt(order.neto_basica)}</b></span>}
                                            {order.iva_basica != null && <span>IVA básica: <b>{fmt(order.iva_basica)}</b></span>}
                                            {order.neto_minima != null && <span>Neto mínima: <b>{fmt(order.neto_minima)}</b></span>}
                                            {order.iva_minima != null && <span>IVA mínima: <b>{fmt(order.iva_minima)}</b></span>}
                                            {order.discounts != null && <span>Descuentos: <b>{fmt(order.discounts)}</b></span>}
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Total: {fmt(order.total_amount)}</span>
                                        </div>
                                        {order.notes && <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Nota: {order.notes}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem', overflowY: 'auto' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: '680px', marginTop: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Nueva Orden de Compra</h2>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>

                        {/* PDF Upload */}
                        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '2px dashed var(--border-color)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', fontWeight: 600 }}>📄 Subir PDF para auto-completar</p>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: parsing || parsing ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: parsing || parsing ? 0.7 : 1 }}>
                                <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} disabled={parsing || parsing} />
                                {parsing ? '⏳ Analizando PDF...' : parsing ? '⏫ Subiendo...' : '📂 Seleccionar PDF'}
                            </label>
                            {parsedRawText && <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.5rem', marginBottom: 0 }}>✓ Datos extraídos del PDF</p>}
                        </div>

                        {/* Form grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                            {[
                                { label: 'ID Compra', key: 'order_number' }, { label: 'Adenda ID', key: 'adenda_id' },
                                { label: 'RUT Emisor', key: 'rut_emisor' }, { label: 'RUT Comprador', key: 'rut_comprador' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={labelStyle}>{f.label}</label>
                                    <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Nombre del comprador</label>
                                <input value={form.buyer_name} onChange={e => setForm(p => ({ ...p, buyer_name: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Fecha Emisión *</label>
                                <input type="date" value={form.issue_date} onChange={e => { setForm(p => ({ ...p, issue_date: e.target.value })); setFormErrors(p => ({ ...p, issue_date: '' })); }} style={{ ...inputStyle, borderColor: formErrors.issue_date ? '#e04951' : undefined }} />
                                {formErrors.issue_date && <span style={{ fontSize: '0.75rem', color: '#e04951' }}>{formErrors.issue_date}</span>}
                            </div>
                            <div>
                                <label style={labelStyle}>Fecha Vencimiento</label>
                                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
                            </div>
                        </div>

                        {/* Totals */}
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '1rem 0 0.5rem' }}>Totales</p>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                            {[
                                { label: 'Neto tasa básica', key: 'neto_basica' }, { label: 'Neto tasa mínima', key: 'neto_minima' },
                                { label: 'IVA tasa básica', key: 'iva_basica' }, { label: 'IVA tasa mínima', key: 'iva_minima' },
                                { label: 'Descuentos', key: 'discounts' }, { label: 'Exento', key: 'exempt' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={labelStyle}>{f.label}</label>
                                    <input type="number" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelStyle}>Total *</label>
                                <input type="number" value={form.total_amount} onChange={e => { setForm(p => ({ ...p, total_amount: e.target.value })); setFormErrors(p => ({ ...p, total_amount: '' })); }} style={{ ...inputStyle, borderColor: formErrors.total_amount ? '#e04951' : undefined }} />
                                {formErrors.total_amount && <span style={{ fontSize: '0.75rem', color: '#e04951' }}>{formErrors.total_amount}</span>}
                            </div>
                        </div>

                        {/* Items */}
                        {items.length > 0 && (
                            <>
                                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '1rem 0 0.5rem' }}>Artículos ({items.length})</p>
                                <div style={{ maxHeight: '180px', overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                    <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-color)', position: 'sticky', top: 0 }}>
                                                {['Cant.', 'Artículo', 'P.Unit.', 'Subtotal', ''].map(h => <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.35rem 0.6rem' }}>{item.quantity}</td>
                                                    <td style={{ padding: '0.35rem 0.6rem' }}>{item.article}</td>
                                                    <td style={{ padding: '0.35rem 0.6rem' }}>{item.unit_price != null ? `$${item.unit_price}` : '-'}</td>
                                                    <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{item.subtotal != null ? `$${item.subtotal}` : '-'}</td>
                                                    <td style={{ padding: '0.35rem 0.6rem' }}>
                                                        <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e04951' }}><X size={13} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Notes */}
                        <div style={{ marginTop: '0.75rem' }}>
                            <label style={labelStyle}>Notas (opcional)</label>
                            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button onClick={closeModal} style={{ padding: '0.55rem 1.2rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--surface-color)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cancelar</button>
                            <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.4rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: saving ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                                {saving ? 'Guardando...' : 'Guardar orden'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightboxUrl && (
                <div onClick={() => setLightboxUrl('')} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightboxUrl} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} />
                </div>
            )}

            {partialReceiveModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Recepción Parcial</h2>
                            <button onClick={() => setPartialReceiveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Indica la cantidad recibida por cada artículo:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {partialReceiveModal.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.article}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pedido: {item.quantity}</div>
                                    </div>
                                    <input 
                                        type="number" 
                                        value={receivedQtys[idx] || ''} 
                                        onChange={e => setReceivedQtys(prev => ({ ...prev, [idx]: e.target.value }))}
                                        placeholder="0"
                                        style={{ width: '80px', padding: '0.4rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setPartialReceiveModal(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
                            <button onClick={handlePartialReceiveConfirm} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
