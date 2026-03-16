'use client';

import Sidebar from '../../../components/Sidebar';
import Header from '../../../components/Header';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTicketContext, DEPARTMENTS, PRIORITY_COLORS, STATUS_COLORS } from '../../../context/TicketContext';
import { useState, use, useEffect, useCallback } from 'react';
import { FolderOpen, Trash2, Search, Download } from 'lucide-react';

export default function FolderPage({ params }: { params: Promise<{ id: string }> }) {
    const { isSidebarOpen, isMobile, folders, removeTicketFromFolder } = useTicketContext() as any;
    const router = useRouter();

    const getAuthHeaders = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const resolvedParams = use(params);
    const folderId = Number(resolvedParams.id);

    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [priorityFilter, setPriorityFilter] = useState('Todos');
    const [departmentFilter, setDepartmentFilter] = useState('Todos');

    const folder = folders.find((f: any) => f.id === folderId);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/folders/${folderId}/tickets`, { headers: getAuthHeaders() });
            if (res.ok) setTickets(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [folderId]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const handleRemove = async (ticketId: string) => {
        if (!confirm('¿Quitar este ticket de la carpeta?')) return;
        const ok = await removeTicketFromFolder(ticketId, folderId);
        if (ok) setTickets(prev => prev.filter((t: any) => t.id !== ticketId));
    };

    const filtered = tickets.filter((t: any) => {
        const matchesSearch = !searchQuery ||
            t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.id?.toString().includes(searchQuery);
        const matchesStatus = statusFilter === 'Todos' || t.status === statusFilter;
        const matchesPriority = priorityFilter === 'Todos' || t.priority === priorityFilter;
        const matchesDept = departmentFilter === 'Todos' || t.department === departmentFilter;
        return matchesSearch && matchesStatus && matchesPriority && matchesDept;
    });

    const exportToExcel = async () => {
        const params = new URLSearchParams({ folderId: String(folderId) });
        if (statusFilter !== 'Todos') params.append('status', statusFilter);
        if (priorityFilter !== 'Todos') params.append('priority', priorityFilter);
        if (departmentFilter !== 'Todos') params.append('department', departmentFilter);
        try {
            const res = await fetch(`/api/tickets/export?${params.toString()}`, { headers: getAuthHeaders() });
            if (!res.ok) { alert('Error al exportar'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${folder?.name ?? 'carpeta'}_tickets.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Error al exportar');
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title={folder ? folder.name : 'Carpeta'} />

                <div style={{ marginBottom: '1rem' }}>
                    <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem', padding: 0 }}>
                        ← Volver
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <FolderOpen size={20} color="var(--accent-color)" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, flex: 1 }}>{folder?.name ?? `Carpeta #${folderId}`}</h2>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
                    <button
                        onClick={exportToExcel}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                    >
                        <Download size={15} /> Exportar Excel
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar tickets..."
                            style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                    </div>

                    {[
                        { label: 'Estado', value: statusFilter, set: setStatusFilter, options: ['Todos', 'Nuevo', 'En Progreso', 'Resuelto'] },
                        { label: 'Prioridad', value: priorityFilter, set: setPriorityFilter, options: ['Todos', 'Alta', 'Media', 'Baja'] },
                        { label: 'Departamento', value: departmentFilter, set: setDepartmentFilter, options: ['Todos', ...DEPARTMENTS] },
                    ].map(({ label, value, set, options }) => (
                        <select
                            key={label}
                            value={value}
                            onChange={e => set(e.target.value)}
                            style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                        >
                            {options.map(o => <option key={o} value={o}>{o === 'Todos' ? `${label}: Todos` : o}</option>)}
                        </select>
                    ))}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Cargando...</div>
                ) : filtered.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <FolderOpen size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>{tickets.length === 0 ? 'Esta carpeta está vacía.' : 'Sin resultados para los filtros aplicados.'}</p>
                        {tickets.length === 0 && <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Desde el detalle de un ticket podés agregarlo a esta carpeta.</p>}
                    </div>
                ) : isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filtered.map((t: any) => (
                            <div key={t.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Link href={`/tickets/${t.id}`} style={{ fontWeight: 600, color: 'var(--accent-color)', textDecoration: 'none', flex: 1 }}>
                                        T-{t.id} · {t.subject}
                                    </Link>
                                    <button onClick={() => handleRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', flexShrink: 0 }}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span className="tag" style={{ backgroundColor: STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] }}>{t.status}</span>
                                    <span className="tag" style={{ backgroundColor: PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS] }}>{t.priority}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>{t.department}</span>
                                </div>
                                {t.resolvedAt && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Resuelto: {new Date(t.resolvedAt).toLocaleDateString('es-AR')}</span>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                                    {['#', 'Asunto', 'Departamento', 'Prioridad', 'Estado', 'Fecha', ''].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((t: any, i: number) => (
                                    <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>T-{t.id}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <Link href={`/tickets/${t.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500 }}>{t.subject}</Link>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{t.department}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span className="tag" style={{ backgroundColor: PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS] }}>{t.priority}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span className="tag" style={{ backgroundColor: STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] }}>{t.status}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            {t.resolvedAt
                                                ? new Date(t.resolvedAt).toLocaleDateString('es-AR')
                                                : t.createdAt
                                                    ? new Date(t.createdAt).toLocaleDateString('es-AR')
                                                    : t.date ?? ''}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <button onClick={() => handleRemove(t.id)} title="Quitar de carpeta" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex' }}>
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
