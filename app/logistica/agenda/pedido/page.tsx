'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ArrowLeft, ArrowRight, Plus, Minus, Shirt, AlertCircle } from 'lucide-react';
import type { AgendaEmployee, AgendaUniformCatalogItem, OrderItem } from '@/lib/agenda-types';

export default function AgendaPedidoPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<AgendaEmployee | null>(null);
  const [catalog, setCatalog] = useState<AgendaUniformCatalogItem[]>([]);
  const [order, setOrder] = useState<Record<number, OrderItem>>({});
  const [sizes, setSizes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const emp = sessionStorage.getItem('agenda_employee');
    const cat = sessionStorage.getItem('agenda_catalog');
    if (!emp || !cat) {
      router.replace('/logistica/agenda');
      return;
    }
    setEmployee(JSON.parse(emp));
    setCatalog(JSON.parse(cat));
  }, [router]);

  const updateQty = (item: AgendaUniformCatalogItem, delta: number) => {
    setOrder(prev => {
      const current = prev[item.id]?.qty || 0;
      const newQty = Math.max(0, Math.min(item.quantity, current + delta));
      if (newQty === 0) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: { article_type: item.article_type, size: sizes[item.id], qty: newQty },
      };
    });
  };

  const updateSize = (item: AgendaUniformCatalogItem, size: string) => {
    setSizes(prev => ({ ...prev, [item.id]: size }));
    setOrder(prev => {
      if (!prev[item.id]) return prev;
      return { ...prev, [item.id]: { ...prev[item.id], size } };
    });
  };

  const handleContinue = () => {
    const items = Object.values(order);
    if (items.length === 0) {
      setError('Seleccioná al menos un artículo para continuar');
      return;
    }
    // Completar con talle del empleado si no se seleccionó
    const normalized: OrderItem[] = items.map(item => {
      const catalogItem = catalog.find(c => c.article_type === item.article_type);
      let size = item.size;
      if (!size && employee) {
        if (catalogItem?.article_type.toLowerCase().includes('pantalon') || catalogItem?.article_type.toLowerCase().includes('pantalón')) {
          size = employee.talle_inferior || undefined;
        } else if (catalogItem?.article_type.toLowerCase().includes('zapato') || catalogItem?.article_type.toLowerCase().includes('calzado') || catalogItem?.article_type.toLowerCase().includes('bota')) {
          size = employee.calzado || undefined;
        } else {
          size = employee.talle_superior || undefined;
        }
      }
      return { ...item, size };
    });

    sessionStorage.setItem('agenda_order', JSON.stringify(normalized));
    router.push('/logistica/agenda/turno');
  };

  if (!employee) return null;

  const totalItems = Object.values(order).reduce((sum, i) => sum + i.qty, 0);

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
        <div style={{
          background: totalItems > 0 ? '#e04951' : 'rgba(255,255,255,0.2)',
          borderRadius: '999px', padding: '0.3rem 0.8rem',
          color: 'white', fontSize: '0.78rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <ShoppingBag size={13} /> {totalItems} ítem{totalItems !== 1 ? 's' : ''}
        </div>
      </header>

      {/* Pasos */}
      <div style={{ backgroundColor: 'white', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
          <span style={{ color: '#94a3b8' }}>✓ Identidad</span>
          <span>›</span>
          <span style={{ color: '#29416b', fontWeight: 700 }}>② Prendas</span>
          <span>›</span>
          <span>③ Turno</span>
          <span>›</span>
          <span>④ Confirmación</span>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.3rem' }}>
          Catálogo de prendas — {employee.empresa || 'GSS'}
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Seleccioná las prendas que necesitás retirar. La cantidad máxima por artículo está definida por tu empresa.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#e04951" />
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</p>
          </div>
        )}

        {catalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <Shirt size={36} color="#cbd5e1" style={{ marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No hay catálogo configurado para tu empresa.<br />Consultá con logística.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {catalog.map(item => {
              const qty = order[item.id]?.qty || 0;
              return (
                <div key={item.id} style={{
                  background: 'white', borderRadius: '10px',
                  border: qty > 0 ? '2px solid #29416b' : '1px solid #e2e8f0',
                  padding: '1rem',
                  transition: 'border-color 200ms',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{item.article_type}</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                        Máx. {item.quantity} unid. · Vida útil: {item.useful_life_months} meses
                        {item.reusable_allowed ? ' · Puede ser reutilizable' : ''}
                      </p>
                    </div>
                    {/* Contador */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => { updateQty(item, -1); setError(null); }}
                        disabled={qty === 0}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          border: '2px solid #e2e8f0', background: qty === 0 ? '#f8fafc' : 'white',
                          cursor: qty === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: qty === 0 ? '#cbd5e1' : '#29416b',
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', minWidth: '24px', textAlign: 'center' }}>
                        {qty}
                      </span>
                      <button
                        onClick={() => { updateQty(item, 1); setError(null); }}
                        disabled={qty >= item.quantity}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          border: '2px solid #e2e8f0', background: qty >= item.quantity ? '#f8fafc' : '#29416b',
                          cursor: qty >= item.quantity ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: qty >= item.quantity ? '#cbd5e1' : 'white',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Talle si está seleccionado */}
                  {qty > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                        Talle
                      </label>
                      <input
                        type="text"
                        value={sizes[item.id] || ''}
                        onChange={e => updateSize(item, e.target.value)}
                        placeholder={
                          item.article_type.toLowerCase().includes('pantalon') || item.article_type.toLowerCase().includes('pantalón')
                            ? (employee.talle_inferior || 'Ej: 42')
                            : item.article_type.toLowerCase().includes('zapato') || item.article_type.toLowerCase().includes('calzado') || item.article_type.toLowerCase().includes('bota')
                            ? (employee.calzado || 'Ej: 42')
                            : (employee.talle_superior || 'Ej: M / L / XL')
                        }
                        style={{
                          width: '100%', border: '1px solid #d1d5db', borderRadius: '6px',
                          padding: '0.4rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Continuar */}
        <button
          onClick={handleContinue}
          disabled={totalItems === 0}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            backgroundColor: totalItems === 0 ? '#94a3b8' : '#29416b',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '0.85rem', fontSize: '0.9rem', fontWeight: 600,
            cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
        >
          Seleccionar turno <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
