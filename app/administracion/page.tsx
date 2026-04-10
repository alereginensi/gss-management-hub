'use client';

import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const { tickets, searchQuery, getAverageResolutionTime, currentUser, isSidebarOpen, deleteTicket, isMobile } = useTicketContext();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role === 'funcionario') {
      router.push('/tasks');
    }
  }, [currentUser, router]);

  if (currentUser && currentUser.role === 'funcionario') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Redirigiendo...</div>;
  }

  // Jefe only sees their own department
  const visibleTickets = currentUser?.role === 'jefe'
    ? tickets.filter((t: any) => t.department === currentUser.department)
    : tickets;

  const pendingTickets = visibleTickets.filter((t: any) => t.status === 'Nuevo' || t.status === 'En Progreso');
  const openTickets = pendingTickets.length;
  const openPriorityCounts = {
    Alta: pendingTickets.filter((t: any) => t.priority === 'Alta').length,
    Media: pendingTickets.filter((t: any) => t.priority === 'Media').length,
    Baja: pendingTickets.filter((t: any) => t.priority === 'Baja').length,
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const resolvedToday = visibleTickets.filter((t: any) => {
    if (t.status !== 'Resuelto') return false;
    const resolvedAt = t.resolvedAt ? new Date(t.resolvedAt) : null;
    if (!resolvedAt || isNaN(resolvedAt.getTime())) return false;
    return resolvedAt >= todayStart;
  }).length;

  const priorityCounts = {
    Alta: visibleTickets.filter((t: any) => t.priority === 'Alta').length,
    Media: visibleTickets.filter((t: any) => t.priority === 'Media').length,
    Baja: visibleTickets.filter((t: any) => t.priority === 'Baja').length
  };
  const totalTickets = visibleTickets.length || 1;

  const avgResolutionTime = getAverageResolutionTime();

  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendiente' | 'Resuelto'>('Todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('Todos');
  const filteredTickets = visibleTickets.filter((t: any) => {
    const matchesStatus =
      statusFilter === 'Todos' ||
      (statusFilter === 'Pendiente' && (t.status === 'Nuevo' || t.status === 'En Progreso')) ||
      (statusFilter === 'Resuelto' && t.status === 'Resuelto');
    const matchesPriority = priorityFilter === 'Todos' || (t.priority || '').trim() === priorityFilter.trim();
    
    const matchesSearch = !searchQuery || 
      (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.id || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.requester || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesPriority && matchesSearch;
  });
  const recentTickets = showAll ? filteredTickets : filteredTickets.slice(0, 5);

  const handleDeleteTicket = async (ticketId: string, subject: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el ticket #${ticketId} - "${subject}"?`)) {
      const success = await deleteTicket(ticketId);
      if (success) {
        alert('Ticket eliminado con éxito');
      } else {
        alert('Error al eliminar el ticket');
      }
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <main style={{
        flex: 1,
        marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
        transition: 'margin-left 0.3s ease-in-out',
        padding: isMobile ? '4rem 1rem 1rem' : '2rem 2.5rem 2.5rem',
        backgroundColor: 'var(--bg-color)'
      }}>
        <Header title="Dashboard" />

        {/* KPIs */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? '1rem' : '1.5rem',
          marginBottom: '2rem'
        }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: isMobile ? '1rem' : '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: 'var(--status-new)', flexShrink: 0 }}>
              <FileText size={isMobile ? 20 : 24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tickets Pendientes</p>
              <p style={{ fontSize: isMobile ? '1.35rem' : '1.75rem', fontWeight: 700 }}>{openTickets}</p>
              {openTickets > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {openPriorityCounts.Alta > 0 && (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--priority-high)' }}>
                      Alta: {openPriorityCounts.Alta}
                    </span>
                  )}
                  {openPriorityCounts.Media > 0 && (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--priority-medium)' }}>
                      Media: {openPriorityCounts.Media}
                    </span>
                  )}
                  {openPriorityCounts.Baja > 0 && (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--priority-low)' }}>
                      Baja: {openPriorityCounts.Baja}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: isMobile ? '1rem' : '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: 'var(--status-resolved)' }}>
              <CheckCircle2 size={isMobile ? 20 : 24} />
            </div>
            <div>
              <p style={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Resueltos Hoy</p>
              <p style={{ fontSize: isMobile ? '1.35rem' : '1.75rem', fontWeight: 700 }}>{resolvedToday}</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center', padding: isMobile ? '1rem' : '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Prioridades</p>
              <AlertCircle size={16} style={{ color: 'var(--priority-high)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(['Alta', 'Media', 'Baja'] as const).map(p => {
                const count = priorityCounts[p];
                const percentage = (count / totalTickets) * 100;
                const color = p === 'Alta' ? 'var(--priority-high)' : p === 'Media' ? 'var(--priority-medium)' : 'var(--priority-low)';
                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8125rem', width: '40px', fontWeight: 600 }}>{p}</span>
                    <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: '24px', textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: isMobile ? '1rem' : '1.5rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', color: 'var(--status-progress)' }}>
              <Clock size={isMobile ? 20 : 24} />
            </div>
            <div>
              <p style={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tiempo Promedio</p>
              <p style={{ fontSize: isMobile ? '1.35rem' : '1.75rem', fontWeight: 700 }}>{avgResolutionTime}</p>
            </div>
          </div>
        </section>

        {/* Recent Tickets */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 600 }}>Tickets Recientes</h3>
            <button
              className="btn"
              style={{ fontSize: isMobile ? '0.9rem' : '1rem', color: 'var(--accent-color)' }}
              onClick={() => setShowAll(prev => !prev)}
            >
              {showAll ? 'Ver menos' : 'Ver todos'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['Todos', 'Pendiente', 'Resuelto'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="btn"
                  style={{
                    fontSize: isMobile ? '0.875rem' : '0.95rem',
                    padding: isMobile ? '0.4rem 0.85rem' : '0.45rem 1rem',
                    backgroundColor: statusFilter === s ? 'var(--accent-color)' : 'transparent',
                    color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-color)',
                color: 'var(--text-primary)',
                fontSize: isMobile ? '0.875rem' : '0.95rem',
                cursor: 'pointer'
              }}
            >
              <option value="Todos">Todas las prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (statusFilter !== 'Todos') params.set('status', statusFilter);
                    if (priorityFilter !== 'Todos') params.set('priority', priorityFilter);
                    const qs = params.toString();
                    window.open(`/api/tickets/export${qs ? '?' + qs : ''}`, '_blank');
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Exportar Excel
                </button>
              </div>
              {recentTickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{`T-${ticket.id}`}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', padding: '0.25rem 0.65rem', borderRadius: '12px', backgroundColor: ticket.statusColor, color: '#fff', fontWeight: 600 }}>
                        {ticket.status}
                      </span>
                      {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'jefe') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket.id, ticket.subject); }}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.3rem', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{ticket.subject}</span>
                    {!!(ticket.isTeamTicket || (ticket as any).is_team_ticket) && (
                      <span style={{ fontSize: '0.72rem', padding: '0.12rem 0.45rem', borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid rgba(139,92,246,0.3)' }}>En equipo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{ticket.requester || 'Sin solicitante'}</span>
                    <span style={{ fontSize: '0.8125rem', padding: '0.18rem 0.55rem', borderRadius: '4px', backgroundColor: ticket.priorityColor, color: '#fff', fontWeight: 500 }}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    {ticket.date}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (statusFilter !== 'Todos') params.set('status', statusFilter);
                    if (priorityFilter !== 'Todos') params.set('priority', priorityFilter);
                    const qs = params.toString();
                    window.open(`/api/tickets/export${qs ? '?' + qs : ''}`, '_blank');
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Exportar Excel
                </button>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overflowY: 'auto', maxHeight: showAll ? '65vh' : '380px', transition: 'max-height 0.3s ease' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '720px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface-color)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '1rem' }}>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>ID</th>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Asunto</th>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Solicitante</th>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Prioridad</th>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Estado</th>
                      <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Fecha</th>
                      {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'jefe') && (
                        <th style={{ padding: '0.75rem 0.65rem', fontWeight: 600 }}>Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '1rem' }}>
                    {recentTickets.map((ticket: any) => (
                      <tr
                        key={ticket.id}
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>#{`T-${ticket.id}`}</td>
                        <td style={{ padding: '0.75rem 0.65rem', fontWeight: 500, maxWidth: 'min(360px, 28vw)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</span>
                            {!!(ticket.isTeamTicket || (ticket as any).is_team_ticket) && (
                              <span style={{ fontSize: '0.75rem', padding: '0.12rem 0.45rem', borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid rgba(139,92,246,0.3)' }}>En equipo</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.65rem', whiteSpace: 'nowrap' }}>{ticket.requester || 'N/A'}</td>
                        <td style={{ padding: '0.75rem 0.65rem' }}><span className="tag" style={{ backgroundColor: ticket.priorityColor }}>{ticket.priority}</span></td>
                        <td style={{ padding: '0.75rem 0.65rem' }}><span className="tag" style={{ backgroundColor: ticket.statusColor }}>{ticket.status}</span></td>
                        <td style={{ padding: '0.75rem 0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ticket.date}</td>
                        {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'jefe') && (
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket.id, ticket.subject); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'background-color 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Eliminar Ticket"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
