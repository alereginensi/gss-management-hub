'use client';

import { useState } from 'react';
import { CheckCircle2, Check, ArrowRight } from 'lucide-react';

const TAREAS_PREDEFINIDAS = [
    'Limpieza de pisos',
    'Limpieza de sanitarios',
    'Limpieza de superficies y escritorios',
    'Vaciado de papeleros',
    'Limpieza de cocina / comedor',
];

type Step = 'cedula' | 'tasks' | 'done';

interface Worker { nombre: string; sector: string; cliente: string; }

export default function RegistroLimpiezaPage() {
    const [step, setStep] = useState<Step>('cedula');
    const [cedula, setCedula] = useState('');
    const [worker, setWorker] = useState<Worker | null>(null);
    const [tareasChecked, setTareasChecked] = useState<boolean[]>(TAREAS_PREDEFINIDAS.map(() => false));
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCedulaSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // 1. Lookup worker
            const res = await fetch(`/api/limpieza/usuarios/lookup?cedula=${encodeURIComponent(cedula.trim())}`);
            if (!res.ok) {
                setError('Tu cédula no está registrada. Contactá a tu supervisor.');
            } else {
                const data = await res.json();
                setWorker(data);
                
                // 2. Lookup today's record for persistence
                try {
                    const recordRes = await fetch(`/api/limpieza/registros/lookup?cedula=${encodeURIComponent(cedula.trim())}`);
                    if (recordRes.ok) {
                        const recordData = await recordRes.json();
                        if (recordData.found && recordData.registro) {
                            const reg = recordData.registro;
                            if (reg.tareas) {
                                try {
                                    const savedTareas: string[] = JSON.parse(reg.tareas);
                                    const newChecked = TAREAS_PREDEFINIDAS.map(t => savedTareas.includes(t));
                                    setTareasChecked(newChecked);
                                } catch (e) {
                                    console.error('Error parsing saved tasks:', e);
                                }
                            }
                            if (reg.observaciones) {
                                setObservaciones(reg.observaciones);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching today record:', err);
                }

                setStep('tasks');
            }
        } catch {
            setError('Error de conexión. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTarea = (i: number) => {
        setTareasChecked(prev => prev.map((v, idx) => idx === i ? !v : v));
    };

    const handleTaskSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const tareasSeleccionadas = TAREAS_PREDEFINIDAS.filter((_, i) => tareasChecked[i]);
            const res = await fetch('/api/limpieza/registros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cedula: cedula.trim(),
                    tareas: JSON.stringify(tareasSeleccionadas),
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

    const handleNuevo = () => {
        setStep('cedula');
        setCedula('');
        setWorker(null);
        setTareasChecked(TAREAS_PREDEFINIDAS.map(() => false));
        setObservaciones('');
        setError('');
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GSS" style={{ height: '40px', marginBottom: '2rem' }} />

            <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '2.25rem 1.75rem' }}>

                {/* STEP: DONE */}
                {step === 'done' && (
                    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                        <CheckCircle2 size={56} color="#22c55e" style={{ marginBottom: '1rem' }} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem' }}>¡Registro enviado!</h2>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Tus tareas fueron guardadas correctamente.</p>
                        <button onClick={handleNuevo} style={{ padding: '0.65rem 1.5rem', backgroundColor: '#1d3461', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>
                            Registrar otro
                        </button>
                    </div>
                )}

                {/* STEP: CEDULA */}
                {step === 'cedula' && (
                    <>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 0.2rem' }}>Registro de Tareas</h1>
                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.75rem' }}>Operaciones de Limpieza</p>

                        {error && (
                            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleCedulaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    Tu Cédula
                                </label>
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
                            <button
                                type="submit"
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: loading ? '#9ca3af' : '#1d3461', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
                            >
                                {loading ? 'Verificando...' : <><span>Continuar</span><ArrowRight size={16} /></>}
                            </button>
                        </form>
                    </>
                )}

                {/* STEP: TASKS */}
                {step === 'tasks' && worker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hola,</span>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: '0' }}>{worker.nombre}</h2>
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.2rem 0 0' }}>{worker.cliente} - {worker.sector}</p>
                        </div>

                        {error && (
                            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleTaskSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', textTransform: 'uppercase' }}>
                                    Tareas realizadas hoy:
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {TAREAS_PREDEFINIDAS.map((t, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => toggleTarea(i)}
                                            style={{ 
                                                display: 'flex', alignItems: 'center', gap: '1rem', 
                                                padding: '1rem', borderRadius: '12px', border: '2px solid',
                                                borderColor: tareasChecked[i] ? '#1d3461' : '#e5e7eb',
                                                backgroundColor: tareasChecked[i] ? 'rgba(29,52,97,0.03)' : '#fff',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <div style={{ 
                                                width: '24px', height: '24px', borderRadius: '6px', border: '2px solid',
                                                borderColor: tareasChecked[i] ? '#1d3461' : '#d1d5db',
                                                backgroundColor: tareasChecked[i] ? '#1d3461' : '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', transition: 'all 0.2s'
                                            }}>
                                                {tareasChecked[i] && <Check size={16} strokeWidth={4} />}
                                            </div>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: tareasChecked[i] ? '#1d3461' : '#374151' }}>{t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    Observaciones
                                </label>
                                <textarea
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                    placeholder=""
                                    style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: '#fff', color: '#111827', minHeight: '100px', boxSizing: 'border-box', outline: 'none' }}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !tareasChecked.some(v => v)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', backgroundColor: (loading || !tareasChecked.some(v => v)) ? '#9ca3af' : '#1d3461', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
                            >
                                {loading ? 'Enviando...' : 'Finalizar Registro'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
