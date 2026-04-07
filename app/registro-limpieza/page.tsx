'use client';

import { useState, useRef } from 'react';
import { CheckCircle2, Check, ArrowRight, Camera, X, PenLine, UserX } from 'lucide-react';

const TAREAS_POR_CLIENTE: Record<string, string[]> = {
    'schmidth': [
        'Oficinas',
        'Oficina de RRHH',
        'Directorio',
        'Gerencia',
        'Sala de reuniones',
        'Escalera',
        'Comedor',
        'Vestuarios',
        'Baños',
    ],
    'default': [
        'Limpieza de pisos',
        'Limpieza de sanitarios',
        'Limpieza de superficies y escritorios',
        'Vaciado de papeleros',
        'Limpieza de cocina / comedor',
    ],
};

function getTareasForCliente(cliente: string): string[] {
    const key = Object.keys(TAREAS_POR_CLIENTE).find(
        k => k !== 'default' && k.toLowerCase() === (cliente || '').toLowerCase().trim()
    );
    return key ? TAREAS_POR_CLIENTE[key] : TAREAS_POR_CLIENTE['default'];
}

type Step = 'cedula' | 'already_done' | 'tasks' | 'done';
interface Worker { nombre: string; sector: string; cliente: string; }

export default function RegistroLimpiezaPage() {
    const [step, setStep] = useState<Step>('cedula');
    const [cedula, setCedula] = useState('');
    const [worker, setWorker] = useState<Worker | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [existingTareas, setExistingTareas] = useState<string[]>([]);
    const [tareas, setTareas] = useState<string[]>([]);
    const [tareasTimestamps, setTareasTimestamps] = useState<Record<string, string>>({});
    const [tareasFotos, setTareasFotos] = useState<Record<string, string[]>>({});
    const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [photoTarget, setPhotoTarget] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [assignedTareas, setAssignedTareas] = useState<string[]>([]);

    const resetToStart = () => {
        setStep('cedula');
        setCedula('');
        setWorker(null);
        setIsEditing(false);
        setExistingTareas([]);
        setTareas([]);
        setTareasTimestamps({});
        setTareasFotos({});
        setObservaciones('');
        setError('');
        setAssignedTareas([]);
    };

    const handleCedulaSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`/api/limpieza/usuarios/lookup?cedula=${encodeURIComponent(cedula.trim())}`);
            if (!res.ok) {
                setError('Tu cédula no está registrada. Contactá a tu supervisor.');
                setLoading(false);
                return;
            }

            const data = await res.json();
            setWorker(data);

            // Fetch supervisor-assigned tasks for today
            const hoy = new Date().toISOString().split('T')[0];
            try {
                const aRes = await fetch(
                    `/api/limpieza/tareas-asignadas?cedula=${encodeURIComponent(cedula.trim())}&fecha=${hoy}&cliente=${encodeURIComponent(data.cliente || '')}&sector=${encodeURIComponent(data.sector || '')}`
                );
                if (aRes.ok) {
                    const aData = await aRes.json();
                    if (aData.length > 0) {
                        const all: string[] = [];
                        aData.forEach((a: any) => {
                            try { JSON.parse(a.tareas).forEach((t: string) => { if (!all.includes(t)) all.push(t); }); } catch {}
                        });
                        setAssignedTareas(all);
                    }
                }
            } catch {}

            const tareasCliente = getTareasForCliente(data.cliente || '');

            // Check if there is already a record for today
            try {
                const recordRes = await fetch(`/api/limpieza/registros/lookup?cedula=${encodeURIComponent(cedula.trim())}`);
                if (recordRes.ok) {
                    const recordData = await recordRes.json();
                    if (recordData.found && recordData.registro) {
                        const reg = recordData.registro;
                        // Pre-load saved data for potential editing
                        if (reg.tareas) {
                            try {
                                const saved: string[] = JSON.parse(reg.tareas);
                                const filtered = saved.filter((t: string) => tareasCliente.includes(t));
                                setTareas(filtered);
                                setExistingTareas(filtered);
                            } catch {}
                        }
                        if (reg.tareas_timestamps) {
                            try { setTareasTimestamps(JSON.parse(reg.tareas_timestamps)); } catch {}
                        }
                        if (reg.fotos) {
                            try { setTareasFotos(JSON.parse(reg.fotos)); } catch {}
                        }
                        if (reg.observaciones) setObservaciones(reg.observaciones);
                        // Already registered today — show blocking screen
                        setStep('already_done');
                        setLoading(false);
                        return;
                    }
                }
            } catch {}

            setStep('tasks');
        } catch {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTarea = (t: string) => {
        setTareas(prev => {
            if (prev.includes(t)) {
                setTareasTimestamps(ts => { const n = { ...ts }; delete n[t]; return n; });
                return prev.filter(x => x !== t);
            } else {
                const hhmm = new Date().toTimeString().slice(0, 5);
                setTareasTimestamps(ts => ({ ...ts, [t]: hhmm }));
                return [...prev, t];
            }
        });
    };

    const handlePhotoClick = (tarea: string) => {
        setPhotoTarget(tarea);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !photoTarget) return;
        e.target.value = '';
        setUploadingPhoto(photoTarget);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/limpieza/upload', { method: 'POST', body: fd });
            if (res.ok) {
                const { url } = await res.json();
                setTareasFotos(prev => ({
                    ...prev,
                    [photoTarget]: [...(prev[photoTarget] || []), url]
                }));
            } else {
                setError('Error al subir la foto. Intentá de nuevo.');
            }
        } catch {
            setError('Error al subir la foto.');
        } finally {
            setUploadingPhoto(null);
            setPhotoTarget(null);
        }
    };

    const removePhoto = (tarea: string, idx: number) => {
        setTareasFotos(prev => ({
            ...prev,
            [tarea]: prev[tarea].filter((_, i) => i !== idx)
        }));
    };

    const handleTaskSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/limpieza/registros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cedula: cedula.trim(),
                    tareas: JSON.stringify(tareas),
                    tareas_timestamps: JSON.stringify(tareasTimestamps),
                    fotos: JSON.stringify(tareasFotos),
                    observaciones: observaciones || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Error al enviar.');
            } else {
                setStep('done');
            }
        } catch {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const tareasCliente = assignedTareas.length > 0
        ? assignedTareas
        : (worker ? getTareasForCliente(worker.cliente || '') : []);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GSS" style={{ height: '40px', marginBottom: '2rem' }} />

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '2.25rem 1.75rem' }}>

                {/* DONE */}
                {step === 'done' && (
                    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                        <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: '1rem' }} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem' }}>
                            {isEditing ? `Actualizado, ${worker?.nombre?.split(' ')[0]}!` : `¡Listo, ${worker?.nombre?.split(' ')[0]}!`}
                        </h2>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
                            {isEditing ? 'Tu registro fue actualizado correctamente.' : 'Tus tareas fueron registradas correctamente.'}
                        </p>
                        <p style={{ color: '#1d3461', fontSize: '1rem', fontWeight: 700, margin: '0' }}>¡Buen descanso!</p>
                    </div>
                )}

                {/* ALREADY DONE */}
                {step === 'already_done' && worker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <CheckCircle2 size={44} color="#22c55e" style={{ marginBottom: '0.75rem' }} />
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: '0 0 0.2rem' }}>
                                Ya registraste hoy, {worker.nombre.split(' ')[0]}
                            </h2>
                            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>
                                {worker.cliente} — {worker.sector}
                            </p>
                        </div>

                        {existingTareas.length > 0 && (
                            <div style={{ backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '0.85rem 1rem', border: '1px solid #bbf7d0' }}>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>Tareas registradas</p>
                                <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {existingTareas.map(t => (
                                        <li key={t} style={{ fontSize: '0.88rem', color: '#166534' }}>{t}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
                            <button
                                onClick={() => { setIsEditing(true); setStep('tasks'); }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem', backgroundColor: '#1d3461', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                <PenLine size={16} /> Editar mis tareas
                            </button>
                            <button
                                onClick={resetToStart}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                <UserX size={15} /> No soy yo
                            </button>
                        </div>
                    </div>
                )}

                {/* CEDULA */}
                {step === 'cedula' && (
                    <>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 0.2rem' }}>Registro de Tareas</h1>
                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.75rem' }}>Operaciones Limpieza/Seguridad</p>

                        {error && <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

                        <form onSubmit={handleCedulaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tu Cédula</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cedula}
                                    onChange={e => setCedula(e.target.value)}
                                    placeholder="Ingrese su cédula"
                                    required
                                    autoFocus
                                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: '#fff', color: '#111827', boxSizing: 'border-box' }}
                                />
                            </div>
                            <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: loading ? '#9ca3af' : '#1d3461', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? 'Verificando...' : <><span>Continuar</span><ArrowRight size={16} /></>}
                            </button>
                        </form>
                    </>
                )}

                {/* TASKS */}
                {step === 'tasks' && worker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {isEditing ? 'Editando registro —' : 'Hola,'}
                            </span>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: '0' }}>{worker.nombre}</h2>
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.2rem 0 0' }}>{worker.cliente} - {worker.sector}</p>
                            {assignedTareas.length > 0 && (
                                <span style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', backgroundColor: 'rgba(29,52,97,0.1)', color: '#1d3461' }}>
                                    Tareas asignadas por supervisor
                                </span>
                            )}
                        </div>

                        {error && <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>{error}</div>}

                        <form onSubmit={handleTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', textTransform: 'uppercase' }}>Tareas realizadas hoy:</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {tareasCliente.map((t) => {
                                        const checked = tareas.includes(t);
                                        const timestamp = tareasTimestamps[t];
                                        const fotos = tareasFotos[t] || [];
                                        const uploading = uploadingPhoto === t;
                                        return (
                                            <div key={t} style={{ borderRadius: '12px', border: '2px solid', borderColor: checked ? '#1d3461' : '#e5e7eb', backgroundColor: checked ? 'rgba(29,52,97,0.03)' : '#fff', overflow: 'hidden' }}>
                                                <div onClick={() => toggleTarea(t)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer', userSelect: 'none' }}>
                                                    <div style={{ width: '24px', height: '24px', flexShrink: 0, borderRadius: '6px', border: '2px solid', borderColor: checked ? '#1d3461' : '#d1d5db', backgroundColor: checked ? '#1d3461' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.15s' }}>
                                                        {checked && <Check size={16} strokeWidth={4} />}
                                                    </div>
                                                    <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: checked ? '#1d3461' : '#374151' }}>{t}</span>
                                                    {checked && timestamp && <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>{timestamp}</span>}
                                                </div>

                                                {checked && (
                                                    <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'rgba(29,52,97,0.02)' }}>
                                                        {fotos.map((src, idx) => (
                                                            <div key={idx} style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0 }}>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={src} alt="foto" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                                                <button type="button" onClick={() => removePhoto(t, idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ef4444', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                                                    <X size={10} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePhotoClick(t)}
                                                            disabled={uploading}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', border: '1px dashed #94a3b8', borderRadius: '8px', backgroundColor: 'transparent', color: uploading ? '#9ca3af' : '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer' }}
                                                        >
                                                            <Camera size={14} /> {uploading ? 'Subiendo...' : 'Foto'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Observaciones</label>
                                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: '#fff', color: '#111827', minHeight: '100px', boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                    type="submit"
                                    disabled={loading || tareas.length === 0 || !!uploadingPhoto}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', backgroundColor: (loading || tareas.length === 0 || !!uploadingPhoto) ? '#9ca3af' : '#1d3461', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {loading ? 'Enviando...' : isEditing ? 'Actualizar Registro' : 'Finalizar Registro'}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('already_done')}
                                        style={{ padding: '0.6rem', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
