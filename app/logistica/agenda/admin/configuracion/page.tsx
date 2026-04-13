'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Save, Download } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];

export default function ConfiguracionPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [config, setConfig] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = currentUser?.role === 'admin';

  // Export state
  const [exportType, setExportType] = useState('citas');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportEmpresa, setExportEmpresa] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !['admin', 'logistica', 'jefe'].includes(currentUser.role)) { router.push('/'); return; }
    fetchConfig();
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchConfig = async () => {
    const res = await fetch('/api/logistica/agenda/config');
    if (res.ok) {
      const data = await res.json();
      setConfig(data);
      setForm(data);
    }
  };

  const handleSave = async () => {
    setSaving(true); setSuccess(null); setError(null);
    try {
      const res = await fetch('/api/logistica/agenda/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      setConfig(data);
      setForm(data);
      setSuccess('Configuración guardada');
      setTimeout(() => setSuccess(null), 3000);
    } finally { setSaving(false); }
  };

  const handleExport = () => {
    const p = new URLSearchParams({ type: exportType });
    if (exportFrom) p.set('from', exportFrom);
    if (exportTo) p.set('to', exportTo);
    if (exportEmpresa) p.set('empresa', exportEmpresa);
    window.open(`/api/logistica/agenda/export?${p}`, '_blank');
  };

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ' Admin'}
          </Link>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Configuración</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Configuración del módulo Agenda
          </h1>

          {/* Config (solo admin puede editar) */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Parámetros globales</h3>
            {!isAdmin && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#78350f' }}>
                Solo administradores pueden modificar estos parámetros.
              </div>
            )}
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{error}</div>}
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#166534' }}>{success}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              {[
                { label: 'Anticipación mínima para reserva (horas)', key: 'min_advance_hours', type: 'number', min: 0, hint: 'El empleado no puede reservar con menos de X horas de anticipación.' },
                { label: 'Duración del hold temporal (segundos)', key: 'hold_duration_seconds', type: 'number', min: 10, hint: 'Tiempo que se reserva un slot mientras el empleado confirma.' },
                { label: 'Duración de cada slot (minutos)', key: 'slot_duration_minutes', type: 'number', min: 5, hint: 'Usado al auto-generar slots.' },
                { label: 'Slots por día (para auto-generar)', key: 'slots_per_day', type: 'number', min: 1, hint: 'Cantidad de turnos a generar por día habilitado.' },
                { label: 'Día del mes para auto-generar siguiente mes', key: 'auto_generate_day', type: 'number', min: 1, max: 28, hint: 'Día en que el cron genera los slots del mes siguiente.' },
              ].map(({ label, key, type, min, max, hint }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{label}</label>
                  <input
                    type={type} min={min} max={max}
                    value={form[key] ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value }))}
                    disabled={!isAdmin}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', background: !isAdmin ? '#f8fafc' : 'white' }}
                  />
                  {hint && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>{hint}</div>}
                </div>
              ))}

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Link de WhatsApp para empleados no habilitados</label>
                <input
                  type="text" value={form.public_contact_whatsapp ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, public_contact_whatsapp: e.target.value }))}
                  disabled={!isAdmin}
                  placeholder="https://wa.me/598..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', background: !isAdmin ? '#f8fafc' : 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isAdmin ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={!!form.allow_reorder_global} disabled={!isAdmin}
                    onChange={e => setForm((f: any) => ({ ...f, allow_reorder_global: e.target.checked ? 1 : 0 }))} />
                  Permitir reorden global (todos los empleados pueden reordenar prendas previas)
                </label>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Save size={13} /> {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            )}
          </div>

          {/* Exportaciones */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Exportar datos a Excel</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Tipo de exportación</label>
                <select value={exportType} onChange={e => setExportType(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="citas">Citas</option>
                  <option value="empleados">Empleados</option>
                  <option value="entregas">Entregas / Artículos</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Empresa (opcional)</label>
                <select value={exportEmpresa} onChange={e => setExportEmpresa(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="">Todas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              {exportType !== 'empleados' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Desde</label>
                    <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Hasta</label>
                    <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={handleExport} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Download size={13} /> Exportar Excel
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
