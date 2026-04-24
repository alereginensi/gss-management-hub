'use client';

import { useMemo, useState } from 'react';
import { Plus, Upload, Download } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import { useLicenciasApi } from './hooks/useLicenciasApi';
import { SECTORES, TIPOS_LICENCIA } from '@/lib/licencias-helpers';
import StatsBar from './components/StatsBar';
import TablaLicencias from './components/TablaLicencias';
import ModalNueva from './components/ModalNueva';
import ModalImportar from './components/ModalImportar';
import { exportarLicencias } from './utils/exportarLicencias';

export default function LicenciasModule() {
  const { currentUser } = useTicketContext();
  const isAdmin = currentUser?.role === 'admin';
  const { licencias, loading, error, guardandoIds, actualizarCampo, crear, eliminar, importar, previewImport } = useLicenciasApi();

  const [search, setSearch] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'completas' | 'pendientes'>('todas');
  const [modalNueva, setModalNueva] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return licencias.filter((l) => {
      if (filtroSector && l.sector !== filtroSector) return false;
      if (filtroTipo && l.tipoLicencia !== filtroTipo) return false;
      if (filtroEstado !== 'todas') {
        const completa = l.recepNotificacion && l.supervision && l.recepCertificado && l.planificacion;
        if (filtroEstado === 'completas' && !completa) return false;
        if (filtroEstado === 'pendientes' && completa) return false;
      }
      if (q && !l.funcionario.toLowerCase().includes(q) && !l.padron.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [licencias, search, filtroSector, filtroTipo, filtroEstado]);

  const remitentes = useMemo(() => {
    const s = new Set<string>();
    for (const l of licencias) if (l.remitente) s.add(l.remitente);
    return [...s].sort();
  }, [licencias]);

  return (
    <div className="licencias-module">
      <StatsBar licencias={filtradas} />

      <div className="lic-toolbar">
        <div className="lic-toolbar-filters">
          <input
            type="search"
            className="lic-input"
            placeholder="Buscar funcionario o padrón…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select className="lic-select" value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)}>
            <option value="">Todos los sectores</option>
            {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="lic-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS_LICENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="lic-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as 'todas' | 'completas' | 'pendientes')}>
            <option value="todas">Todas</option>
            <option value="pendientes">Solo pendientes</option>
            <option value="completas">Solo completas</option>
          </select>
        </div>
        <div className="lic-toolbar-actions">
          <button type="button" className="lic-btn" onClick={() => exportarLicencias(filtradas)}>
            <Download size={14} /> Excel
          </button>
          {isAdmin && (
            <button type="button" className="lic-btn" onClick={() => setModalImportar(true)}>
              <Upload size={14} /> Importar
            </button>
          )}
          <button type="button" className="lic-btn lic-btn--primary" onClick={() => setModalNueva(true)}>
            <Plus size={14} /> Nueva
          </button>
        </div>
      </div>

      {loading && <div className="lic-loading">Cargando…</div>}
      {error && <div className="lic-error">{error}</div>}

      {!loading && (
        <TablaLicencias
          licencias={filtradas}
          guardandoIds={guardandoIds}
          onActualizar={actualizarCampo}
          onEliminar={eliminar}
        />
      )}

      {modalNueva && (
        <ModalNueva
          remitentes={remitentes}
          onCerrar={() => setModalNueva(false)}
          onCrear={async (data) => { await crear(data); }}
        />
      )}
      {modalImportar && (
        <ModalImportar
          onCerrar={() => setModalImportar(false)}
          onPreview={previewImport}
          onImportar={importar}
        />
      )}
    </div>
  );
}
