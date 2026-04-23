'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Download, CheckCircle, AlertTriangle, X as CloseIcon, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import type { ImportResult } from '@/lib/agenda-types';

type ImportType = 'employees' | 'articles_migration';

const IMPORT_TYPES: { value: ImportType; label: string; desc: string }[] = [
  { value: 'employees', label: 'Empleados', desc: 'Alta masiva o actualización de empleados desde Excel/CSV. Idempotente: UPSERT por documento.' },
  { value: 'articles_migration', label: 'Migración histórica de artículos', desc: 'Cargar prendas ya entregadas antes del sistema. Los empleados deben existir en la DB.' },
];

export default function ImportacionesPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [importType, setImportType] = useState<ImportType>('employees');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendToIngresos, setSendToIngresos] = useState(false);

  useEffect(() => {
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setError(null);
    setSendToIngresos(false);
  }, [importType]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setPreviewData(null);
    setResult(null);
    setError(null);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];

          // 1. Detección inteligente de cabecera mediante sistema de puntuación
          const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
          const keywords = ['documento', 'nombre', 'ci', 'cedula', 'puesto', 'sector', 'empresa', 'articulo', 'prenda', 'habilitado', 'estado'];
          let headerIndex = 0;
          let maxScore = -1;

          for (let i = 0; i < Math.min(matrix.length, 30); i++) {
            const row = matrix[i];
            if (!row || !Array.isArray(row)) continue;
            
            let currentScore = 0;
            row.forEach(cell => {
              const c = String(cell || '').toLowerCase().trim();
              if (!c) return;
              if (keywords.includes(c)) {
                currentScore += 2;
              } else if (keywords.some(k => c.includes(k) && c.length < 25)) {
                currentScore += 1;
              }
            });

            if (currentScore > maxScore) {
              maxScore = currentScore;
              headerIndex = i;
            }
          }

          if (maxScore <= 1) headerIndex = 0;

          // 2. Parsear desde la cabecera detectada
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, range: headerIndex });
          if (raw.length > 0) {
            const allHeaders = (raw[0] as any[]).map(h => String(h || ''));
            
            // Si es importación de empleados, podemos resaltar/filtrar los campos que pidió el usuario
            // Aunque mostramos todo el excel para que vea qué está subiendo
            const rows = raw.slice(1, 101);
            setPreviewData({ headers: allHeaders, rows });
          } else {
            setError('El archivo parece estar vacío.');
          }
        } catch (err) {
          console.error('Error parsing file:', err);
          setError('No se pudo leer el archivo. Asegúrese de que sea un Excel o CSV válido.');
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setError(null);
    const input = document.getElementById('import-file') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', importType);
      if (importType === 'employees' && sendToIngresos) {
        fd.append('send_to_ingresos', 'true');
      }
      const res = await fetch('/api/logistica/agenda/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error en la importación'); return; }
      setResult(data);
    } finally {
      setUploading(false);
    }
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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Importaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            <Upload size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Importación masiva
          </h1>

          {/* Tipo de importación */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Tipo de importación</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {IMPORT_TYPES.map(t => (
                <label key={t.value} style={{
                  display: 'flex', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', borderRadius: '8px', border: '2px solid',
                  borderColor: importType === t.value ? '#1e40af' : '#e2e8f0',
                  background: importType === t.value ? '#eff6ff' : 'white',
                }}>
                  <input type="radio" value={t.value} checked={importType === t.value} onChange={() => setImportType(t.value)} style={{ marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{t.label}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.1rem' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Plantilla y upload */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Archivo</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <a href={`/api/logistica/agenda/import/template?type=${importType}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#1e40af', textDecoration: 'none', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.4rem 0.8rem', background: '#eff6ff' }}>
                <Download size={13} /> Descargar plantilla (.xlsx)
              </a>
            </div>
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', position: 'relative' }}
              onClick={() => !file && document.getElementById('import-file')?.click()}>
              <input id="import-file" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={handleFileChange} />
              {file
                ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{file.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); clearFile(); }} style={{ background: '#fee2e2', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                      <CloseIcon size={14} />
                    </button>
                  </div>
                )
                : <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Clic para seleccionar archivo Excel (.xlsx, .xls) o CSV</div>}
            </div>

            {importType === 'employees' && (
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer',
                marginTop: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '8px',
                border: `2px solid ${sendToIngresos ? '#059669' : '#e2e8f0'}`,
                background: sendToIngresos ? '#ecfdf5' : '#f8fafc',
              }}>
                <input type="checkbox" checked={sendToIngresos} onChange={e => setSendToIngresos(e.target.checked)} style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#065f46' }}>Enviar todos a Nuevos Ingresos</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Crea un turno pendiente (is_ingreso) para cada empleado usando su <code>fecha_ingreso</code>.
                    Logística los completará desde <strong>/admin/ingresos</strong>. Se omiten filas sin fecha válida.
                  </div>
                </div>
              </label>
            )}

            {error && <div style={{ marginTop: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem', fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                onClick={handleUpload} 
                disabled={!file || uploading} 
                className="btn btn-primary" 
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: previewData ? '#10b981' : undefined }}
              >
                {uploading ? (
                  <>Procesando...</>
                ) : previewData ? (
                  <><CheckCircle size={14} /> Confirmar e Importar</>
                ) : (
                  <><Upload size={13} /> Importar</>
                )}
              </button>
            </div>
          </div>

          {/* Previsualización */}
          {previewData && !result && (
            <div className="card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileSpreadsheet size={16} /> Vista previa (primeros {previewData.rows.length} registros)
                </h3>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {previewData.headers.map((h, i) => (
                        <th key={i} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {previewData.headers.map((_, j) => (
                          <td key={j} style={{ padding: '0.4rem 0.75rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
                            {String(row[j] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                * Verifique que las columnas coincidan con los datos esperados antes de confirmar.
              </p>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Resultado</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[
                  { label: 'Total procesadas', value: result.processed, color: '#374151', bg: '#f8fafc' },
                  { label: 'Exitosas', value: result.successful, color: '#065f46', bg: '#d1fae5' },
                  { label: 'Con errores', value: result.failed, color: '#7f1d1d', bg: '#fee2e2' },
                  ...(result.ingresosCreated !== undefined ? [
                    { label: 'Ingresos pendientes creados', value: result.ingresosCreated, color: '#92400e', bg: '#fef3c7' },
                  ] : []),
                  ...(result.ingresosSkipped !== undefined && result.ingresosSkipped > 0 ? [
                    { label: 'Ingresos omitidos', value: result.ingresosSkipped, color: '#475569', bg: '#f1f5f9' },
                  ] : []),
                ].map(s => (
                  <div key={s.label} style={{ flex: '1 1 100px', textAlign: 'center', padding: '0.75rem', borderRadius: '8px', background: s.bg }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {result.errors.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} /> Importación completada sin errores.
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <AlertTriangle size={15} /> Filas con error:
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '6px' }}>
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
