'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Licencia {
  id: number;
  remitente: string;
  padron: string;
  funcionario: string;
  nombreServicio: string;
  sector: string;
  tipoLicencia: string;
  desde: string;
  hasta: string;
  suplente: string;
  recepNotificacion: boolean;
  supervision: boolean;
  recepCertificado: boolean;
  planificacion: boolean;
  observaciones: string;
  createdAt: string;
  updatedAt: string;
}

export type LicenciaEditable = Omit<Licencia, 'id' | 'createdAt' | 'updatedAt'>;

export type LicenciaField = keyof LicenciaEditable;

export interface PreviewRow {
  remitente: string;
  padron: string | null;
  funcionario: string;
  nombre_servicio: string | null;
  sector: string | null;
  tipo_licencia: string;
  desde: string | null;
  hasta: string | null;
  suplente: string | null;
  recep_notificacion: 0 | 1;
  supervision: 0 | 1;
  recep_certificado: 0 | 1;
  planificacion: 0 | 1;
  observaciones: string | null;
}

export interface PreviewResult {
  totalFilas: number;
  validas: number;
  descartadas: number;
  sinFechas: number;
  sinSector: number;
  porTipo: Record<string, number>;
  porSector: Record<string, number>;
  primeras: PreviewRow[];
  errores: string[];
}

const BOOL_FIELDS: LicenciaField[] = ['recepNotificacion', 'supervision', 'recepCertificado', 'planificacion'];
const DEBOUNCE_MS = 400;

export function useLicenciasApi() {
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoIds, setGuardandoIds] = useState<Set<number>>(new Set());

  const debouncersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchLicencias = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/rrhh/licencias', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLicencias(data.licencias || []);
    } catch (e) {
      setError((e as Error).message || 'Error al cargar licencias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLicencias(); }, [fetchLicencias]);

  // Optimistic update + PUT con debounce (sin debounce para toggles de check).
  const actualizarCampo = useCallback(async <K extends LicenciaField>(id: number, field: K, value: LicenciaEditable[K]) => {
    setLicencias((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

    const key = `${id}:${field}`;
    if (debouncersRef.current[key]) clearTimeout(debouncersRef.current[key]);

    const isToggle = BOOL_FIELDS.includes(field);
    const doSave = async () => {
      setGuardandoIds((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/rrhh/licencias/${id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Reconciliar con la respuesta del servidor (updated_at, etc.)
        const data = await res.json();
        if (data?.licencia) {
          setLicencias((prev) => prev.map((l) => (l.id === id ? data.licencia : l)));
        }
      } catch (e) {
        console.error('actualizarCampo:', e);
        setError(`No se pudo guardar "${String(field)}" — probá de nuevo.`);
        fetchLicencias(); // re-sync desde server para limpiar el optimistic roto
      } finally {
        setGuardandoIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    };

    if (isToggle) {
      doSave();
    } else {
      debouncersRef.current[key] = setTimeout(doSave, DEBOUNCE_MS);
    }
  }, [fetchLicencias]);

  const crear = useCallback(async (data: Partial<LicenciaEditable>): Promise<Licencia | null> => {
    const res = await fetch('/api/rrhh/licencias', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const nueva = json.licencia as Licencia;
    setLicencias((prev) => [nueva, ...prev]);
    return nueva;
  }, []);

  const eliminar = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`/api/rrhh/licencias/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    setLicencias((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const previewImport = useCallback(async (
    file: File,
    year: number,
  ): Promise<PreviewResult> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', String(year));
    const res = await fetch('/api/rrhh/licencias/import/preview', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  const importar = useCallback(async (
    file: File,
    year: number,
    strategy: 'merge' | 'replace',
  ): Promise<{ insertados: number; descartadas: number; total_filas: number; errores: string[] }> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', String(year));
    fd.append('strategy', strategy);
    const res = await fetch('/api/rrhh/licencias/import', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    await fetchLicencias();
    return data;
  }, [fetchLicencias]);

  return {
    licencias,
    loading,
    error,
    guardandoIds,
    actualizarCampo,
    crear,
    eliminar,
    importar,
    previewImport,
    refetch: fetchLicencias,
  };
}
