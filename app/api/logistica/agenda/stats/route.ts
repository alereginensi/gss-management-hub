import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];

  try {
    const [
      citasHoy,
      citasPendientes,
      citasCompletadas,
      empleadosTotal,
      empleadosHabilitados,
      slotsDisponiblesHoy,
      intentosFallidos,
      articulosVencidos,
      articulosHabilitadosRenovacion,
      solicitudesPendientes,
      solicitudesEmergentes,
      totalHistorico,
    ] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM agenda_appointments a JOIN agenda_time_slots s ON s.id = a.time_slot_id WHERE s.fecha = ?`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_appointments a JOIN agenda_time_slots s ON s.id = a.time_slot_id WHERE s.fecha = ? AND a.status = 'confirmada'`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_appointments a JOIN agenda_time_slots s ON s.id = a.time_slot_id WHERE s.fecha = ? AND a.status = 'completada'`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_employees WHERE estado = 'activo'`, []),
      db.get(`SELECT COUNT(*) as count FROM agenda_employees WHERE estado = 'activo' AND enabled = 1`, []),
      db.get(`SELECT COALESCE(SUM(capacity - current_bookings), 0) as count FROM agenda_time_slots WHERE fecha = ? AND estado = 'activo' AND current_bookings < capacity`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_failed_attempts WHERE date(created_at) = ?`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_articles WHERE current_status = 'activo' AND expiration_date IS NOT NULL AND expiration_date < ?`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_articles WHERE current_status = 'activo' AND renewal_enabled_at IS NOT NULL AND renewal_enabled_at <= ?`, [today]),
      db.get(`SELECT COUNT(*) as count FROM agenda_requests WHERE status = 'pendiente'`, []),
      db.get(`SELECT COUNT(*) as count FROM agenda_requests WHERE status = 'pendiente' AND is_emergency = 1`, []),
      db.get(`SELECT COUNT(*) as count FROM agenda_appointments`, []),
    ]);

    return NextResponse.json({
      hoy: {
        fecha: today,
        citas_total: citasHoy?.count || 0,
        citas_pendientes: citasPendientes?.count || 0,
        citas_completadas: citasCompletadas?.count || 0,
        cupos_disponibles: slotsDisponiblesHoy?.count || 0,
        intentos_fallidos: intentosFallidos?.count || 0,
        total_historico: totalHistorico?.count || 0,
      },
      empleados: {
        total: empleadosTotal?.count || 0,
        habilitados: empleadosHabilitados?.count || 0,
      },
      alertas: {
        articulos_vencidos: articulosVencidos?.count || 0,
        articulos_habilitados_renovacion: articulosHabilitadosRenovacion?.count || 0,
        solicitudes_pendientes: solicitudesPendientes?.count || 0,
        solicitudes_emergentes: solicitudesEmergentes?.count || 0,
      },
    });
  } catch (err) {
    console.error('Error en stats agenda:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
