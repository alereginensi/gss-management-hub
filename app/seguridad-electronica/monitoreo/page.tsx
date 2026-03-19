'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

const RECORD_TYPES = ['Evento de Seguridad', 'Intervención Móvil', 'Bitácora Técnica'];
const SECURITY_EVENTS = ['Intrusión confirmado', 'Sospechoso', 'Falla técnica', 'Pánico / Emergencia humana', 'Falsa alarma', 'Otro'];
const MOBILE_INTERVENTIONS = ['Reparación', 'Supervisión', 'Cobertura', 'Prueba', 'Instalación', 'Otro'];
const EVENT_CLASSIFICATIONS = ['Confirmado', 'No determinado', 'No aplica', 'Otro'];

interface FormState {
    report_datetime: string;
    client: string;
    branch: string;          // sector
    supervisor: string;
    technician: string;
    record_type: string;
    security_event: string;
    mobile_intervention: string;
    affected_system: string;
    record_detail: string;
    event_classification: string;
    public_force: boolean;
    complaint_number: string;
    end_datetime: string;
}

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

const req = (text: string) => (
    <label style={labelStyle}>
        <span style={{ color: 'var(--priority-high)', marginRight: '0.25rem' }}>*</span>{text}
    </label>
);

export default function MonitoreoPage() {
    const { currentUser, isAuthenticated, getAuthHeaders, logout } = useTicketContext();
    const router = useRouter();

    const makeEmpty = (user: typeof currentUser): FormState => ({
        report_datetime: '',
        client: '',
        branch: '',
        supervisor: user?.name || '',
        technician: user?.name || '',
        record_type: '',
        security_event: '',
        mobile_intervention: '',
        affected_system: '',
        record_detail: '',
        event_classification: '',
        public_force: false,
        complaint_number: '',
        end_datetime: ''
    });

    const [form, setForm] = useState<FormState>(makeEmpty(null));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [clientSectorMap, setClientSectorMap] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (isAuthenticated === false) router.push('/login');
        else if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'tecnico') router.push('/');
    }, [isAuthenticated, currentUser, router]);

    // Pre-fill supervisor and technician with current user
    useEffect(() => {
        if (!currentUser) return;
        setForm(f => ({
            ...f,
            supervisor: f.supervisor || currentUser.name,
            technician: f.technician || currentUser.name,
        }));
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
                // Reset sector when client changes
                if (field === 'client') next.branch = '';
                // Reset sub-fields when record_type changes
                if (field === 'record_type') {
                    next.security_event = '';
                    next.mobile_intervention = '';
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
                body: JSON.stringify({ ...form, type: 'monitoreo', public_force: form.public_force ? 1 : 0 })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar');
            }
            setSuccess(true);
            setForm(makeEmpty(currentUser));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!currentUser) return null;

    const clientNames = Object.keys(clientSectorMap).sort();
    const sectors = clientSectorMap[form.client] || [];
    const showSecurityEvent = form.record_type === 'Evento de Seguridad';
    const showMobileIntervention = form.record_type === 'Intervención Móvil';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/seguridad-electronica" style={{ position: 'absolute', left: '1.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                    <ArrowLeft size={15} /> Inicio
                </Link>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Registro de Monitoreo
                </h1>
            </header>

            <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', marginLeft: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                            {req('Fecha y Hora del Reporte')}
                            <input type="datetime-local" required value={form.report_datetime} onChange={set('report_datetime')} style={fieldStyle} />
                        </div>

                        {/* Cliente */}
                        <div>
                            {req('Cliente')}
                            <select required value={form.client} onChange={set('client')} style={fieldStyle}>
                                <option value="">Seleccionar cliente...</option>
                                {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Sector — dinámico según cliente */}
                        <div>
                            {req('Sector')}
                            {sectors.length > 0 ? (
                                <select required value={form.branch} onChange={set('branch')} style={fieldStyle}>
                                    <option value="">Seleccionar sector...</option>
                                    {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            ) : (
                                <input type="text" required value={form.branch} onChange={set('branch')} style={fieldStyle} placeholder="Ingresar sector..." />
                            )}
                        </div>

                        {/* Supervisor y Técnico — pre-completados con usuario actual */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                {req('Supervisor')}
                                <input type="text" required value={form.supervisor} onChange={set('supervisor')} style={fieldStyle} />
                            </div>
                            <div>
                                {req('Técnico')}
                                <input type="text" required value={form.technician} onChange={set('technician')} style={fieldStyle} />
                            </div>
                        </div>

                        {/* Tipo de Registro */}
                        <div>
                            {req('Tipo de Registro')}
                            <select required value={form.record_type} onChange={set('record_type')} style={fieldStyle}>
                                <option value="">Seleccionar tipo...</option>
                                {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Evento de Seguridad — solo si Tipo = Evento de Seguridad */}
                        {showSecurityEvent && (
                            <div>
                                {req('Evento de Seguridad')}
                                <select required value={form.security_event} onChange={set('security_event')} style={fieldStyle}>
                                    <option value="">Seleccionar evento...</option>
                                    {SECURITY_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Intervención Móvil — solo si Tipo = Intervención Móvil */}
                        {showMobileIntervention && (
                            <div>
                                {req('Intervención Móvil')}
                                <select required value={form.mobile_intervention} onChange={set('mobile_intervention')} style={fieldStyle}>
                                    <option value="">Seleccionar intervención...</option>
                                    {MOBILE_INTERVENTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label style={labelStyle}>Sistema Afectado</label>
                            <input type="text" value={form.affected_system} onChange={set('affected_system')} style={fieldStyle} />
                        </div>

                        <div>
                            {req('Detalle del Registro')}
                            <textarea required value={form.record_detail} onChange={set('record_detail')} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                        </div>

                        <div>
                            {req('Clasificación de Evento')}
                            <select required value={form.event_classification} onChange={set('event_classification')} style={fieldStyle}>
                                <option value="">Seleccionar clasificación...</option>
                                {EVENT_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Fuerza Pública */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                                type="checkbox"
                                id="public_force"
                                checked={form.public_force}
                                onChange={e => setForm(f => ({ ...f, public_force: e.target.checked, complaint_number: '' }))}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <label htmlFor="public_force" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>Fuerza Pública</label>
                        </div>

                        {form.public_force && (
                            <div>
                                <label style={labelStyle}>N° de Denuncia</label>
                                <input type="text" value={form.complaint_number} onChange={set('complaint_number')} style={fieldStyle} />
                            </div>
                        )}

                        <div>
                            <label style={labelStyle}>Fecha y Hora Final</label>
                            <input type="datetime-local" value={form.end_datetime} onChange={set('end_datetime')} style={fieldStyle} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, minWidth: '120px' }}>
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                            <Link href="/seguridad-electronica" style={{ textDecoration: 'none' }}>
                                <button type="button" className="btn btn-secondary">Volver</button>
                            </Link>
                        </div>
                        <button type="button" onClick={() => setForm(makeEmpty(currentUser))} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-start' }}>
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
