'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface FormState {
    report_datetime: string;   // Fecha y Hora de Entrada
    client: string;
    branch: string;
    record_type: string;       // Tipo de Plan
    affected_system: string;   // Plan Correctivo - Equipos Intervenidos
    security_event: string;    // Plan Preventivo - Equipos Previstos
    record_detail: string;     // Descripción de acciones
    technician: string;        // Técnico Responsable
    event_classification: string; // Observaciones
    end_datetime: string;      // Fecha y Hora de Salida
}

const EMPTY_FORM: FormState = {
    report_datetime: '',
    client: '',
    branch: '',
    record_type: '',
    affected_system: '',
    security_event: '',
    record_detail: '',
    technician: '',
    event_classification: '',
    end_datetime: ''
};

const PLAN_TYPES = ['Correctivo', 'Preventivo', 'Correctivo y Preventivo'];

const fieldStyle = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--surface-color)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    boxSizing: 'border-box' as const
};

const labelStyle = {
    display: 'block' as const,
    marginBottom: '0.35rem',
    fontWeight: 500 as const,
    fontSize: '0.875rem',
    color: 'var(--text-primary)'
};

const requiredLabel = (text: string) => (
    <label style={labelStyle}>
        <span style={{ color: 'var(--priority-high)', marginRight: '0.25rem' }}>*</span>{text}
    </label>
);

export default function MantenimientoPage() {
    const { currentUser, isAuthenticated, getAuthHeaders, logout } = useTicketContext();
    const router = useRouter();
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [clientSectorMap, setClientSectorMap] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (isAuthenticated === false) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'tecnico')) router.push('/');
    }, [isAuthenticated, currentUser, router]);

    useEffect(() => {
        if (!currentUser) return;
        setForm(f => ({ ...f, technician: f.technician || currentUser.name }));
    }, [currentUser?.id]);

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

    const set = (field: keyof FormState) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            const val = e.target.value;
            setForm(f => {
                const next = { ...f, [field]: val };
                if (field === 'client') next.branch = '';
                if (field === 'record_type') {
                    next.affected_system = '';
                    next.security_event = '';
                }
                return next;
            });
        };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess(false);
        try {
            const res = await fetch('/api/seguridad-electronica', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ...form, type: 'mantenimiento' })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar');
            }
            setSuccess(true);
            setForm(EMPTY_FORM);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!currentUser) return null;

    const showCorrectivo = form.record_type === 'Correctivo' || form.record_type === 'Correctivo y Preventivo';
    const showPreventivo = form.record_type === 'Preventivo' || form.record_type === 'Correctivo y Preventivo';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/seguridad-electronica" style={{ position: 'absolute', left: '1.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                    <ArrowLeft size={15} /> Inicio
                </Link>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Mantenimiento Correctivo/Preventivo
                </h1>
            </header>

            <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: 0 }}>
                <div className="card" style={{ width: '100%', maxWidth: '680px' }}>
                    {success && (
                        <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', color: '#166534', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            Registro guardado correctamente.
                        </div>
                    )}
                    {error && (
                        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                        <div>
                            {requiredLabel('Fecha y Hora de Entrada')}
                            <input type="datetime-local" required value={form.report_datetime} onChange={set('report_datetime')} style={fieldStyle} />
                        </div>

                        <div>
                            {requiredLabel('Cliente')}
                            <select required value={form.client} onChange={set('client')} style={fieldStyle}>
                                <option value="">Seleccionar cliente...</option>
                                {Object.keys(clientSectorMap).sort().map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            {requiredLabel('Sector')}
                            {(clientSectorMap[form.client] || []).length > 0 ? (
                                <select required value={form.branch} onChange={set('branch')} style={fieldStyle}>
                                    <option value="">Seleccionar sector...</option>
                                    {(clientSectorMap[form.client] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            ) : (
                                <input type="text" required value={form.branch} onChange={set('branch')} style={fieldStyle} placeholder="Ingresar sector..." />
                            )}
                        </div>

                        <div>
                            {requiredLabel('Tipo de Plan')}
                            <select required value={form.record_type} onChange={set('record_type')} style={fieldStyle}>
                                <option value="">Buscar elementos...</option>
                                {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {showCorrectivo && (
                            <div>
                                <label style={labelStyle}>Plan Correctivo - Equipos Intervenidos</label>
                                <input type="text" value={form.affected_system} onChange={set('affected_system')} style={fieldStyle} />
                            </div>
                        )}

                        {showPreventivo && (
                            <div>
                                <label style={labelStyle}>Plan Preventivo - Equipos Previstos</label>
                                <input type="text" value={form.security_event} onChange={set('security_event')} style={fieldStyle} />
                            </div>
                        )}

                        <div>
                            {requiredLabel('Descripción de acciones')}
                            <textarea required value={form.record_detail} onChange={set('record_detail')} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                        </div>

                        <div>
                            {requiredLabel('Técnico Responsable')}
                            <input type="text" required value={form.technician} onChange={set('technician')} style={fieldStyle} />
                        </div>

                        <div>
                            {requiredLabel('Observaciones')}
                            <input type="text" required value={form.event_classification} onChange={set('event_classification')} style={fieldStyle} />
                        </div>

                        <div>
                            {requiredLabel('Fecha y Hora de Salida')}
                            <input type="datetime-local" required value={form.end_datetime} onChange={set('end_datetime')} style={fieldStyle} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, minWidth: '120px' }}>
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                            <Link href="/seguridad-electronica" style={{ textDecoration: 'none' }}>
                                <button type="button" className="btn btn-secondary">Volver</button>
                            </Link>
                        </div>
                        <button type="button" onClick={() => setForm({ ...EMPTY_FORM, technician: currentUser.name })} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            Limpiar Datos
                        </button>
                    </form>
                </div>
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
