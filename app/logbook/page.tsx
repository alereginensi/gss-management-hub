'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
// exceljs imported dynamically to save bundle size
import type * as ExcelJS from 'exceljs';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
    BookOpen,
    Plus,
    Download,
    Layout,
    X,
    Calendar,
    ClipboardList,
    Trash2,
    Pencil,
    Save,
    Search,
    Filter,
    ChevronDown,
    Camera,
    ImageIcon,
    Clock,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';

interface Column {
    id: number;
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
    options: string[];
}

interface LogEntry {
    id: number;
    date: string;
    time: string;
    sector: string;
    supervisor: string;
    location: string;
    incident: string;
    report: string;
    staff_member: string;
    uniform: string;
    supervised_by: string;
    extra_data: Record<string, any>;
    images: string[];
}

interface ReportItem {
    sector: string;
    staff_member: string;
    uniform: string;
    incident: string;
    report: string;
    time: string;
    images: string[];
    extra_data: Record<string, any>;
}

const SUPERVISO_OPTIONS = ['Limpieza', 'Seguridad Física', 'Seguridad Electrónica', 'Tercerizados', 'Administrativos'];
const UNIFORMS = ['Completo', 'Parcial', 'Sin Uniforme', 'Otro'];

const INCIDENT_CATEGORIES = [
    'Operativa',
    'Calidad',
    'Incidentes & Seguridad',
    'Recursos Humanos',
    'Materiales, Insumos & Equipos',
    'Infraestructura',
    'Comunicación & Coordinación',
    'Otros'
];

const SERVICE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; light: string; argb: string }> = {
    'Limpieza': { bg: 'rgba(14,165,233,0.07)', border: '#0ea5e9', text: '#0284c7', light: 'rgba(14,165,233,0.15)', argb: 'FFE0F2FE' },
    'Seguridad Física': { bg: 'rgba(245,158,11,0.07)', border: '#f59e0b', text: '#d97706', light: 'rgba(245,158,11,0.15)', argb: 'FFFEF3C7' },
    'Seguridad Electrónica': { bg: 'rgba(139,92,246,0.07)', border: '#8b5cf6', text: '#7c3aed', light: 'rgba(139,92,246,0.15)', argb: 'FFF5F3FF' },
    'Tercerizados': { bg: 'rgba(249,115,22,0.07)', border: '#f97316', text: '#ea580c', light: 'rgba(249,115,22,0.15)', argb: 'FFFFF7ED' },
    'Administrativos': { bg: 'rgba(100,116,139,0.07)', border: '#64748b', text: '#475569', light: 'rgba(100,116,139,0.15)', argb: 'FFF1F5F9' },
};

function SearchableSelect({ options, value, onChange, placeholder, style, inputStyle }: {
    options: string[];
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    inputStyle?: React.CSSProperties;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = query
        ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
        : options;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 180) });
        }
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%', minWidth: '130px', ...style }}>
            <input
                type="text"
                className="input"
                value={open ? query : value}
                onChange={e => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => { setOpen(true); setQuery(''); }}
                placeholder={placeholder || 'Buscar...'}
                autoComplete="off"
                style={{ width: '100%', paddingRight: '1.5rem', cursor: 'text', ...inputStyle }}
            />
            <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.35, fontSize: '0.65rem' }}>▼</span>
            {open && dropdownPos && (
                <div style={{
                    position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
                    background: 'var(--surface-color, white)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    zIndex: 9999, maxHeight: '240px', overflowY: 'auto'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', opacity: 0.5 }}>Sin resultados</div>
                    ) : filtered.map(opt => (
                        <div
                            key={opt}
                            onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); setQuery(''); }}
                            style={{
                                padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                                backgroundColor: opt === value ? 'rgba(59,130,246,0.1)' : undefined,
                                fontWeight: opt === value ? 600 : 400
                            }}
                            onMouseEnter={e => { if (opt !== value) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = opt === value ? 'rgba(59,130,246,0.1)' : ''; }}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Image Uploader Component ──────────────────────────────────────────────
function ImageUploader({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
    const [uploading, setUploading] = useState(false);
    const [lightbox, setLightbox] = useState<string | null>(null);
    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const newUrls: string[] = [];
        for (const file of Array.from(files)) {
            const fd = new FormData();
            fd.append('file', file);
            try {
                const res = await fetch('/api/logbook/images', { method: 'POST', body: fd });
                if (res.ok) {
                    const data = await res.json();
                    newUrls.push(data.url);
                } else {
                    const d = await res.json();
                    alert(d.error || 'Error al subir imagen');
                }
            } catch { alert('Error de conexión al subir imagen'); }
        }
        if (newUrls.length) onChange([...images, ...newUrls]);
        setUploading(false);
    };

    const removeImage = async (url: string) => {
        await fetch(`/api/logbook/images?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
        onChange(images.filter(u => u !== url));
    };

    return (
        <div>
            {/* Thumbnails */}
            {images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {images.map(url => (
                        <div key={url} style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                            <img
                                src={url}
                                alt="foto"
                                onClick={() => setLightbox(url)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(url)}
                                style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >×</button>
                        </div>
                    ))}
                </div>
            )}
            {/* Hidden file inputs */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
            />

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.5rem', opacity: uploading ? 0.6 : 1 }}
                >
                    <Camera size={14} />
                    {uploading ? '...' : 'Cámara'}
                </button>
                <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.5rem', opacity: uploading ? 0.6 : 1 }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    {uploading ? '...' : 'Galería'}
                </button>
            </div>
            {images.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'center' }}>
                    {images.length} adjunta{images.length > 1 ? 's' : ''}
                </div>
            )}
            {/* Lightbox */}
            {lightbox && (
                <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <img src={lightbox} alt="vista ampliada" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} />
                    <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}>×</button>
                </div>
            )}
        </div>
    );
}


export default function LogbookPage() {
    const { isSidebarOpen, currentUser } = useTicketContext();
    const isAdmin = currentUser?.role === 'admin';
    const [logbookStats, setLogbookStats] = useState<{ total: number; first: { date: string; time: string } | null; last: { date: string; time: string } | null } | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const fetchLogbookStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch('/api/logbook/debug');
            if (res.ok) setLogbookStats(await res.json());
        } catch { /* silent */ }
        finally { setStatsLoading(false); }
    };
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [columns, setColumns] = useState<Column[]>([]);
    const [loading, setLoading] = useState(true);
    const [funcionarios, setFuncionarios] = useState<string[]>([]);
    const [supervisores, setSupervisores] = useState<{ name: string, rubro: string }[]>([]);
    const [clientSectorMap, setClientSectorMap] = useState<Record<string, string[]>>({});

    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    // Modals
    const [showReportModal, setShowReportModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<LogEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<LogEntry>>({});

    const getSectorsForLocation = (clientName: string): string[] => {
        if (!clientName) return [];
        const sectors = clientSectorMap[clientName];
        if (!sectors || sectors.length === 0) return ['Sector Único'];
        return sectors;
    };

    const availableLocations = Object.keys(clientSectorMap).sort();

    // Date Filter State - defaults to today so only today's records load initially
    const todayStr = new Date().toISOString().slice(0, 10);
    const [dateFilter, setDateFilter] = useState<string>(todayStr);
    const [dateFilterTo, setDateFilterTo] = useState<string>(todayStr);
    const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const mobileFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showFilters) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const outsideDesktop = !filterRef.current || !filterRef.current.contains(target);
            const outsideMobile = !mobileFilterRef.current || !mobileFilterRef.current.contains(target);
            if (outsideDesktop && outsideMobile) setShowFilters(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFilters]);

    // Apply keyword search across entries returned by the server (already filtered by date/serviceType/role)
    const visibleEntries = entries;

    // Apply keyword search across all text fields
    const searchFilteredEntries = searchQuery.trim()
        ? visibleEntries.filter(e => {
            const q = searchQuery.toLowerCase();
            const fields = [e.location, e.sector, e.supervisor, e.staff_member, e.incident, e.report, e.supervised_by,
            ...Object.values(e.extra_data || {}).map(String)];
            return fields.some(v => v?.toLowerCase().includes(q));
        })
        : visibleEntries;

    // Helper: current time as HH:MM
    const getCurrentTime = () => new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Form States
    const [newReportHeader, setNewReportHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        time: getCurrentTime(),
        location: '',
        sector: '',
        supervised_by: SUPERVISO_OPTIONS[0],
        supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
    });

    const [reportItems, setReportItems] = useState<ReportItem[]>([
        {
            sector: '',
            staff_member: '',
            uniform: UNIFORMS[0],
            incident: '',
            report: '',
            time: getCurrentTime(),
            images: [],
            extra_data: {}
        }
    ]);

    const [newColumn, setNewColumn] = useState<Partial<Column>>({
        label: '',
        type: 'text',
        options: []
    });
    const [optionText, setOptionText] = useState('');

    // Inline Add State
    const [inlineData, setInlineData] = useState<Partial<LogEntry>>({
        date: new Date().toISOString().split('T')[0],
        time: getCurrentTime(),
        sector: '',
        location: '',
        supervised_by: SUPERVISO_OPTIONS[0],
        supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
        incident: '',
        report: '',
        staff_member: '',
        uniform: UNIFORMS[0],
        images: [],
        extra_data: {}
    });

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Submit state to prevent duplicates
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic real-time clock for UI display
    const [realTime, setRealTime] = useState(getCurrentTime());
    useEffect(() => {
        const timer = setInterval(() => setRealTime(getCurrentTime()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Mobile Check
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (currentUser?.role === 'supervisor' && currentUser.name) {
            setInlineData(prev => ({ ...prev, supervisor: currentUser.name }));
            setNewReportHeader(prev => ({ ...prev, supervisor: currentUser.name }));
        }
        if (currentUser?.role === 'admin') {
            fetchLogbookStats();
        }
    }, [currentUser]);

    useEffect(() => {
        fetch('/api/config/locations', { headers: getAuthHeaders() })
            .then(r => r.json())
            .then((locs: any[]) => {
                if (!Array.isArray(locs)) return;
                const map: Record<string, string[]> = {};
                locs.forEach(loc => { map[loc.name] = (loc.sectors || []).map((s: any) => s.name); });
                setClientSectorMap(map);
            })
            .catch(console.error);
    }, []);

    const buildLogbookUrl = (params: { dateFrom?: string; dateTo?: string; serviceType?: string; limit?: number }) => {
        const qs = new URLSearchParams();
        if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
        if (params.dateTo) qs.set('dateTo', params.dateTo);
        if (params.serviceType) qs.set('serviceType', params.serviceType);
        if (params.limit !== undefined) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return '/api/logbook' + (str ? '?' + str : '');
    };

    const fetchEntries = async (df: string, dt: string, st: string) => {
        setLoading(true);
        try {
            const url = buildLogbookUrl({ dateFrom: df, dateTo: dt, serviceType: st });
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries);
                setColumns(data.columns);
                setSelectedIds(new Set());
            }
        } catch (error) {
            console.error('Error fetching logbook entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const url = buildLogbookUrl({ dateFrom: dateFilter, dateTo: dateFilterTo, serviceType: serviceTypeFilter });
            const [res, funcRes, supRes] = await Promise.all([
                fetch(url, { headers: getAuthHeaders() }),
                fetch('/api/admin/funcionarios', { headers: getAuthHeaders() }),
                fetch(`/api/admin/users?role=supervisor`, { headers: getAuthHeaders() })
            ]);

            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries);
                setColumns(data.columns);
                setSelectedIds(new Set());
            }
            if (funcRes.ok) {
                const funcs = await funcRes.json();
                setFuncionarios(funcs.map((f: any) => f.name));
            }
            if (supRes.ok) {
                const sups = await supRes.json();
                setSupervisores(sups.map((u: any) => ({ name: u.name, rubro: u.rubro })));
            }
        } catch (error) {
            console.error('Error fetching logbook:', error);
        } finally {
            setLoading(false);
        }
    };

    const isFirstRender = useRef(true);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        fetchEntries(dateFilter, dateFilterTo, serviceTypeFilter);
    }, [dateFilter, dateFilterTo, serviceTypeFilter]);

    const handleUpdateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReport) return;

        try {
            const res = await fetch('/api/logbook', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...selectedReport, ...editData, id: selectedReport.id })
            });

            if (res.ok) {
                setIsEditing(false);
                setSelectedReport({ ...selectedReport, ...editData } as LogEntry);
                fetchData();
            } else {
                alert('Error al actualizar el reporte');
            }
        } catch (error) {
            console.error('Error updating report:', error);
            alert('Error al actualizar el reporte');
        }
    };

    const handleCreateReport = async (e: React.FormEvent | null, data: any) => {
        if (e) e.preventDefault();

        if (isSubmitting) return;

        let payload;
        if (Array.isArray(data)) {
            // Batch report from modal
            const supervisorName = currentUser?.role === 'supervisor' ? currentUser.name : newReportHeader.supervisor;
            if (!supervisorName) {
                alert('Debe seleccionar un Responsable en los Datos Generales.');
                return;
            }
            if (data.some(d => !d.report?.trim())) {
                alert('Completa el campo Reporte en todos los ítems.');
                return;
            }
            const missingBatchFields: string[] = [];
            if (!newReportHeader.location) missingBatchFields.push('Cliente');
            if (data.some(d => !d.staff_member)) missingBatchFields.push('Funcionario');
            let processedHeader = { ...newReportHeader };
            let processedItems = data;
            if (missingBatchFields.length > 0) {
                const ok = window.confirm(`Al no completar los siguientes campos: ${missingBatchFields.join(', ')}, se marcarán como "No especificado". ¿Deseas continuar?`);
                if (!ok) return;
                if (!processedHeader.location) processedHeader = { ...processedHeader, location: 'No especificado' };
                processedItems = data.map(item => ({ ...item, staff_member: item.staff_member || 'No especificado' }));
            }
            payload = processedItems.map(item => ({
                ...processedHeader,
                ...item,
                supervisor: supervisorName,
                time: getCurrentTime()
            }));
        } else {
            // Single report from inline add
            payload = [{ ...data, time: getCurrentTime() }];
        }

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/logbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowReportModal(false);
                fetchData();

                // Reset states
                setNewReportHeader({
                    date: new Date().toISOString().split('T')[0],
                    time: getCurrentTime(),
                    location: '',
                    sector: '',
                    supervised_by: SUPERVISO_OPTIONS[0],
                    supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
                });
                setReportItems([{
                    sector: '',
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    incident: '',
                    report: '',
                    time: getCurrentTime(),
                    images: [],
                    extra_data: {}
                }]);

                setInlineData({
                    date: new Date().toISOString().split('T')[0],
                    time: getCurrentTime(),
                    location: '',
                    sector: '',
                    supervised_by: SUPERVISO_OPTIONS[0],
                    supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
                    incident: '',
                    report: '',
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    images: [],
                    extra_data: {}
                });
            } else {
                alert('Error al guardar el reporte');
            }
        } catch (error) {
            console.error('Error creating report:', error);
            alert('Error al crear el reporte');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateColumn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/logbook/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newColumn,
                    name: newColumn.label?.toLowerCase().replace(/\s+/g, '_')
                })
            });
            if (res.ok) {
                setShowColumnModal(false);
                fetchData();
                setNewColumn({ label: '', type: 'text', options: [] });
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (error) {
            console.error('Error creating column:', error);
        }
    };

    const handleDeleteColumn = async (name: string, label: string) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar la columna "${label}"?`)) return;

        try {
            const res = await fetch(`/api/logbook/columns?name=${name}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error deleting column:', error);
        }
    };

    const handleManage = async (action: 'clear_entries' | 'reset_all') => {
        const msg = action === 'clear_entries'
            ? '¿Estás seguro de que quieres borrar todos los datos de la tabla?'
            : '¿Estás seguro de que quieres borrar TODO (datos y columnas) y crear una nueva lista?';

        if (!confirm(msg)) return;

        try {
            const res = await fetch(`/api/logbook/manage?action=${action}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error managing logbook:', error);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Debes seleccionar una o más filas para eliminar');
            return;
        }

        const count = selectedIds.size;
        const msg = count === 1
            ? '¿Estás seguro de que quieres eliminar esta fila?'
            : `¿Estás seguro de que quieres eliminar ${count} filas?`;

        if (!confirm(msg)) return;

        try {
            const idsArray = Array.from(selectedIds);
            const res = await fetch('/api/logbook/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsArray })
            });

            if (res.ok) {
                setSelectedIds(new Set());
                fetchData();
            } else {
                alert('Error al eliminar las filas seleccionadas');
            }
        } catch (error) {
            console.error('Error deleting selected rows:', error);
            alert('Error al eliminar las filas seleccionadas');
        }
    };

    const toggleSelection = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === entries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.map(e => e.id)));
        }
    };

    const exportToExcel = async () => {
        let entriesToExport: LogEntry[];

        if (selectedIds.size > 0) {
            entriesToExport = searchFilteredEntries.filter(e => selectedIds.has(e.id));
        } else {
            // Fetch ALL matching entries from server (no limit) for export
            const url = buildLogbookUrl({ dateFrom: dateFilter, dateTo: dateFilterTo, serviceType: serviceTypeFilter, limit: 0 });
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) { alert('Error al obtener datos para exportar.'); return; }
            const data = await res.json();
            entriesToExport = data.entries.map((e: any) => ({
                ...e,
                extra_data: e.extra_data || {},
                images: e.images || []
            }));
            // Apply client-side search filter if active
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                entriesToExport = entriesToExport.filter(e => {
                    const fields = [e.location, e.sector, e.supervisor, e.staff_member, e.incident, e.report, e.supervised_by,
                        ...Object.values(e.extra_data || {}).map(String)];
                    return fields.some(v => v?.toLowerCase().includes(q));
                });
            }
        }

        if (entriesToExport.length === 0) {
            alert('No hay reportes para exportar con los filtros actuales.');
            return;
        }

        // Sort by date descending (newest first), then sector alphabetically — same as table view
        const sortedEntries = [...entriesToExport].sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (a.sector || '').localeCompare(b.sector || '');
        });

        const Excel = (await import('exceljs')).default;
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Bitácora GSS');

        const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
        const sectorHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FF000000' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const sectorHeaderStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 12, color: { argb: 'FF000000' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            fill: sectorHeaderFill,
            border: {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Columns match the web table order exactly
        const excelCols = [
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Hora', key: 'time', width: 10 },
            { header: 'Tipo de Servicio', key: 'supervised_by', width: 20 },
            { header: 'Responsable', key: 'supervisor', width: 20 },
            { header: 'Cliente', key: 'location', width: 25 },
            { header: 'Sector', key: 'sector', width: 20 },
            { header: 'Funcionario', key: 'staff_member', width: 20 },
            { header: 'Uniforme', key: 'uniform', width: 15 },
            { header: 'Incidencia', key: 'incident', width: 25 },
            { header: 'Reporte', key: 'report', width: 55 },
        ] as any[];

        columns.forEach(col => {
            excelCols.push({ header: col.label, key: col.name, width: 20 });
        });

        worksheet.columns = excelCols;

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell, colNumber) => {
            cell.style = headerStyle;
            if (colNumber === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } };
            else cell.fill = greenFill;
        });

        let currentSector = '';
        sortedEntries.forEach((entry, index) => {
            const isNewSector = entry.sector !== currentSector;
            if (isNewSector) currentSector = entry.sector;

            const rowData: any = {
                id: entry.id,
                date: entry.date,
                time: entry.time, // Fix: Include time in export
                supervised_by: entry.supervised_by,
                supervisor: entry.supervisor,
                sector: entry.sector,
                location: entry.location,
                staff_member: entry.staff_member,
                uniform: entry.uniform,
                incident: entry.incident,
                report: entry.report,
                ...entry.extra_data
            };
            const row = worksheet.addRow(rowData);

            // Apply sector color to the row
            row.eachCell(cell => {
                cell.border = {
                    top: { style: isNewSector ? 'medium' : 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'top', wrapText: true };
                const excelColor = SERVICE_TYPE_COLORS[entry.supervised_by]?.argb || 'FFFAFAFA';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColor } };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bitacora_GSS_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Prepare data for rendering (Sort and Color) - Optimized with useMemo
    const sortedEntries = useMemo(() => {
        return [...searchFilteredEntries].sort((a, b) => {
            // Primary: date descending (newest first)
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            // Secondary: sector alphabetically within the same date
            return (a.sector || '').localeCompare(b.sector || '');
        });
    }, [searchFilteredEntries]);


    const updateReportItem = (index: number, field: keyof ReportItem, value: any) => {
        const newItems = [...reportItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setReportItems(newItems);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem'
            }}>
                <Header
                    title="Bitácora - Supervisores"
                    actions={
                        isMobile ? (
                            <button onClick={exportToExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                <Download size={16} />
                                <span>Exportar</span>
                            </button>
                        ) : undefined
                    }
                />

                <div className="desktop-toolbar">
                    {/* Left: destructive actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={handleDeleteSelected} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            Eliminar Fila(s)
                        </button>
                        <button onClick={() => handleManage('clear_entries')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            Vaciar Todo
                        </button>
                    </div>

                    {/* Center: Filtros + Buscador */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Filtros dropdown */}
                        <div ref={filterRef} style={{ position: 'relative' }}>
                            {(() => {
                                const activeCount = [dateFilter, dateFilterTo, serviceTypeFilter].filter(Boolean).length;
                                return (
                                    <button
                                        onClick={() => setShowFilters(v => !v)}
                                        className="btn"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: showFilters ? 600 : 400, border: activeCount > 0 ? '1px solid var(--accent-color)' : undefined, color: activeCount > 0 ? 'var(--accent-color)' : undefined }}
                                    >
                                        <Filter size={14} />
                                        Filtros
                                        {activeCount > 0 && (
                                            <span style={{ background: 'var(--accent-color)', color: 'white', borderRadius: '10px', fontSize: '0.7rem', padding: '0 0.4rem', lineHeight: '1.4' }}>{activeCount}</span>
                                        )}
                                        <ChevronDown size={13} style={{ transform: showFilters ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                                    </button>
                                );
                            })()}
                            {showFilters && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '1rem', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Fecha desde</label>
                                        <input
                                            type="date"
                                            value={dateFilter}
                                            onChange={e => { setDateFilter(e.target.value); if (dateFilterTo && e.target.value > dateFilterTo) setDateFilterTo(e.target.value); }}
                                            className="input"
                                            style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Fecha hasta</label>
                                        <input
                                            type="date"
                                            value={dateFilterTo}
                                            min={dateFilter}
                                            onChange={e => setDateFilterTo(e.target.value)}
                                            className="input"
                                            style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Tipo de servicio</label>
                                        <select
                                            value={serviceTypeFilter}
                                            onChange={e => setServiceTypeFilter(e.target.value)}
                                            className="input"
                                            style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                                        >
                                            <option value="">Todos</option>
                                            {SUPERVISO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    {(dateFilter || dateFilterTo || serviceTypeFilter) && (
                                        <button
                                            onClick={() => { setDateFilter(''); setDateFilterTo(''); setServiceTypeFilter(''); }}
                                            className="btn"
                                            style={{ fontSize: '0.8rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)' }}
                                        >
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Keyword search */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar en bitácora..."
                                className="input"
                                style={{ paddingLeft: '0.75rem', paddingRight: '2rem', fontSize: '0.9rem', width: '280px', height: '36px', boxSizing: 'border-box' }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 0 }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={exportToExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <Download size={18} />
                            Exportar Excel
                        </button>
                        <button onClick={() => setShowReportModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={18} />
                            Nuevo Reporte
                        </button>
                    </div>
                </div>

                {/* Admin: stats integridad bitácora */}
                {isAdmin && (
                    <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <ShieldCheck size={18} color="#29416b" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#29416b', flexShrink: 0 }}>Integridad</span>
                        {!logbookStats && !statsLoading && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>—</span>
                        )}
                        {statsLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Consultando…</span>}
                        {logbookStats && !statsLoading && (
                            <>
                                <span style={{ fontSize: '0.85rem', color: '#1d3461' }}><strong>{logbookStats.total.toLocaleString('es-UY')}</strong> reportes</span>
                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Primero: <strong>{logbookStats.first?.date ?? '—'} {logbookStats.first?.time ?? ''}</strong></span>
                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Último: <strong>{logbookStats.last?.date ?? '—'} {logbookStats.last?.time ?? ''}</strong></span>
                            </>
                        )}
                        <button
                            onClick={fetchLogbookStats}
                            disabled={statsLoading}
                            title="Actualizar"
                            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: statsLoading ? 'not-allowed' : 'pointer', color: '#29416b', display: 'flex', alignItems: 'center', opacity: statsLoading ? 0.5 : 1, padding: '0.2rem' }}
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                )}

                {/* Desktop Table View */}
                <div className="card desktop-view" style={{ padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={searchFilteredEntries.length > 0 && selectedIds.size === searchFilteredEntries.length}
                                        onChange={toggleAll}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem', minWidth: '140px' }}>Fecha / Hora</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Tipo de Servicio</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem', minWidth: '150px' }}>Responsable</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem', minWidth: '170px' }}>Cliente</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem', minWidth: '120px' }}>Sector</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem', minWidth: '150px' }}>Funcionario</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Uniforme</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Incidencia</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Reporte</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Fotos</th>
                                {columns.map(col => (
                                    <th key={col.id} style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {col.label}
                                            <button
                                                onClick={() => handleDeleteColumn(col.name, col.label)}
                                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ef4444', opacity: 0.5, transition: 'opacity 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                                title="Eliminar columna"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                <th style={{ padding: '1rem' }}></th>
                            </tr>
                            <tr style={{ borderBottom: '2px solid var(--accent-color)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                                <td style={{ padding: '0.5rem' }}></td>
                                <td style={{ padding: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        <input type="date" value={inlineData.date} onChange={e => setInlineData({ ...inlineData, date: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
                                        <input type="text" readOnly value={realTime} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                                    </div>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.supervised_by} onChange={e => setInlineData({ ...inlineData, supervised_by: e.target.value, supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '' })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {currentUser?.role === 'supervisor' ? (
                                        <input type="text" readOnly value={currentUser.name} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }} />
                                    ) : (
                                        <SearchableSelect
                                            options={supervisores.filter(s => {
                                                if (!inlineData.supervised_by || inlineData.supervised_by === 'Administrativos') return true;
                                                const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                                                const target = normalize(inlineData.supervised_by);
                                                const userRubros = s.rubro?.split(',').map(r => normalize(r.trim())) || [];
                                                return userRubros.includes(target);
                                            }).map(s => s.name)}
                                            value={inlineData.supervisor || ''}
                                            onChange={v => setInlineData({ ...inlineData, supervisor: v })}
                                            placeholder="Responsable..."
                                            style={{ fontSize: '0.85rem' }}
                                            inputStyle={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                        />
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <SearchableSelect
                                        options={availableLocations}
                                        value={inlineData.location || ''}
                                        onChange={newLoc => {
                                            const sectors = getSectorsForLocation(newLoc);
                                            setInlineData({ ...inlineData, location: newLoc, sector: sectors[0] || '' });
                                        }}
                                        placeholder="Cliente..."
                                        style={{ fontSize: '0.85rem' }}
                                        inputStyle={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {(() => {
                                        const sectors = getSectorsForLocation(inlineData.location || '');
                                        return sectors.length === 1 && sectors[0] === 'Sector Único' ? (
                                            <input
                                                type="text"
                                                readOnly
                                                value="Sector Único"
                                                className="input"
                                                style={{ padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                                            />
                                        ) : (
                                            <SearchableSelect
                                                options={sectors}
                                                value={inlineData.sector || ''}
                                                onChange={v => setInlineData({ ...inlineData, sector: v })}
                                                placeholder="Sector..."
                                                style={{ fontSize: '0.85rem' }}
                                                inputStyle={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                            />
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <SearchableSelect
                                        options={funcionarios}
                                        value={inlineData.staff_member || ''}
                                        onChange={v => setInlineData({ ...inlineData, staff_member: v })}
                                        placeholder="Funcionario..."
                                        inputStyle={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.uniform} onChange={e => setInlineData({ ...inlineData, uniform: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select
                                        value={inlineData.incident}
                                        onChange={e => setInlineData({ ...inlineData, incident: e.target.value })}
                                        className="input"
                                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {INCIDENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <textarea
                                        placeholder="Reporte..."
                                        value={inlineData.report}
                                        onChange={e => setInlineData({ ...inlineData, report: e.target.value })}
                                        className="input"
                                        rows={2}
                                        style={{ padding: '0.4rem', fontSize: '0.85rem', resize: 'vertical', minHeight: '60px' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <ImageUploader
                                        images={inlineData.images || []}
                                        onChange={imgs => setInlineData({ ...inlineData, images: imgs })}
                                    />
                                </td>
                                {columns.map(col => (
                                    <td key={col.id} style={{ padding: '0.5rem' }}>
                                        {col.type === 'select' ? (
                                            <select className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} onChange={e => setInlineData({ ...inlineData, extra_data: { ...inlineData.extra_data, [col.name]: e.target.value } })}>
                                                <option value="">...</option>
                                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input type={col.type} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} onChange={e => setInlineData({ ...inlineData, extra_data: { ...inlineData.extra_data, [col.name]: e.target.value } })} />
                                        )}
                                    </td>
                                ))}
                                <td style={{ padding: '0.5rem' }}>
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => {
                                            if (!inlineData.supervisor) {
                                                alert('Debes seleccionar un Responsable.');
                                                return;
                                            }
                                            if (!inlineData.report?.trim()) {
                                                alert('Completa el campo Reporte.');
                                                return;
                                            }
                                            const missingInlineFields: string[] = [];
                                            if (!inlineData.location) missingInlineFields.push('Cliente');
                                            if (!inlineData.staff_member) missingInlineFields.push('Funcionario');
                                            if (missingInlineFields.length > 0) {
                                                const ok = window.confirm(`Al no completar los siguientes campos: ${missingInlineFields.join(', ')}, se marcarán como "No especificado". ¿Deseas continuar?`);
                                                if (!ok) return;
                                                handleCreateReport(null, {
                                                    ...inlineData,
                                                    location: inlineData.location || 'No especificado',
                                                    staff_member: inlineData.staff_member || 'No especificado',
                                                });
                                                return;
                                            }
                                            handleCreateReport(null, inlineData);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap', opacity: isSubmitting ? 0.7 : 1 }}
                                    >
                                        {isSubmitting ? 'Guardando...' : 'Agregar'}
                                    </button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {searchFilteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={11 + columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <BookOpen size={48} opacity={0.2} />
                                            <p>{searchQuery.trim() ? `Sin resultados para "${searchQuery}"` : 'Empieza a llenar tu Bitácora directamente arriba o usa el botón Nuevo'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedEntries.map((entry, index) => {
                                    const isNewSector = index === 0 || entry.sector !== sortedEntries[index - 1].sector;
                                    const serviceColors = SERVICE_TYPE_COLORS[entry.supervised_by] || { bg: 'transparent', border: 'var(--border-color)' };
                                    const rowBgColor = selectedIds.has(entry.id)
                                        ? 'rgba(59, 130, 246, 0.08)'
                                        : serviceColors.bg;

                                    return (
                                        <React.Fragment key={entry.id}>
                                            {isNewSector && index > 0 && (
                                                <tr style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                                                    <td colSpan={11 + columns.length} style={{ padding: 0, borderTop: '2px solid var(--border-color)' }}></td>
                                                </tr>
                                            )}
                                            <tr style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                fontSize: '0.9rem',
                                                backgroundColor: rowBgColor,
                                                borderLeft: `3px solid ${serviceColors.border}`
                                            }}>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(entry.id)}
                                                        onChange={() => toggleSelection(entry.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: 500 }}>{entry.date}</div>
                                                    {entry.time && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                                                            <Clock size={11} />{entry.time}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {(() => {
                                                        const c = SERVICE_TYPE_COLORS[entry.supervised_by];
                                                        return c ? (
                                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '10px', backgroundColor: c.light, color: c.text, border: `1px solid ${c.border}50`, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                                {entry.supervised_by}
                                                            </span>
                                                        ) : (entry.supervised_by || '-');
                                                    })()}
                                                </td>
                                                <td style={{ padding: '1rem' }}>{entry.supervisor || '-'}</td>
                                                <td style={{ padding: '1rem' }}>{entry.location}</td>
                                                <td style={{ padding: '1rem', fontWeight: isNewSector ? 600 : 400 }}>{entry.sector}</td>
                                                <td style={{ padding: '1rem' }}>{entry.staff_member}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444', border: '1px solid currentColor' }}>
                                                        {entry.uniform}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{entry.incident}</td>
                                                <td style={{ padding: '1rem', verticalAlign: 'top', whiteSpace: 'normal', lineBreak: 'anywhere', minWidth: '250px' }}>{entry.report}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {entry.images && entry.images.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                            {entry.images.map(url => (
                                                                <img
                                                                    key={url}
                                                                    src={url}
                                                                    alt="foto"
                                                                    onClick={() => window.open(url, '_blank')}
                                                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : <span style={{ opacity: 0.3, fontSize: '0.8rem' }}>—</span>}
                                                </td>
                                                {columns.map(col => (
                                                    <td key={col.id} style={{ padding: '1rem' }}>{entry.extra_data[col.name] || '-'}</td>
                                                ))}
                                                <td style={{ padding: '1rem' }}></td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View (Compact) */}
                <div className="mobile-view">
                    {/* Mobile: Filtros + Buscador */}
                    {(() => {
                        const activeCount = [dateFilter, dateFilterTo, serviceTypeFilter].filter(Boolean).length;
                        return (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                                {/* Filtros dropdown */}
                                <div ref={mobileFilterRef} style={{ position: 'relative', flexShrink: 0 }}>
                                    <button
                                        onClick={() => setShowFilters(v => !v)}
                                        className="btn"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', height: '38px', fontWeight: showFilters ? 600 : 400, border: activeCount > 0 ? '1px solid var(--accent-color)' : undefined, color: activeCount > 0 ? 'var(--accent-color)' : undefined }}
                                    >
                                        <Filter size={14} />
                                        Filtros
                                        {activeCount > 0 && (
                                            <span style={{ background: 'var(--accent-color)', color: 'white', borderRadius: '10px', fontSize: '0.7rem', padding: '0 0.4rem', lineHeight: '1.4' }}>{activeCount}</span>
                                        )}
                                        <ChevronDown size={13} style={{ transform: showFilters ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                                    </button>
                                    {showFilters && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '1rem', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Fecha desde</label>
                                                <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (dateFilterTo && e.target.value > dateFilterTo) setDateFilterTo(e.target.value); }} className="input" style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Fecha hasta</label>
                                                <input type="date" value={dateFilterTo} min={dateFilter} onChange={e => setDateFilterTo(e.target.value)} className="input" style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Tipo de servicio</label>
                                                <select value={serviceTypeFilter} onChange={e => setServiceTypeFilter(e.target.value)} className="input" style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>
                                                    <option value="">Todos</option>
                                                    {SUPERVISO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                            {(dateFilter || dateFilterTo || serviceTypeFilter) && (
                                                <button onClick={() => { setDateFilter(''); setDateFilterTo(''); setServiceTypeFilter(''); }} className="btn" style={{ fontSize: '0.8rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                                                    Limpiar filtros
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Keyword search */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar en bitácora..."
                                        className="input"
                                        style={{ paddingLeft: '0.75rem', paddingRight: '2rem', fontSize: '0.9rem', width: '100%', height: '38px', boxSizing: 'border-box' }}
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 0 }}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    {searchFilteredEntries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            <BookOpen size={48} opacity={0.2} />
                            <p style={{ marginTop: '1rem' }}>{searchQuery.trim() ? `Sin resultados para "${searchQuery}"` : 'No hay registros. Usa el botón + para agregar uno.'}</p>
                        </div>
                    ) : (
                        sortedEntries.map((entry) => (
                            <div key={entry.id} className="logbook-card" style={{
                                borderLeft: `4px solid ${SERVICE_TYPE_COLORS[entry.supervised_by]?.border || 'var(--border-color)'}`,
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                backgroundColor: 'var(--surface-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {entry.date}{entry.time ? ` • ${entry.time}` : ''} • {entry.sector}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {entry.location}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '20px',
                                        backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444',
                                        fontWeight: 600,
                                        border: '1px solid currentColor'
                                    }}>
                                        {entry.uniform}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <div>
                                        <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>Responsable</span>
                                        <strong>{entry.supervisor || '-'}</strong>
                                    </div>
                                    <div>
                                        <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>Personal</span>
                                        <strong>{entry.staff_member}</strong>
                                    </div>
                                </div>

                                {entry.images && entry.images.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', paddingTop: '0.25rem' }}>
                                        {entry.images.map(url => (
                                            <img
                                                key={url}
                                                src={url}
                                                alt="foto"
                                                onClick={() => window.open(url, '_blank')}
                                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                            />
                                        ))}
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                                        {entry.incident || 'Sin incidencia'}
                                    </div>
                                    <button
                                        onClick={() => setSelectedReport(entry)}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '8px' }}
                                    >
                                        Ver Detalles
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* FAB for Mobile */}
                <button className="fab mobile-view" onClick={() => setShowReportModal(true)} aria-label="Nuevo Reporte">
                    <Plus size={24} />
                </button>

                {/* Modal: Nuevo Reporte */}
                {
                    showReportModal && (
                        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                            <div className="card modal-responsive" style={{ width: '1000px', maxWidth: '95vw', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                                <button onClick={() => setShowReportModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', opacity: 0.5 }}><X size={24} /></button>

                                <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <ClipboardList className="accent-text" />
                                    Nuevo Reporte por Sector
                                </h2>

                                <form onSubmit={(e) => handleCreateReport(e, reportItems)}>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
                                        <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos Generales</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Fecha</label>
                                                <input type="date" required value={newReportHeader.date} onChange={e => setNewReportHeader({ ...newReportHeader, date: e.target.value })} className="input" />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Hora (Actual)</label>
                                                <input type="text" readOnly value={realTime} className="input" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Tipo de Servicio</label>
                                                <select value={newReportHeader.supervised_by} onChange={e => setNewReportHeader({ ...newReportHeader, supervised_by: e.target.value, supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '' })} className="input" required>
                                                    {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Responsable</label>
                                                {currentUser?.role === 'supervisor' ? (
                                                    <input type="text" readOnly value={currentUser.name} className="input" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }} />
                                                ) : (
                                                    <SearchableSelect
                                                        options={supervisores.filter(s => {
                                                            if (!newReportHeader.supervised_by || newReportHeader.supervised_by === 'Administrativos') return true;
                                                            const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                                                            const target = normalize(newReportHeader.supervised_by);
                                                            const userRubros = s.rubro?.split(',').map(r => normalize(r.trim())) || [];
                                                            return userRubros.includes(target);
                                                        }).map(s => s.name)}
                                                        value={newReportHeader.supervisor || ''}
                                                        onChange={v => setNewReportHeader({ ...newReportHeader, supervisor: v })}
                                                        placeholder="Seleccionar Responsable"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Cliente</label>
                                                <SearchableSelect
                                                    options={availableLocations}
                                                    value={newReportHeader.location}
                                                    onChange={newLoc => {
                                                        const sectors = getSectorsForLocation(newLoc);
                                                        setNewReportHeader({ ...newReportHeader, location: newLoc, sector: sectors[0] || '' });
                                                        setReportItems(reportItems.map(item => ({ ...item, sector: sectors[0] || '' })));
                                                    }}
                                                    placeholder="Seleccionar Cliente"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sectores y Novedades</h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sectors = getSectorsForLocation(newReportHeader.location);
                                                    setReportItems([...reportItems, { sector: sectors[0] || '', staff_member: '', uniform: UNIFORMS[0], incident: '', report: '', time: getCurrentTime(), images: [], extra_data: {} }]);
                                                }}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                            >
                                                <Plus size={14} /> Añadir Lugar
                                            </button>
                                        </div>

                                        {reportItems.map((item, idx) => (
                                            <div key={idx} style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem', position: 'relative', backgroundColor: 'var(--surface-color)' }}>
                                                {reportItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setReportItems(reportItems.filter((_, i) => i !== idx))}
                                                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}
                                                        title="Quitar lugar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Lugar</label>
                                                        {(() => {
                                                            const sectors = getSectorsForLocation(newReportHeader.location);
                                                            return sectors.length === 1 && sectors[0] === 'Sector Único' ? (
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value="Sector Único"
                                                                    className="input"
                                                                    style={{ width: '100%', padding: '0.6rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                                                                />
                                                            ) : (
                                                                <SearchableSelect
                                                                    options={sectors}
                                                                    value={item.sector}
                                                                    onChange={v => updateReportItem(idx, 'sector', v)}
                                                                    placeholder="Seleccionar Sector"
                                                                />
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Funcionario / Personal</label>
                                                        <SearchableSelect
                                                            options={funcionarios}
                                                            value={item.staff_member}
                                                            onChange={v => updateReportItem(idx, 'staff_member', v)}
                                                            placeholder="Funcionario..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Uniforme</label>
                                                        <select
                                                            value={item.uniform}
                                                            onChange={e => updateReportItem(idx, 'uniform', e.target.value)}
                                                            className="input"
                                                            required
                                                        >
                                                            {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Incidencia</label>
                                                        <select
                                                            required
                                                            value={item.incident}
                                                            onChange={e => updateReportItem(idx, 'incident', e.target.value)}
                                                            className="input"
                                                            style={{ width: '100%', padding: '0.6rem' }}
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {INCIDENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                    </div>
                                                    <div style={{ gridColumn: '1 / -1' }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Reporte / Novedad</label>
                                                        <textarea
                                                            required
                                                            value={item.report}
                                                            onChange={e => updateReportItem(idx, 'report', e.target.value)}
                                                            className="input"
                                                            rows={4}
                                                            style={{ resize: 'vertical', minHeight: isMobile ? '120px' : '90px', lineHeight: '1.5', width: '100%' }}
                                                        />
                                                    </div>
                                                    <div style={{ gridColumn: '1 / -1' }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Imágenes (opcional)</label>
                                                        <ImageUploader
                                                            images={item.images || []}
                                                            onChange={imgs => updateReportItem(idx, 'images', imgs)}
                                                        />
                                                    </div>
                                                </div>

                                                {columns.length > 0 && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                                        {columns.map(col => (
                                                            <div key={col.id}>
                                                                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>{col.label}</label>
                                                                {col.type === 'select' ? (
                                                                    <select
                                                                        className="input"
                                                                        value={item.extra_data[col.name] || ''}
                                                                        onChange={e => {
                                                                            const newData = { ...item.extra_data, [col.name]: e.target.value };
                                                                            updateReportItem(idx, 'extra_data', newData);
                                                                        }}
                                                                    >
                                                                        <option value="">Seleccionar...</option>
                                                                        {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type={col.type}
                                                                        className="input"
                                                                        value={item.extra_data[col.name] || ''}
                                                                        onChange={e => {
                                                                            const newData = { ...item.extra_data, [col.name]: e.target.value };
                                                                            updateReportItem(idx, 'extra_data', newData);
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                        <button type="button" onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                        <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2, opacity: isSubmitting ? 0.7 : 1 }}>
                                            {isSubmitting ? 'Guardando...' : 'Guardar Reporte'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Modal: Nueva Columna */}
                {showColumnModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Nueva Columna</h3>
                                <button onClick={() => setShowColumnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre</label>
                                    <input value={newColumn.label} onChange={e => setNewColumn({ ...newColumn, label: e.target.value })} className="input" placeholder="Ej: Kilometraje" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo</label>
                                    <select className="input" value={newColumn.type} onChange={e => setNewColumn({ ...newColumn, type: e.target.value as any })}>
                                        <option value="text">Texto</option>
                                        <option value="number">Número</option>
                                        <option value="date">Fecha</option>
                                        <option value="select">Lista Desplegable</option>
                                    </select>
                                </div>
                                {newColumn.type === 'select' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Opciones</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input value={optionText} onChange={e => setOptionText(e.target.value)} className="input" placeholder="Nueva opción..." />
                                            <button type="button" onClick={() => { if (optionText) { setNewColumn({ ...newColumn, options: [...(newColumn.options || []), optionText] }); setOptionText(''); } }} className="btn btn-secondary">Añadir</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {newColumn.options?.map(opt => (
                                                <span key={opt} style={{ padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {opt}
                                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setNewColumn({ ...newColumn, options: newColumn.options?.filter(o => o !== opt) })} />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button onClick={() => setShowColumnModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                    <button onClick={handleCreateColumn} className="btn btn-primary" style={{ flex: 1 }}>Crear</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW/EDIT MODAL */}
                {selectedReport && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Detalles del Reporte</h2>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        {selectedReport.date}{selectedReport.time ? ` — ${selectedReport.time}` : ''} • {selectedReport.sector}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedReport(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}><X size={20} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Cliente</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.location}</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Supervisor</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.supervisor}</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Funcionario</label>
                                    <div style={{ fontWeight: 500 }}>{selectedReport.staff_member || 'No asignado'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Incidencia</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.incident || '-'}</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Uniforme</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.uniform}</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Reporte / Detalle</label>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                        {selectedReport.report}
                                    </div>
                                </div>

                                {selectedReport.images && selectedReport.images.length > 0 && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.5rem' }}>Imágenes ({selectedReport.images.length})</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {selectedReport.images.map(url => (
                                                <img
                                                    key={url}
                                                    src={url}
                                                    alt="foto"
                                                    onClick={() => window.open(url, '_blank')}
                                                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'opacity 0.2s' }}
                                                    onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
                                                    onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {columns.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {columns.map(col => (
                                            <div key={col.id}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>{col.label}</label>
                                                <div style={{ fontWeight: 500 }}>{selectedReport.extra_data[col.name] || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={async () => {
                                        if (confirm('¿Eliminar este reporte permanentemente?')) {
                                            try {
                                                const res = await fetch('/api/logbook/delete', {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ ids: [selectedReport.id] })
                                                });
                                                if (res.ok) {
                                                    setSelectedReport(null);
                                                    fetchData();
                                                } else {
                                                    alert('Error al eliminar');
                                                }
                                            } catch (error) {
                                                console.error('Error deleting report:', error);
                                                alert('Error al eliminar');
                                            }
                                        }
                                    }}
                                    className="btn"
                                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                >
                                    <Trash2 size={18} /> Eliminar
                                </button>
                                <button onClick={() => setSelectedReport(null)} className="btn btn-primary" style={{ flex: 2 }}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
