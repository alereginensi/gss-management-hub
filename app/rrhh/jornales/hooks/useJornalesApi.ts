/**
 * hooks/useJornalesApi.ts
 * Hook que persiste el estado del módulo Jornales contra la API.
 * Todas las mutaciones hacen fetch + refetch para mantener coherencia.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ResultadoJornal } from '@/lib/jornales-helpers';

export interface PersonaJornal {
  padron: string;
  nombre: string;
  doc: string | null;
  efectividad_autorizada: number;
  created_at?: string;
}

export interface ArchivoMarcasMeta {
  id: number;
  name: string;
  size: number;
  registros_totales: number;
  registros_nuevos: number;
  uploaded_by: number | null;
  created_at: string;
}

export interface EstadisticasResultados {
  total: number;
  efectivoAutorizado: number;
  efectivo: number;
  curso: number;
  sinMarcas: number;
}

export interface EstadisticasMarcas {
  totalRegistros: number;
  totalArchivos: number;
  personasEnMarcas: number;
  diasUnicos: number;
}

interface UseJornalesApiOpts {
  umbralEfectividad?: number;
}

export function useJornalesApi({ umbralEfectividad = 100 }: UseJornalesApiOpts = {}) {
  const [personal, setPersonal] = useState<PersonaJornal[]>([]);
  const [resultados, setResultados] = useState<ResultadoJornal[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasResultados>({
    total: 0, efectivoAutorizado: 0, efectivo: 0, curso: 0, sinMarcas: 0,
  });
  const [estadisticasMarcas, setEstadisticasMarcas] = useState<EstadisticasMarcas>({
    totalRegistros: 0, totalArchivos: 0, personasEnMarcas: 0, diasUnicos: 0,
  });
  const [archivosMeta, setArchivosMeta] = useState<ArchivoMarcasMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonal = useCallback(async () => {
    const res = await fetch('/api/rrhh/jornales/personal');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPersonal(data.personal || []);
  }, []);

  const fetchResultados = useCallback(async () => {
    const res = await fetch(`/api/rrhh/jornales/resultados?umbral=${umbralEfectividad}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setResultados(data.resultados || []);
    setEstadisticas(data.estadisticas || { total: 0, efectivoAutorizado: 0, efectivo: 0, curso: 0, sinMarcas: 0 });
    setEstadisticasMarcas(data.estadisticasMarcas || { totalRegistros: 0, totalArchivos: 0, personasEnMarcas: 0, diasUnicos: 0 });
  }, [umbralEfectividad]);

  const fetchArchivos = useCallback(async () => {
    const res = await fetch('/api/rrhh/jornales/marcas/archivos');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setArchivosMeta(data.archivos || []);
  }, []);

  const refetchAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([fetchPersonal(), fetchResultados(), fetchArchivos()]);
    } catch (err: any) {
      setError(err?.message || 'Error consultando datos');
    }
  }, [fetchPersonal, fetchResultados, fetchArchivos]);

  useEffect(() => {
    setLoading(true);
    refetchAll().finally(() => setLoading(false));
  }, [refetchAll]);

  // ─── Personal ──────────────────────────────────────────────────────────

  const cargarPersonalDesdeExcel = useCallback(async (file: File): Promise<number> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/rrhh/jornales/personal/import', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error al importar');
    await refetchAll();
    return Number(data.insertados) || 0;
  }, [refetchAll]);

  const agregarPersonas = useCallback(async (personas: Array<{ id: string; nombre: string; doc?: string }>): Promise<number> => {
    const payload = personas.map((p) => ({ padron: p.id, nombre: p.nombre, doc: p.doc || '' }));
    const res = await fetch('/api/rrhh/jornales/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personas: payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error al agregar');
    await refetchAll();
    return Number(data.agregados) || 0;
  }, [refetchAll]);

  const darDeBaja = useCallback(async (ids: string[] | string): Promise<number> => {
    const arr = Array.isArray(ids) ? ids : [ids];
    let ok = 0;
    for (const id of arr) {
      const res = await fetch(`/api/rrhh/jornales/personal/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) ok++;
    }
    await refetchAll();
    return ok;
  }, [refetchAll]);

  const eliminarPersona = useCallback(async (id: string): Promise<number> => {
    return darDeBaja([id]);
  }, [darDeBaja]);

  const autorizarEfectividad = useCallback(async (id: string, autorizada: boolean): Promise<void> => {
    const res = await fetch(`/api/rrhh/jornales/personal/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ efectividad_autorizada: autorizada ? 1 : 0 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Error al actualizar');
    }
    await refetchAll();
  }, [refetchAll]);

  // ─── Marcas ────────────────────────────────────────────────────────────

  const cargarArchivoMarcas = useCallback(async (file: File): Promise<{ omitido?: boolean; razon?: string; nuevos?: number; dups?: number; total?: number; }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/rrhh/jornales/marcas', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error procesando archivo');
    await refetchAll();
    return data;
  }, [refetchAll]);

  const limpiarMarcas = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/rrhh/jornales/marcas', { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Error al limpiar');
    }
    await refetchAll();
  }, [refetchAll]);

  const quitarArchivoMarcas = useCallback(async (index: number): Promise<void> => {
    const archivo = archivosMeta[index];
    if (!archivo) return;
    const res = await fetch(`/api/rrhh/jornales/marcas/archivos/${archivo.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Error al quitar archivo');
    }
    await refetchAll();
  }, [archivosMeta, refetchAll]);

  return {
    // Estado
    personal,
    resultados,
    estadisticas,
    estadisticasMarcas,
    archivosMeta,
    loading,
    error,

    // Personal
    cargarPersonalDesdeExcel,
    agregarPersonas,
    darDeBaja,
    eliminarPersona,
    autorizarEfectividad,

    // Marcas
    cargarArchivoMarcas,
    limpiarMarcas,
    quitarArchivoMarcas,

    // Manual refetch
    refetchAll,
  };
}
