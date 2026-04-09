'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, ExternalLink, Trash2, LogOut, Search, X, MessageSquare, Download } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface Shipment {
    id: number;
    tracking_number: string | null;
    recipient: string;
    destination: string;
    date_sent: string;
    status: 'pending' | 'in_transit' | 'delivered' | 'issue';
    weight: number | null;
    declared_value: number | null;
    description: string | null;
    notes: string | null;
    invoice_image_url: string | null;
    created_by: string | null;
    created_at: string;
}

interface Comment {
    id: number;
    shipment_id: number;
    user_name: string;
    comment: string;
    created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    in_transit: 'En tránsito',
    delivered: 'Entregado',
    issue: 'Con problema',
};
const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    in_transit: '#3b82f6',
    delivered: '#22c55e',
    issue: '#e04951',
};

const DAC_SITE = 'https://www.dac.com.uy';
const dacTrackingUrl = (tracking: string) => `https://www.dac.com.uy/envios/rastreo/Codigo_Rastreo/${tracking}`;

const EMPTY_FORM = { tracking_number: '', recipient: '', destination: '', date_sent: '', weight: '', declared_value: '', description: '', notes: '' };

export default function EnviosDACPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [fetching, setFetching] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [invoiceUrl, setInvoiceUrl] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState('');
    const [editingStatus, setEditingStatus] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
    const [editingDetail, setEditingDetail] = useState(false);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [editSaving, setEditSaving] = useState(false);
    const [openComments, setOpenComments] = useState<number | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [exporting, setExporting] = useState(false);
    const isFirstRender = useRef(true);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    const buildUrl = (s: string, q: string, df: string, dt: string) => {
        const p = new URLSearchParams();
        if (s) p.set('status', s);
        if (q) p.set('search', q);
        if (df) p.set('dateFrom', df);
        if (dt) p.set('dateTo', dt);
        return `/api/logistica/shipments${p.toString() ? '?' + p.toString() : ''}`;
    };

    const fetchShipments = async (s = statusFilter, q = search, df = dateFrom, dt = dateTo) => {
        setFetching(true);
        try {
            const res = await fetch(buildUrl(s, q, df, dt), { headers: getAuthHeaders() });
            const data = await res.json();
            setShipments(Array.isArray(data) ? data : []);
        } catch { setShipments([]); }
        finally { setFetching(false); }
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'logistica') { router.push('/'); return; }
        fetchShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, isAuthenticated, currentUser]);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        const t = setTimeout(() => fetchShipments(statusFilter, search, dateFrom, dateTo), 300);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, search, dateFrom, dateTo]);

    const fetchComments = async (shipmentId: number) => {
        setLoadingComments(true);
        try {
            const res = await fetch(`/api/logistica/shipments/${shipmentId}/comments`, { headers: getAuthHeaders() });
            const data = await res.json();
            setComments(Array.isArray(data) ? data : []);
        } catch { setComments([]); }
        finally { setLoadingComments(false); }
    };

    const toggleComments = (id: number) => {
        if (openComments === id) { setOpenComments(null); setComments([]); setCommentText(''); return; }
        setOpenComments(id);
        setCommentText('');
        fetchComments(id);
    };

    const handleAddComment = async (shipmentId: number) => {
        if (!commentText.trim()) return;
        setSavingComment(true);
        try {
            const res = await fetch(`/api/logistica/shipments/${shipmentId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ comment: commentText.trim() }),
            });
            if (res.ok) {
                setCommentText('');
                fetchComments(shipmentId);
            }
        } finally { setSavingComment(false); }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const p = new URLSearchParams();
            if (statusFilter) p.set('status', statusFilter);
            if (dateFrom) p.set('dateFrom', dateFrom);
            if (dateTo) p.set('dateTo', dateTo);
            const url = `/api/logistica/shipments/export${p.toString() ? '?' + p.toString() : ''}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `envios-dac-${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(a.href);
        } finally { setExporting(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/api/logistica/shipments/upload', { method: 'POST', headers: getAuthHeaders(), body: fd });
            const data = await res.json();
            if (data.url) setInvoiceUrl(data.url);
        } finally { setUploadingImage(false); }
        e.target.value = '';
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};
        if (!form.recipient.trim()) errors.recipient = 'El destinatario es obligatorio';
        if (!form.destination.trim()) errors.destination = 'El destino es obligatorio';
        if (!form.date_sent) errors.date_sent = 'La fecha de envío es obligatoria';
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});
        setSaving(true);
        try {
            const res = await fetch('/api/logistica/shipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    ...form,
                    weight: form.weight ? parseFloat(form.weight) : null,
                    declared_value: form.declared_value ? parseFloat(form.declared_value) : null,
                    invoice_image_url: invoiceUrl || null,
                }),
            });
            if (res.ok) {
                setShowModal(false);
                setForm(EMPTY_FORM);
                setInvoiceUrl('');
                fetchShipments();
            }
        } finally { setSaving(false); }
    };

    const handleStatusChange = async (id: number, status: string) => {
        setEditingStatus(null);
        await fetch(`/api/logistica/shipments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ status }),
        });
        fetchShipments();
    };

    const handleDelete = async (id: number) => {
        await fetch(`/api/logistica/shipments/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        setConfirmDelete(null);
        setDetailShipment(null);
        setEditingDetail(false);
        fetchShipments();
    };

    const openDetail = (s: Shipment) => {
        setDetailShipment(s);
        setEditingDetail(false);
        setEditForm({
            tracking_number: s.tracking_number || '',
            recipient: s.recipient,
            destination: s.destination,
            date_sent: s.date_sent,
            weight: s.weight != null ? String(s.weight) : '',
            declared_value: s.declared_value != null ? String(s.declared_value) : '',
            description: s.description || '',
            notes: s.notes || '',
        });
    };

    const handleEditSave = async () => {
        if (!detailShipment) return;
        setEditSaving(true);
        try {
            const body: any = {
                ...editForm,
                weight: editForm.weight ? parseFloat(editForm.weight) : null,
                declared_value: editForm.declared_value ? parseFloat(editForm.declared_value) : null,
            };
            const res = await fetch(`/api/logistica/shipments/${detailShipment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setDetailShipment(null);
                setEditingDetail(false);
                fetchShipments();
            }
        } finally { setEditSaving(false); }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading || !currentUser) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <Link href="/logistica" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Logística
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main style={{ flex: 1, padding: isMobile ? '0.5rem 1rem' : '1.5rem', maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                {/* Title + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Envíos al Interior</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.75rem', backgroundColor: 'var(--surface-color)', cursor: 'pointer', opacity: exporting ? 0.6 : 1 }}
                        >
                            <Download size={13} /> {exporting ? 'Exportando...' : 'Excel'}
                        </button>
                        <a href={DAC_SITE} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)', textDecoration: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.75rem', backgroundColor: 'var(--surface-color)' }}>
                            <ExternalLink size={13} /> Sitio DAC
                        </a>
                        <button
                            onClick={() => setShowModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.45rem 0.9rem', backgroundColor: 'var(--primary-color)', cursor: 'pointer' }}
                        >
                            <Plus size={14} /> Nuevo Envío
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Desde</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                style={{ fontSize: '0.82rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.6rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Hasta</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                style={{ fontSize: '0.82rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.6rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            style={{ fontSize: '0.82rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.45rem 0.6rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            <option value="">Todos los estados</option>
                            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            style={{ width: '100%', padding: '0.45rem 2rem 0.45rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                {/* Shipments list */}
                {fetching ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <div style={{ width: '28px', height: '28px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : shipments.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        {statusFilter || search || dateFrom || dateTo ? 'No hay envíos con esos filtros.' : 'No hay envíos registrados. ¡Creá el primero!'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {shipments.map(s => (
                            <div key={s.id} className="card" style={{ padding: '1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow 0.2s' }} onClick={() => openDetail(s)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {/* Left: main info */}
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.recipient}</span>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_COLORS[s.status], backgroundColor: `${STATUS_COLORS[s.status]}20`, borderRadius: '4px', padding: '0.15rem 0.45rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                onClick={() => setEditingStatus(editingStatus === s.id ? null : s.id)}>
                                                {STATUS_LABELS[s.status]} ▾
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <span>📍 {s.destination}</span>
                                            <span>📅 {s.date_sent}</span>
                                            {s.tracking_number && <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 500 }}>#{s.tracking_number}</span>}
                                        </div>
                                        {s.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>{s.description}</p>}
                                        {s.notes && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', fontStyle: 'italic' }}>{s.notes}</p>}
                                        {s.invoice_image_url && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={s.invoice_image_url} alt="Factura" onClick={() => setLightboxUrl(s.invoice_image_url!)} style={{ marginTop: '0.5rem', height: '56px', width: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover', display: 'block' }} />
                                        )}
                                    </div>

                                    {/* Right: extra data + actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                            <button onClick={() => toggleComments(s.id)} title="Ver actualizaciones"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: openComments === s.id ? 'var(--primary-color)' : 'var(--text-secondary)', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                                <MessageSquare size={12} />
                                            </button>
                                            {s.tracking_number && (
                                                <a href={dacTrackingUrl(s.tracking_number)} target="_blank" rel="noopener noreferrer" title={`Rastrear ${s.tracking_number} en DAC`}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary-color)', textDecoration: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem' }}>
                                                    <ExternalLink size={11} /> Rastrear
                                                </a>
                                            )}
                                        </div>
                                        {s.weight != null && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.weight} kg</span>}
                                        {s.declared_value != null && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${Number(s.declared_value).toLocaleString('es-UY')}</span>}
                                    </div>
                                </div>

                                {/* Inline status selector */}
                                {editingStatus === s.id && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                                            <button key={v} onClick={() => handleStatusChange(s.id, v)}
                                                style={{ fontSize: '0.75rem', fontWeight: 600, color: v === s.status ? 'white' : STATUS_COLORS[v], backgroundColor: v === s.status ? STATUS_COLORS[v] : `${STATUS_COLORS[v]}18`, border: `1px solid ${STATUS_COLORS[v]}`, borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}>
                                                {l}
                                            </button>
                                        ))}
                                        <button onClick={() => setEditingStatus(null)} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                            <X size={11} />
                                        </button>
                                    </div>
                                )}

                                {/* Comments panel */}
                                {openComments === s.id && (
                                    <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                                        {loadingComments ? (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cargando...</p>
                                        ) : (
                                            <>
                                                {comments.length === 0 ? (
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>Sin actualizaciones todavía.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                                                        {comments.map(c => (
                                                            <div key={c.id} style={{ display: 'flex', gap: '0.6rem' }}>
                                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                                    {c.user_name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.15rem' }}>
                                                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.user_name}</span>
                                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatDate(c.created_at)}</span>
                                                                    </div>
                                                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{c.comment}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        value={commentText}
                                                        onChange={e => setCommentText(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(s.id); } }}
                                                        placeholder="Agregar actualización..."
                                                        style={{ flex: 1, padding: '0.45rem 0.7rem', fontSize: '0.83rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                                    />
                                                    <button
                                                        onClick={() => handleAddComment(s.id)}
                                                        disabled={savingComment || !commentText.trim()}
                                                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', opacity: (savingComment || !commentText.trim()) ? 0.6 : 1 }}
                                                    >
                                                        Enviar
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* New Shipment Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Nuevo Envío DAC</h2>
                            <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormErrors({}); setInvoiceUrl(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {[
                                { label: 'Destinatario', key: 'recipient', placeholder: 'Nombre completo', required: true },
                                { label: 'Destino', key: 'destination', placeholder: 'Ciudad / Departamento', required: true },
                                { label: 'Fecha de envío', key: 'date_sent', type: 'date', required: true },
                                { label: 'Número de seguimiento', key: 'tracking_number', placeholder: 'Ej: DAC-123456' },
                                { label: 'Descripción del paquete', key: 'description', placeholder: 'Contenido, tipo de envío...' },
                                { label: 'Peso (kg)', key: 'weight', type: 'number', placeholder: '0.5' },
                                { label: 'Valor declarado ($)', key: 'declared_value', type: 'number', placeholder: '0' },
                                { label: 'Notas internas', key: 'notes', placeholder: 'Observaciones...', optional: true },
                            ].map(({ label, key, type = 'text', placeholder, required, optional }: any) => (
                                <div key={key}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                                        {label}
                                        {required && <span style={{ color: '#e04951', marginLeft: '0.2rem' }}>*</span>}
                                        {optional && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.3rem', fontSize: '0.75rem' }}>(opcional)</span>}
                                    </label>
                                    <input
                                        type={type}
                                        value={(form as any)[key]}
                                        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); if (formErrors[key]) setFormErrors(fe => { const n = { ...fe }; delete n[key]; return n; }); }}
                                        placeholder={placeholder}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.88rem', border: `1px solid ${formErrors[key] ? '#e04951' : 'var(--border-color)'}`, borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                    />
                                    {formErrors[key] && <p style={{ color: '#e04951', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{formErrors[key]}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Invoice image */}
                        <div style={{ marginTop: '0.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                                Factura <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.75rem' }}>(opcional)</span>
                            </label>
                            {invoiceUrl ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={invoiceUrl} alt="Factura" onClick={() => setLightboxUrl(invoiceUrl)} style={{ height: '72px', width: 'auto', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover' }} />
                                    <button onClick={() => setInvoiceUrl('')} style={{ fontSize: '0.78rem', color: '#e04951', background: 'none', border: 'none', cursor: 'pointer' }}>Quitar imagen</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--primary-color)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: uploadingImage ? 'default' : 'pointer', opacity: uploadingImage ? 0.6 : 1 }}>
                                        <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
                                        📷 Cámara
                                    </label>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: uploadingImage ? 'default' : 'pointer', opacity: uploadingImage ? 0.6 : 1 }}>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
                                        🖼 Galería
                                    </label>
                                    {uploadingImage && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>Subiendo...</span>}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                            <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormErrors({}); setInvoiceUrl(''); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                            >
                                {saving ? 'Guardando...' : 'Guardar envío'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>

            {/* Detail / Edit Modal */}
            {detailShipment && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150, padding: '1rem' }} onClick={() => { setDetailShipment(null); setEditingDetail(false); }}>
                    <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                {editingDetail ? 'Editar Envío' : 'Detalle del Envío'}
                            </h2>
                            <button onClick={() => { setDetailShipment(null); setEditingDetail(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        {editingDetail ? (
                            /* Edit mode */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {[
                                    { label: 'Destinatario', key: 'recipient' },
                                    { label: 'Destino', key: 'destination' },
                                    { label: 'Fecha de envío', key: 'date_sent', type: 'date' },
                                    { label: 'Número de seguimiento', key: 'tracking_number' },
                                    { label: 'Descripción', key: 'description' },
                                    { label: 'Peso (kg)', key: 'weight', type: 'number' },
                                    { label: 'Valor declarado ($)', key: 'declared_value', type: 'number' },
                                    { label: 'Notas', key: 'notes' },
                                ].map(({ label, key, type = 'text' }: any) => (
                                    <div key={key}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>{label}</label>
                                        <input
                                            type={type}
                                            value={(editForm as any)[key]}
                                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.88rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button onClick={() => setEditingDetail(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
                                    <button onClick={handleEditSave} disabled={editSaving} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                                        {editSaving ? 'Guardando...' : 'Guardar cambios'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* View mode */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{detailShipment.recipient}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: STATUS_COLORS[detailShipment.status], backgroundColor: `${STATUS_COLORS[detailShipment.status]}20`, borderRadius: '4px', padding: '0.15rem 0.45rem' }}>
                                        {STATUS_LABELS[detailShipment.status]}
                                    </span>
                                </div>

                                {[
                                    { label: 'Destino', value: detailShipment.destination },
                                    { label: 'Fecha de envío', value: detailShipment.date_sent },
                                    { label: 'Tracking', value: detailShipment.tracking_number },
                                    { label: 'Descripción', value: detailShipment.description },
                                    { label: 'Peso', value: detailShipment.weight != null ? `${detailShipment.weight} kg` : null },
                                    { label: 'Valor declarado', value: detailShipment.declared_value != null ? `$${Number(detailShipment.declared_value).toLocaleString('es-UY')}` : null },
                                    { label: 'Notas', value: detailShipment.notes },
                                    { label: 'Creado por', value: detailShipment.created_by },
                                    { label: 'Creado', value: detailShipment.created_at ? formatDate(detailShipment.created_at) : null },
                                ].filter(r => r.value).map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: '110px' }}>{label}:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                                    </div>
                                ))}

                                {detailShipment.tracking_number && (
                                    <a href={dacTrackingUrl(detailShipment.tracking_number)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--primary-color)', textDecoration: 'none', marginTop: '0.25rem' }}>
                                        <ExternalLink size={14} /> Rastrear en DAC
                                    </a>
                                )}

                                {detailShipment.invoice_image_url && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Factura:</span>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={detailShipment.invoice_image_url} alt="Factura" onClick={() => setLightboxUrl(detailShipment.invoice_image_url!)} style={{ display: 'block', marginTop: '0.4rem', height: '80px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover' }} />
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                    <button onClick={() => { if (confirm('¿Eliminar este envío?')) handleDelete(detailShipment.id); }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', border: '1px solid #e04951', borderRadius: 'var(--radius)', backgroundColor: 'transparent', color: '#e04951', cursor: 'pointer' }}>
                                        <Trash2 size={14} /> Eliminar
                                    </button>
                                    <button onClick={() => setEditingDetail(true)} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                        Editar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Image lightbox */}
            {lightboxUrl && (
                <div onClick={() => setLightboxUrl('')} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'zoom-out', padding: '1rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightboxUrl} alt="Factura" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}
