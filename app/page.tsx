'use client';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useTicketContext } from './context/TicketContext';

export default function Home() {
  const { tickets, getAverageResolutionTime } = useTicketContext();

  // Calculate KPIs from tickets
  const openTickets = tickets.filter(t => t.status === 'Nuevo' || t.status === 'En Progreso').length;
  const resolvedToday = tickets.filter(t => t.status === 'Resuelto').length;
  const highPriority = tickets.filter(t => t.priority === 'Alta').length;
  const avgResolutionTime = getAverageResolutionTime();

  // Get recent tickets (first 3)
  const recentTickets = tickets.slice(0, 3);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <main style={{
        flex: 1,
        marginLeft: '260px', /* Width of sidebar */
        padding: '2rem',
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
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tickets Abiertos</p>
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

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: 'var(--priority-high)' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Prioridad Alta</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{highPriority}</p>
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
            <Link href="/tickets">
              <button className="btn" style={{ fontSize: '0.875rem', color: 'var(--accent-color)' }}>Ver todos</button>
            </Link>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>ID</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Asunto</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Solicitante</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Prioridad</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Fecha</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {recentTickets.map(ticket => (
                <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>#{`T-${ticket.id}`}</td>
                  <td style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>{ticket.subject}</td>
                  <td style={{ padding: '1rem 0.5rem' }}>{ticket.requester || 'N/A'}</td>
                  <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.priorityColor }}>{ticket.priority}</span></td>
                  <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.statusColor }}>{ticket.status}</span></td>
                  <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{ticket.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
