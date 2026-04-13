'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Download, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import type { ImportResult } from '@/lib/agenda-types';

export default function MigracionPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !['admin', 'logistica', 'jefe'].includes(currentUser.role)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setResult(null); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'articles_migration');
      const res = await fetch('/api/logistica/agenda/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error en la migración'); return; }
      setResult(data);
    } finally { setUploading(false); }
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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Migración Histórica</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            <Database size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Migración de datos históricos
          </h1>

          {/* Advertencia */}
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.1rem' }} />
            <div style={{ fontSize: '0.82rem', color: '#78350f' }}>
              <strong>Esta función carga prendas entregadas ANTES del sistema.</strong><br />
              Cada fila del archivo crea un artículo en el inventario con origen <em>migración</em>.<br />
              Los empleados deben existir previamente (usar Importar Empleados primero).<br />
              El proceso es idempotente por empleado+artículo+fecha, pero puede crear duplicados si se importa el mismo archivo dos veces.
            </div>
          </div>

          {/* Plantilla */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Formato requerido</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem' }}>
              El archivo Excel debe incluir las columnas: <strong>documento</strong>, <strong>article_type</strong>, <strong>delivery_date</strong> (YYYY-MM-DD). Opcionales: size, useful_life_months (default 12), condition_status, notes.
            </p>
            <a href="/api/logistica/agenda/import/template?type=articles_migration"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#1e40af', textDecoration: 'none', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.4rem 0.8rem', background: '#eff6ff' }}>
              <Download size={13} /> Descargar plantilla (.xlsx)
            </a>
          </div>

          {/* Upload */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Cargar archivo</h3>
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: '0.75rem' }}
              onClick={() => document.getElementById('mig-file')?.click()}>
              <input id="mig-file" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(null); }} />
              {file
                ? <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>
                : <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Clic para seleccionar archivo Excel o CSV</div>}
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleUpload} disabled={!file || uploading} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Upload size={13} /> {uploading ? 'Migrando...' : 'Iniciar migración'}
              </button>
            </div>
          </div>

          {/* Resultado */}
          {result && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Resultado de la migración</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[
                  { label: 'Total filas', value: result.processed, color: '#374151', bg: '#f8fafc' },
                  { label: 'Migradas', value: result.successful, color: '#065f46', bg: '#d1fae5' },
                  { label: 'Con error', value: result.failed, color: '#7f1d1d', bg: '#fee2e2' },
                ].map(s => (
                  <div key={s.label} style={{ flex: '1 1 100px', textAlign: 'center', padding: '0.75rem', borderRadius: '8px', background: s.bg }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {result.errors.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} /> Migración completada sin errores. Ve a <Link href="/logistica/agenda/admin/articulos" style={{ color: '#1e40af' }}>Artículos</Link> para verificar.
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7f1d1d', marginBottom: '0.5rem' }}>Filas con error:</div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#fef2f2' }}>
                          <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: '#7f1d1d', borderBottom: '1px solid #fecaca' }}>Fila</th>
                          <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: '#7f1d1d', borderBottom: '1px solid #fecaca' }}>Campo</th>
                          <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: '#7f1d1d', borderBottom: '1px solid #fecaca' }}>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #fef2f2' }}>
                            <td style={{ padding: '0.4rem 0.6rem' }}>{e.row}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{e.field || '—'}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: '#7f1d1d' }}>{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
