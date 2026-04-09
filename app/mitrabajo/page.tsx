'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw, FileSpreadsheet, Calendar, LogOut, AlertCircle, Trash2 } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface MitrabajoFile {
    filename: string;
    date: string | null;
    size: number;
    createdAt: string;
}

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
    return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoDate: string | null) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

export default function MitrabajoPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();

    const [files, setFiles] = useState<MitrabajoFile[]>([]);
    const [fetching, setFetching] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [customDate, setCustomDate] = useState('');

    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    const loadFiles = useCallback(async () => {
        setFetching(true);
        try {
            const res = await fetch('/api/mitrabajo/files', { headers: getAuthHeaders() });
            const data = await res.json();
            setFiles(data.files ?? []);
        } catch {
            setFiles([]);
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && !hasMitrabajoAccess(currentUser)) { router.push('/'); return; }
        loadFiles();
    }, [loading, isAuthenticated, currentUser, router, loadFiles]);

    const handleDownloadFile = (filename: string) => {
        const url = `/api/mitrabajo/download?file=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.href = url;
        // Descarga vía fetch — la cookie httpOnly 'session' se envía automáticamente
        fetch(url, { headers: getAuthHeaders() })
            .then(res => res.blob())
            .then(blob => {
                const objUrl = URL.createObjectURL(blob);
                a.href = objUrl;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(objUrl);
            });
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`¿Eliminar ${filename}?`)) return;
        await fetch(`/api/mitrabajo/delete?file=${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        setFiles(prev => prev.filter(f => f.filename !== filename));
    };

    const handleTrigger = async () => {
        setTriggering(true);
        setTriggerMsg(null);
        try {
            const body: Record<string, string> = {};
            if (customDate) body.date = customDate;
            const res = await fetch('/api/mitrabajo/trigger', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.ok) {
                setTriggerMsg({ ok: true, text: 'Descarga completada exitosamente.' });
                await loadFiles();
            } else {
                setTriggerMsg({ ok: false, text: data.error ?? 'Error desconocido.' });
            }
        } catch (e: any) {
            setTriggerMsg({ ok: false, text: e.message });
        } finally {
            setTriggering(false);
        }
    };

    if (loading || !currentUser) return null;

    // Calcular fecha de ayer para mostrar en el trigger
    const yesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    })();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Inicio
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '860px', width: '100%', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Mitrabajo — Panel de Control
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Descarga automática diaria del reporte Excel desde mitrabajo.uy.
                </p>

                {/* Trigger manual */}
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                        Descarga manual
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Fecha (opcional, default: ayer {formatDate(yesterday)})
                            </label>
                            <input
                                type="date"
                                value={customDate}
                                onChange={e => setCustomDate(e.target.value)}
                                max={yesterday}
                                className="input"
                                style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                            />
                        </div>
                        <button
                            onClick={handleTrigger}
                            disabled={triggering}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: triggering ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: triggering ? 0.7 : 1, alignSelf: 'flex-end' }}
                        >
                            {triggering
                                ? <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Descargando...</>
                                : <><Download size={15} /> Descargar ahora</>
                            }
                        </button>
                    </div>
                    {triggerMsg && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius)', backgroundColor: triggerMsg.ok ? '#dcfce7' : '#fee2e2', color: triggerMsg.ok ? '#166534' : '#991b1b', fontSize: '0.83rem' }}>
                            {!triggerMsg.ok && <AlertCircle size={14} />}
                            {triggerMsg.text}
                        </div>
                    )}
                </div>

                {/* Lista de archivos */}
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            Archivos descargados
                        </h2>
                        <button
                            onClick={loadFiles}
                            disabled={fetching}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                        >
                            <RefreshCw size={13} style={fetching ? { animation: 'spin 0.8s linear infinite' } : {}} /> Actualizar
                        </button>
                    </div>

                    {fetching ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <div style={{ width: '28px', height: '28px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : files.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            <FileSpreadsheet size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                            <p style={{ margin: 0 }}>No hay archivos descargados aún.</p>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>Usá "Descargar ahora" o esperá la descarga automática de mañana.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {files.map(f => (
                                <div
                                    key={f.filename}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', flexWrap: 'wrap', gap: '0.5rem' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <FileSpreadsheet size={20} color="#22c55e" />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={13} color="var(--text-secondary)" />
                                                {formatDate(f.date)}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {f.filename} · {formatBytes(f.size)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleDownloadFile(f.filename)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                        >
                                            <Download size={13} /> Descargar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(f.filename)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <button
                onClick={() => { logout(); router.push('/login'); }}
                style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
