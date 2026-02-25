'use client';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { useTicketContext } from './context/TicketContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { tickets, getAverageResolutionTime, currentUser, isSidebarOpen, deleteTicket, isMobile } = useTicketContext();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role === 'funcionario') {
      router.push('/tasks');
    }
  }, [currentUser, router]);

  // Don't render dashboard for funcionario while redirecting
  if (currentUser && currentUser.role === 'funcionario') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Redirigiendo...</div>;
  }

  // Calculate KPIs from tickets
  const openTickets = tickets.filter(t => t.status === 'Nuevo' || t.status === 'En Progreso').length;
  const resolvedToday = tickets.filter(t => t.status === 'Resuelto').length;

  // Priority Breakdown
  const priorityCounts = {
    Alta: tickets.filter(t => t.priority === 'Alta').length,
    Media: tickets.filter(t => t.priority === 'Media').length,
    Baja: tickets.filter(t => t.priority === 'Baja').length
  };
  const totalTickets = tickets.length || 1; // Avoid division by zero

  const avgResolutionTime = getAverageResolutionTime();

  // Get recent tickets (first 3)
  const recentTickets = tickets.slice(0, 3);

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
        padding: isMobile ? '1rem' : '2rem',
        backgroundColor: 'var(--bg-color)'
      }}>
        <Header title="Dashboard" />

        {/* KPIs */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: 'var(--status-new)' }}>
              <FileText size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tickets Pendientes</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{openTickets}</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: 'var(--status-resolved)' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Resueltos Hoy</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{resolvedToday}</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Prioridades</p>
              <AlertCircle size={16} style={{ color: 'var(--priority-high)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(['Alta', 'Media', 'Baja'] as const).map(p => {
                const count = priorityCounts[p];
                const percentage = (count / totalTickets) * 100;
                const color = p === 'Alta' ? 'var(--priority-high)' : p === 'Media' ? 'var(--priority-medium)' : 'var(--priority-low)';
                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.7rem', width: '35px', fontWeight: 600 }}>{p}</span>
                    <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '20px', textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', color: 'var(--status-progress)' }}>
              <Clock size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tiempo Promedio</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{avgResolutionTime}</p>
            </div>
          </div>
        </section>

        {/* Recent Tickets Table */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Tickets Recientes</h3>
            <Link href={currentUser?.role === 'admin' ? "/tickets?view=all" : "/tickets"}>
              <button className="btn" style={{ fontSize: '0.875rem', color: 'var(--accent-color)' }}>Ver todos</button>
            </Link>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>ID</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Asunto</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Solicitante</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Prioridad</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Estado</th>
                  <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Fecha</th>
                  {currentUser?.role?.toLowerCase() === 'admin' && (
                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Acción</th>
                  )}
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.875rem' }}>
                {recentTickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>
                      #{`T-${ticket.id}`}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>
                      {ticket.subject}
                    </td>
                    <td style={{ padding: '1rem 0.5rem' }}>{ticket.requester || 'N/A'}</td>
                    <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.priorityColor }}>{ticket.priority}</span></td>
                    <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.statusColor }}>{ticket.status}</span></td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{ticket.date}</td>
                    {currentUser?.role?.toLowerCase() === 'admin' && (
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTicket(ticket.id, ticket.subject);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title="Eliminar Ticket"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
