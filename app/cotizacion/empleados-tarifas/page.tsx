'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, LogOut, ChevronRight, X } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface Category { id: number; name: string; description: string | null; active: number; }
interface Rate { id: number; category_id: number; rate: string; overtime_multiplier: string; social_security_pct: string; bonus_provisions_pct: string; valid_from: string; valid_to: string | null; notes: string | null; }

const EMPTY_RATE = { rate: '', overtime_multiplier: '1.5', social_security_pct: '0', bonus_provisions_pct: '0', valid_from: new Date().toISOString().split('T')[0], notes: '' };

export default function EmpleadosTarifasPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [rates, setRates] = useState<Rate[]>([]);
    const [selectedCat, setSelectedCat] = useState<Category | null>(null);
    const [showCatModal, setShowCatModal] = useState(false);
    const [showRateModal, setShowRateModal] = useState(false);
    const [catName, setCatName] = useState('');
    const [catDesc, setCatDesc] = useState('');
    const [rateForm, setRateForm] = useState(EMPTY_RATE);
    const [saving, setSaving] = useState(false);

    const getAuthHeaders = (): HeadersInit => {
        return { 'Content-Type': 'application/json' };
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'contador') { router.push('/'); return; }
        fetchCategories();
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchCategories = async () => {
        const res = await fetch('/api/cotizacion/categories', { headers: getAuthHeaders() });
        if (res.ok) setCategories(await res.json());
    };

    const fetchRates = async (catId: number) => {
        const res = await fetch(`/api/cotizacion/rates?categoryId=${catId}`, { headers: getAuthHeaders() });
        if (res.ok) setRates(await res.json());
    };

    const selectCategory = (cat: Category) => { setSelectedCat(cat); fetchRates(cat.id); };

    const toggleActive = async (cat: Category) => {
        await fetch(`/api/cotizacion/categories/${cat.id}`, {
            method: 'PUT', headers: getAuthHeaders(),
            body: JSON.stringify({ name: cat.name, description: cat.description, active: cat.active ? 0 : 1 })
        });
        fetchCategories();
        if (selectedCat?.id === cat.id) setSelectedCat({ ...cat, active: cat.active ? 0 : 1 });
    };

    const createCategory = async () => {
        if (!catName.trim()) return;
        setSaving(true);
        const res = await fetch('/api/cotizacion/categories', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name: catName.trim(), description: catDesc }) });
        setSaving(false);
        if (res.ok) { setShowCatModal(false); setCatName(''); setCatDesc(''); fetchCategories(); }
    };

    const createRate = async () => {
        if (!selectedCat || !rateForm.rate || !rateForm.valid_from) return;
        setSaving(true);
        const res = await fetch('/api/cotizacion/rates', {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ category_id: selectedCat.id, ...rateForm })
        });
        setSaving(false);
        if (res.ok) { setShowRateModal(false); setRateForm(EMPTY_RATE); fetchRates(selectedCat.id); }
    };

    if (loading || !currentUser) return null;

    const catRates = selectedCat ? rates.filter(r => r.category_id === selectedCat.id) : [];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/cotizacion" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Comercial
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main className="standalone-page" style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1000px', width: '100%', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Empleados y Tarifas</h1>
                    <button onClick={() => setShowCatModal(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <Plus size={15} /> Nueva Categoría
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
                    {/* Categories panel */}
                    <div className="card" style={{ padding: '0.75rem', height: 'fit-content' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.4rem 0.5rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categorías</div>
                        {categories.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.5rem' }}>No hay categorías.</p>
                        ) : categories.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => selectCategory(cat)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderRadius: '6px', cursor: 'pointer', backgroundColor: selectedCat?.id === cat.id ? 'rgba(var(--primary-rgb, 41,65,107), 0.08)' : 'transparent', marginBottom: '0.15rem' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: cat.active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: selectedCat?.id === cat.id ? 600 : 400 }}>{cat.name}</span>
                                    {!cat.active && <span style={{ fontSize: '0.65rem', color: '#94a3b8', backgroundColor: '#f1f5f9', borderRadius: '4px', padding: '0.1rem 0.3rem' }}>inactiva</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleActive(cat); }}
                                        style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                    >{cat.active ? 'Desactivar' : 'Activar'}</button>
                                    <ChevronRight size={14} color="var(--text-secondary)" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Rates panel */}
                    <div>
                        {!selectedCat ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Seleccioná una categoría para ver su historial de tarifas.</div>
                        ) : (
                            <div className="card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCat.name}</div>
                                        {selectedCat.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedCat.description}</div>}
                                    </div>
                                    <button onClick={() => setShowRateModal(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                                        <Plus size={14} /> Nueva Tarifa
                                    </button>
                                </div>

                                {catRates.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>No hay tarifas registradas para esta categoría.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Tarifa/h</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Mult. OT</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Cargas %</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Vigente desde</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Hasta</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 500 }}>Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {catRates.map(r => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.5rem', fontWeight: r.valid_to === null ? 700 : 400, color: r.valid_to === null ? 'var(--text-primary)' : 'var(--text-secondary)' }}>${parseFloat(r.rate).toLocaleString('es-UY')}</td>
                                                    <td style={{ padding: '0.5rem' }}>{r.overtime_multiplier}×</td>
                                                    <td style={{ padding: '0.5rem' }}>{parseFloat(r.social_security_pct) + parseFloat(r.bonus_provisions_pct)}%</td>
                                                    <td style={{ padding: '0.5rem' }}>{r.valid_from}</td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        {r.valid_to ? r.valid_to : <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.75rem' }}>VIGENTE</span>}
                                                    </td>
                                                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{r.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* New Category Modal */}
            {showCatModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ padding: '1.5rem', width: '360px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Nueva Categoría</h3>
                            <button onClick={() => setShowCatModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Nombre *</label>
                        <input value={catName} onChange={e => setCatName(e.target.value)} className="form-control" style={{ width: '100%', marginBottom: '0.75rem' }} placeholder="Ej: Seguridad Física" />
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Descripción</label>
                        <input value={catDesc} onChange={e => setCatDesc(e.target.value)} className="form-control" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Opcional" />
                        <button onClick={createCategory} disabled={saving || !catName.trim()} className="btn" style={{ width: '100%' }}>{saving ? 'Guardando...' : 'Crear Categoría'}</button>
                    </div>
                </div>
            )}

            {/* New Rate Modal */}
            {showRateModal && selectedCat && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ padding: '1.5rem', width: '420px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Nueva Tarifa — {selectedCat.name}</h3>
                            <button onClick={() => setShowRateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            {[
                                { label: 'Tarifa por hora *', key: 'rate', placeholder: '0.00' },
                                { label: 'Multiplicador horas extra', key: 'overtime_multiplier', placeholder: '1.5' },
                                { label: '% Cargas sociales', key: 'social_security_pct', placeholder: '0' },
                                { label: '% Previsiones', key: 'bonus_provisions_pct', placeholder: '0' },
                            ].map(({ label, key, placeholder }) => (
                                <div key={key}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>{label}</label>
                                    <input
                                        type="number" step="0.01"
                                        value={(rateForm as any)[key]}
                                        onChange={e => setRateForm(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="form-control"
                                        placeholder={placeholder}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            ))}
                        </div>
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Vigente desde *</label>
                        <input type="date" value={rateForm.valid_from} onChange={e => setRateForm(prev => ({ ...prev, valid_from: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.75rem' }} />
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Notas</label>
                        <input value={rateForm.notes} onChange={e => setRateForm(prev => ({ ...prev, notes: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Opcional" />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>La tarifa actualmente vigente se cerrará automáticamente.</p>
                        <button onClick={createRate} disabled={saving || !rateForm.rate || !rateForm.valid_from} className="btn" style={{ width: '100%' }}>{saving ? 'Guardando...' : 'Guardar Tarifa'}</button>
                    </div>
                </div>
            )}

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
