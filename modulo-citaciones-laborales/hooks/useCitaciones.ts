/**
 * hooks/useCitaciones.ts
 * Hook principal. Contiene toda la lógica del módulo.
 * Los componentes solo consumen este hook.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Citacion,
  CitacionFormData,
  CitacionesStats,
  EstadoCitacion,
  FORM_EMPTY,
} from '../types/citacion';
import * as api from '../api/citaciones.api';
import { sumFacturas } from '../utils/format';

export function useCitaciones() {
  const [citaciones, setCitaciones] = useState<Citacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [tabActiva, setTabActiva] = useState<EstadoCitacion | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroOrg, setFiltroOrg] = useState<'MTSS' | 'Juzgado' | ''>('');

  // Drawer
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CitacionFormData>(FORM_EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  // PDF: archivo pendiente de subir (al guardar la citación) + estado de parseo
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfExistingFilename, setPdfExistingFilename] = useState<string | null>(null);
  const [pdfDetectedFields, setPdfDetectedFields] = useState<string[]>([]);
  const [pdfWarningFields, setPdfWarningFields] = useState<string[]>([]);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAll();
      setCitaciones(data);
    } catch {
      setError('Error al cargar citaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const citacionesFiltradas = citaciones.filter((c) => {
    if (tabActiva !== 'todas' && c.estado !== tabActiva) return false;
    if (filtroOrg && c.org !== filtroOrg) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (
        !c.empresa.toLowerCase().includes(q) &&
        !c.trabajador.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: CitacionesStats = {
    total: citaciones.length,
    pendientes: citaciones.filter((c) => c.estado === 'pendiente').length,
    enCurso: citaciones.filter((c) => c.estado === 'en curso').length,
    cerrados: citaciones.filter((c) => c.estado === 'cerrado').length,
    totalReclamado: citaciones.reduce((s, c) => s + (Number(c.total) || 0), 0),
    totalAcuerdos: citaciones.reduce((s, c) => s + (Number(c.macuerdo) || 0), 0),
    totalHonorarios: citaciones.reduce((s, c) => s + sumFacturas(c.facturas), 0),
  };

  // ── Drawer / Formulario ────────────────────────────────────────────────────
  const resetPdfState = () => {
    setPdfFile(null);
    setPdfParsing(false);
    setPdfError(null);
    setPdfExistingFilename(null);
    setPdfDetectedFields([]);
    setPdfWarningFields([]);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setFormData(FORM_EMPTY);
    setFormError(null);
    resetPdfState();
    setDrawerAbierto(true);
  };

  const abrirEditar = (citacion: Citacion) => {
    setEditandoId(citacion.id);
    setFormData({
      empresa: citacion.empresa,
      org: citacion.org,
      fecha: citacion.fecha,
      hora: citacion.hora,
      sede: citacion.sede,
      trabajador: citacion.trabajador,
      abogado: citacion.abogado,
      rubros: citacion.rubros,
      total: citacion.total,
      estado: citacion.estado,
      motivo: citacion.motivo,
      acuerdo: citacion.acuerdo,
      macuerdo: citacion.macuerdo,
      facturas: citacion.facturas.map(({ nro, tipo, monto }) => ({ nro, tipo, monto })),
      obs: citacion.obs,
    });
    setFormError(null);
    resetPdfState();
    setPdfExistingFilename(citacion.pdfFilename ?? null);
    setDrawerAbierto(true);
  };

  const cerrarDrawer = () => {
    setDrawerAbierto(false);
    setEditandoId(null);
    setFormError(null);
    resetPdfState();
  };

  const actualizarForm = (campo: keyof CitacionFormData, valor: unknown) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  };

  // ── PDF: parse + autofill ──────────────────────────────────────────────────
  const elegirPdf = async (file: File | null) => {
    setPdfError(null);
    setPdfDetectedFields([]);
    if (!file) {
      setPdfFile(null);
      return;
    }
    if (file.type && file.type !== 'application/pdf') {
      setPdfError('El archivo debe ser un PDF.');
      return;
    }
    setPdfFile(file);
    setPdfParsing(true);
    try {
      const res = await api.parsePdf(file);
      if (res.scanned) {
        setPdfError('El PDF parece escaneado (imagen) — completá los campos a mano. El archivo igual queda adjunto al guardar.');
        setPdfDetectedFields([]);
        setPdfWarningFields([]);
        return;
      }
      const parsed = res.parsed || {};
      const detected: string[] = [];

      setFormData((prev) => {
        const next = { ...prev };
        // Solo rellenamos campos vacíos para no pisar ediciones manuales.
        const maybeSet = <K extends keyof CitacionFormData>(key: K, value: CitacionFormData[K] | undefined) => {
          if (value === undefined || value === null) return;
          if (typeof value === 'string' && value === '') return;
          const current = prev[key] as unknown;
          const isEmpty = current === '' || current === 0 || current === undefined || current === null;
          if (isEmpty) {
            (next[key] as unknown) = value;
            detected.push(key);
          }
        };
        maybeSet('empresa', parsed.empresa);
        if (parsed.org === 'MTSS' || parsed.org === 'Juzgado') maybeSet('org', parsed.org);
        maybeSet('fecha', parsed.fecha);
        maybeSet('hora', parsed.hora);
        maybeSet('sede', parsed.sede);
        maybeSet('trabajador', parsed.trabajador);
        maybeSet('abogado', parsed.abogado);
        maybeSet('rubros', parsed.rubros);
        maybeSet('motivo', parsed.motivo);
        // total: aceptar también 0 cuando el PDF explícitamente dice "$0.0"
        // (reclamos no monetarios como "aclaración de situación laboral").
        if (typeof parsed.total === 'number' && parsed.total >= 0) {
          maybeSet('total', parsed.total);
        }
        return next;
      });

      setPdfDetectedFields(detected);
      setPdfWarningFields(res.corruptedFields || []);
    } catch (e) {
      console.error(e);
      setPdfError('No se pudo leer el PDF. Podés completar los campos a mano.');
    } finally {
      setPdfParsing(false);
    }
  };

  const quitarPdfAdjunto = async () => {
    if (!editandoId) {
      // Aún no guardada → solo limpiar estado local
      resetPdfState();
      return;
    }
    if (!window.confirm('¿Quitar el PDF adjunto a esta citación?')) return;
    try {
      await api.removePdf(editandoId);
      setCitaciones((prev) =>
        prev.map((c) => (c.id === editandoId ? { ...c, pdfUrl: null, pdfFilename: null } : c)),
      );
      resetPdfState();
    } catch (e) {
      console.error(e);
      setPdfError('No se pudo quitar el PDF. Intentá de nuevo.');
    }
  };

  // ── Guardar citación (+ attach PDF si hay uno nuevo) ───────────────────────
  const guardar = async () => {
    if (!formData.empresa.trim() || !formData.fecha) {
      setFormError('Empresa y fecha de audiencia son obligatorios.');
      return;
    }
    try {
      const payload = {
        ...formData,
        total: Number(formData.total) || 0,
        macuerdo: Number(formData.macuerdo) || 0,
        facturas: formData.facturas.map((f, i) => ({
          ...f,
          id: (editandoId
            ? citaciones.find((c) => c.id === editandoId)?.facturas[i]?.id
            : undefined) ?? crypto.randomUUID(),
          monto: Number(f.monto) || 0,
        })),
      };

      let saved: Citacion | null = null;
      if (editandoId) {
        saved = await api.update(editandoId, payload);
      } else {
        saved = await api.create(payload);
      }

      if (saved && pdfFile) {
        try {
          const attach = await api.attachPdf(saved.id, pdfFile);
          saved = { ...saved, pdfUrl: attach.pdfUrl, pdfFilename: attach.pdfFilename };
        } catch (e) {
          console.error('No se pudo adjuntar el PDF', e);
          // Guardado ok pero adjunto falló: aviso sin abortar cierre del drawer
          setFormError('Citación guardada. El PDF no se adjuntó — probá desde "Editar" de nuevo.');
          setCitaciones((prev) => {
            if (editandoId) return prev.map((c) => (c.id === editandoId ? saved! : c));
            return [saved!, ...prev];
          });
          return;
        }
      }

      if (saved) {
        if (editandoId) {
          setCitaciones((prev) => prev.map((c) => (c.id === editandoId ? saved! : c)));
        } else {
          setCitaciones((prev) => [saved!, ...prev]);
        }
      }
      cerrarDrawer();
    } catch {
      setFormError('Error al guardar. Intentá de nuevo.');
    }
  };

  // ── Cerrar expediente ──────────────────────────────────────────────────────
  const cerrarExpediente = async (id: string) => {
    const c = citaciones.find((x) => x.id === id);
    if (!c) return;
    if (!window.confirm(`¿Cerrar el expediente de "${c.trabajador}"?`)) return;
    const updated = await api.update(id, { estado: 'cerrado' });
    if (updated) {
      setCitaciones((prev) => prev.map((x) => (x.id === id ? updated : x)));
    }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const eliminar = async (id: string) => {
    const c = citaciones.find((x) => x.id === id);
    if (!c) return;
    if (!window.confirm(`¿Eliminar el expediente de "${c.trabajador}"? Esta acción no se puede deshacer.`)) return;
    await api.remove(id);
    setCitaciones((prev) => prev.filter((x) => x.id !== id));
  };

  return {
    // Estado
    citaciones: citacionesFiltradas,
    loading,
    error,
    stats,

    // Filtros
    tabActiva, setTabActiva,
    busqueda, setBusqueda,
    filtroOrg, setFiltroOrg,

    // Drawer
    drawerAbierto,
    editandoId,
    formData,
    formError,
    abrirNuevo,
    abrirEditar,
    cerrarDrawer,
    actualizarForm,
    guardar,

    // PDF
    pdfFile,
    pdfParsing,
    pdfError,
    pdfExistingFilename,
    pdfDetectedFields,
    pdfWarningFields,
    elegirPdf,
    quitarPdfAdjunto,
    pdfDownloadUrl: api.pdfDownloadUrl,

    // Acciones fila
    cerrarExpediente,
    eliminar,

    // Refresh manual
    cargar,
  };
}
