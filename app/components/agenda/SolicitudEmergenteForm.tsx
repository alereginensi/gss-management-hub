'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Loader2, Plus, Trash2 } from 'lucide-react';

interface EmployeeHit {
  id: number;
  documento: string;
  nombre: string;
  empresa?: string;
}

interface CatalogItem {
  id: number;
  empresa?: string | null;
  workplace_category?: string | null;
  article_type: string;
}

interface FormItem {
  article_type: string;
  size: string;
}

interface Props {
  source: 'limpieza' | 'seguridad' | 'rrhh' | 'logistica';
  onCreated?: () => void;
  onCancel?: () => void;
}

const EMPTY_ITEM: FormItem = { article_type: '', size: '' };

export default function SolicitudEmergenteForm({ source, onCreated, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<EmployeeHit[]>([]);
  const [selected, setSelected] = useState<EmployeeHit | null>(null);
  const [items, setItems] = useState<FormItem[]>([{ ...EMPTY_ITEM }]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/logistica/agenda/catalog')
      .then(r => r.json())
      .then((data: any) => {
        const arr = Array.isArray(data) ? data : [];
        setCatalog(arr);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/logistica/agenda/employees/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(Array.isArray(data.employees) ? data.employees : []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, selected]);

  const articulosSugeridos = useMemo(() => {
    const s = new Set<string>();
    const empresa = selected?.empresa;
    for (const c of catalog) {
      if (empresa && c.empresa && c.empresa !== empresa) continue;
      if (c.article_type) s.add(c.article_type);
    }
    return Array.from(s).sort();
  }, [catalog, selected]);

  const updateItem = (idx: number, patch: Partial<FormItem>) => {
    setItems(arr => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addItem = () => setItems(arr => [...arr, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems(arr => arr.length === 1 ? arr : arr.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setError(null);
    if (!selected) { setError('Seleccioná un empleado'); return; }
    const cleaned = items
      .map(it => ({ article_type: it.article_type.trim(), size: it.size.trim() || undefined }))
      .filter(it => it.article_type.length > 0);
    if (cleaned.length === 0) { setError('Agregá al menos un artículo'); return; }
    if (!reason.trim()) { setError('Ingresá el motivo'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/logistica/agenda/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selected.id,
          items: cleaned,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          is_emergency: 1,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear la solicitud');
        return;
      }
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.55rem 0.8rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{error}</div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Empleado *</label>
        {selected ? (
          <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '6px', padding: '0.55rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.82rem' }}>
              <strong>{selected.nombre}</strong>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>CI {selected.documento}{selected.empresa ? ` · ${selected.empresa}` : ''}</div>
            </div>
            <button onClick={() => { setSelected(null); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} aria-label="Cambiar empleado"><X size={16} /></button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por documento o nombre..."
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem 0.45rem 1.9rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
              {searching && <Loader2 size={14} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', animation: 'spin 1s linear infinite' }} />}
            </div>
            {hits.length > 0 && (
              <div style={{ marginTop: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {hits.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setSelected(h); setQuery(''); setHits([]); }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', padding: '0.5rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <strong>{h.nombre}</strong>
                    <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.72rem' }}>CI {h.documento}{h.empresa ? ` · ${h.empresa}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Artículos *</label>
          <button
            onClick={addItem}
            style={{ background: 'none', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            type="button"
          >
            <Plus size={12} /> Agregar otro
          </button>
        </div>
        <datalist id="articulos-catalog-suggest">
          {articulosSugeridos.map(a => <option key={a} value={a} />)}
        </datalist>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.4rem', alignItems: 'start' }}>
              <input
                list="articulos-catalog-suggest"
                value={it.article_type}
                onChange={e => updateItem(i, { article_type: e.target.value })}
                placeholder="Artículo (escribí o elegí del catálogo)"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
              <input
                value={it.size}
                onChange={e => updateItem(i, { size: e.target.value })}
                placeholder="Talle"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                title={items.length === 1 ? 'Debe haber al menos un artículo' : 'Quitar'}
                style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.4rem', cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: items.length === 1 ? 0.4 : 1 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        {selected && articulosSugeridos.length > 0 && (
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0.3rem 0 0' }}>
            Sugerencias: artículos del catálogo{selected.empresa ? ` de ${selected.empresa}` : ''}.
          </p>
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Motivo *</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Ej: Deterioro por manipulación de químicos" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Notas</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        {onCancel && <button onClick={onCancel} className="btn btn-secondary" disabled={saving} style={{ fontSize: '0.82rem' }}>Cancelar</button>}
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
          {saving ? 'Enviando...' : 'Crear solicitud'}
        </button>
      </div>
    </div>
  );
}
