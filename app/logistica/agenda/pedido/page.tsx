'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ShirtIcon, AlertCircle } from 'lucide-react';
import type { AgendaEmployee, AgendaUniformCatalogItem, OrderItem } from '@/lib/agenda-types';

interface RenewableArticle {
  id: number;
  article_type: string;
  size?: string | null;
  delivery_date?: string | null;
  expiration_date?: string | null;
}

function normArticle(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export default function AgendaPedidoPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<AgendaEmployee | null>(null);
  const [catalog, setCatalog] = useState<AgendaUniformCatalogItem[]>([]);
  const [renewableArticles, setRenewableArticles] = useState<RenewableArticle[]>([]);
  const [selections, setSelections] = useState<Record<number, { size: string; color: string }>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    const emp = sessionStorage.getItem('agenda_employee');
    const cat = sessionStorage.getItem('agenda_catalog');
    if (!emp || !cat) { router.replace('/logistica/agenda'); return; }
    const fullCatalog = JSON.parse(cat) as AgendaUniformCatalogItem[];
    const rawRenewable = sessionStorage.getItem('agenda_renewable_articles');
    const renewable = rawRenewable ? JSON.parse(rawRenewable) as RenewableArticle[] : [];
    setRenewableArticles(renewable);

    // Si el empleado tiene artículos vencidos, solo puede pedir renovación de esos.
    // Filtrar el catálogo por el article_type normalizado.
    let filteredCatalog = fullCatalog;
    if (renewable.length > 0) {
      const renewableKeys = new Set(renewable.map(r => normArticle(r.article_type)));
      filteredCatalog = fullCatalog.filter(c => renewableKeys.has(normArticle(c.article_type)));
    }

    setEmployee(JSON.parse(emp));
    setCatalog(filteredCatalog);
    setSelections(Object.fromEntries(filteredCatalog.map(item => [item.id, { size: '', color: '' }])));
  }, [router]);

  const toggleSkip = (id: number) => {
    setError('');
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSize = (id: number, size: string) => {
    setError('');
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], size } }));
  };

  const setColor = (id: number, color: string) => {
    setError('');
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], color } }));
  };

  const handleContinue = () => {
    setError('');
    const needed = catalog.filter(item => !skipped.has(item.id));

    if (needed.length === 0) {
      setError('Debe seleccionar al menos una prenda o indicar que la necesita.');
      return;
    }

    const missingSizes = needed.filter(item => !selections[item.id]?.size);
    if (missingSizes.length > 0) {
      setError(`Seleccioná la talla para: ${missingSizes.map(i => i.article_type).join(', ')}`);
      return;
    }

    const missingColors = needed.filter(
      item => item.colors && item.colors.length > 0 && !selections[item.id]?.color
    );
    if (missingColors.length > 0) {
      setError(`Seleccioná el color para: ${missingColors.map(i => i.article_type).join(', ')}`);
      return;
    }

    const items: OrderItem[] = needed.map(item => ({
      article_type: item.article_type,
      size: selections[item.id].size,
      qty: 1,
      ...(selections[item.id].color ? { color: selections[item.id].color } : {}),
    }));

    sessionStorage.setItem('agenda_order', JSON.stringify(items));
    router.push('/logistica/agenda/turno');
  };

  if (!employee) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, backgroundColor: '#29416b',
        borderBottom: '3px solid #e04951', padding: '0.8rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 50,
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Seleccionar Prendas</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
            {employee.nombre} · {employee.empresa || 'GSS'}
          </p>
        </div>
      </header>

      {/* Pasos */}
      <div style={{ backgroundColor: 'white', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
          <span>✓ Identidad</span><span>›</span>
          <span style={{ color: '#29416b', fontWeight: 700 }}>② Prendas</span><span>›</span>
          <span>③ Turno</span><span>›</span>
          <span>④ Confirmación</span>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {/* Ícono + título */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', background: 'rgba(41,65,107,0.08)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.75rem',
          }}>
            <ShirtIcon size={26} color="#29416b" />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem' }}>
            Seleccione sus tallas
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            {employee.nombre} —{' '}
            <span style={{ fontWeight: 600, color: '#29416b' }}>
              {employee.empresa || 'GSS'}{employee.sector ? ` - ${employee.sector}` : ''}
            </span>
          </p>
        </div>

        {/* Banner de renovación por vencimiento */}
        {renewableArticles.length > 0 && (
          <div style={{
            background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem',
            display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
          }}>
            <AlertCircle size={18} color="#c2410c" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 700, color: '#9a3412', fontSize: '0.88rem' }}>
                Tenés que renovar {renewableArticles.length} prenda{renewableArticles.length !== 1 ? 's' : ''} vencida{renewableArticles.length !== 1 ? 's' : ''}
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#7c2d12' }}>
                Solo podés pedir renovación de lo que ya se venció:{' '}
                <strong>{renewableArticles.map(r => r.article_type + (r.size ? ` (${r.size})` : '')).join(', ')}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {catalog.map(item => {
            const isSkipped = skipped.has(item.id);
            const sel = selections[item.id] || { size: '', color: '' };
            const hasColors = item.colors && item.colors.length > 0;

            return (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${isSkipped ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '1rem 1.1rem',
                  background: isSkipped ? '#f0fdf4' : 'white',
                  transition: 'all 200ms',
                }}
              >
                <p style={{ margin: '0 0 0.85rem', fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>
                  {item.article_type}
                </p>

                {isSkipped ? (
                  <button
                    onClick={() => toggleSkip(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '0.4rem', padding: '0.6rem', borderRadius: '8px',
                      background: '#dcfce7', border: '1px solid #86efac',
                      color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    <Check size={15} />
                    Ya lo tengo — toca para desmarcar
                  </button>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                      {/* Talla */}
                      {item.sizes && item.sizes.length > 0 && (
                        <div style={{ flex: '1 1 auto' }}>
                          <p style={{ margin: '0 0 0.45rem', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Talla
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {item.sizes.map(size => {
                              const active = sel.size === size;
                              return (
                                <button
                                  key={size}
                                  onClick={() => setSize(item.id, size)}
                                  style={{
                                    padding: '0.28rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem',
                                    fontWeight: active ? 700 : 400, cursor: 'pointer', minWidth: '38px',
                                    textAlign: 'center', transition: 'all 120ms',
                                    background: active ? '#22c55e' : 'white',
                                    color: active ? 'white' : '#374151',
                                    border: active ? '2px solid #22c55e' : '1px solid #d1d5db',
                                  }}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Color */}
                      {hasColors && (
                        <div style={{ flex: '1 1 auto' }}>
                          <p style={{ margin: '0 0 0.45rem', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Color
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {item.colors!.map(color => {
                              const active = sel.color === color;
                              return (
                                <button
                                  key={color}
                                  onClick={() => setColor(item.id, color)}
                                  style={{
                                    padding: '0.28rem 0.7rem', borderRadius: '6px', fontSize: '0.82rem',
                                    fontWeight: active ? 700 : 400, cursor: 'pointer',
                                    transition: 'all 120ms',
                                    background: active ? '#22c55e' : 'white',
                                    color: active ? 'white' : '#374151',
                                    border: active ? '2px solid #22c55e' : '1px solid #d1d5db',
                                  }}
                                >
                                  {color}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => toggleSkip(item.id)}
                      style={{
                        width: '100%', padding: '0.55rem', borderRadius: '8px',
                        border: '1px solid #fca5a5', background: 'white',
                        color: '#f87171', fontSize: '0.85rem', cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                    >
                      Ya lo tengo
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: '1rem', background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '0.75rem 1rem',
            fontSize: '0.83rem', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.75rem 1.25rem', borderRadius: '8px',
              border: '1px solid #d1d5db', background: 'white',
              color: '#374151', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Atrás
          </button>
          <button
            onClick={handleContinue}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', padding: '0.75rem', borderRadius: '8px',
              background: '#29416b', color: 'white',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: 'none',
            }}
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
