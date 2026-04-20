import db from '@/lib/db';
import type {
  AuditAction,
  AuditEntityType,
  AgendaArticle,
  OrderItem,
} from '@/lib/agenda-types';

// ─── Fechas y vencimientos ───────────────────────────────────────────────────

export function calculateExpirationDate(deliveryDate: string, usefulLifeMonths: number): string {
  const date = new Date(deliveryDate);
  date.setMonth(date.getMonth() + usefulLifeMonths);
  return date.toISOString().split('T')[0];
}

export function isRenewalEnabled(expirationDate: string): boolean {
  return new Date(expirationDate) <= new Date();
}

export function daysUntilExpiration(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Hold de turnos (atómico SQLite/Postgres) ────────────────────────────────

export async function holdSlot(
  slotId: number,
  holdToken: string,
  holdSeconds: number
): Promise<boolean> {
  const isPg = (db as any).type === 'pg';

  let result: { changes: number };
  if (isPg) {
    const pgText = `
      UPDATE agenda_time_slots
      SET held_until = NOW() + INTERVAL '${holdSeconds} seconds', hold_token = ?
      WHERE id = ?
        AND (held_until IS NULL OR held_until::timestamptz < NOW())
        AND current_bookings < CASE WHEN capacity > 0 THEN capacity ELSE 1 END
        AND estado = 'activo'
    `;
    result = await db.run(pgText, [holdToken, slotId]);
  } else {
    const sqliteText = `
      UPDATE agenda_time_slots
      SET held_until = datetime('now', '+${holdSeconds} seconds'), hold_token = ?
      WHERE id = ?
        AND (held_until IS NULL OR held_until < datetime('now'))
        AND current_bookings < capacity
        AND estado = 'activo'
    `;
    result = await db.run(sqliteText, [holdToken, slotId]);
  }

  return result.changes > 0;
}

export async function releaseHold(slotId: number, holdToken: string): Promise<boolean> {
  const result = await db.run(
    `UPDATE agenda_time_slots SET held_until = NULL, hold_token = NULL WHERE id = ? AND hold_token = ?`,
    [slotId, holdToken]
  );
  return result.changes > 0;
}

export async function getSlotConfig(): Promise<{ hold_duration_seconds: number; min_advance_hours: number; public_contact_whatsapp: string }> {
  const cfg = await db.get('SELECT hold_duration_seconds, min_advance_hours, public_contact_whatsapp FROM agenda_config WHERE id = 1');
  return cfg || { hold_duration_seconds: 60, min_advance_hours: 2, public_contact_whatsapp: '' };
}

// ─── Confirmación de cita (incrementar bookings) ─────────────────────────────

export async function confirmSlotBooking(slotId: number, holdToken: string): Promise<boolean> {
  const result = await db.run(
    `UPDATE agenda_time_slots
     SET current_bookings = current_bookings + 1, held_until = NULL, hold_token = NULL
     WHERE id = ? AND hold_token = ?`,
    [slotId, holdToken]
  );
  return result.changes > 0;
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export async function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: number | null,
  userId: number | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.run(
      `INSERT INTO agenda_audit_log (action, entity_type, entity_id, user_id, details) VALUES (?, ?, ?, ?, ?)`,
      [action, entityType, entityId, userId, details ? JSON.stringify(details) : null]
    );
  } catch {
    // Auditoría no debe romper el flujo principal
  }
}

// ─── Badges y estados ────────────────────────────────────────────────────────

export function getAppointmentStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirmada:    { label: 'Confirmada',    color: '#1e40af', bg: '#dbeafe' },
    en_proceso:    { label: 'En Proceso',    color: '#92400e', bg: '#fef3c7' },
    completada:    { label: 'Completada',    color: '#065f46', bg: '#d1fae5' },
    cancelada:     { label: 'Cancelada',     color: '#7f1d1d', bg: '#fee2e2' },
    ausente:       { label: 'Ausente',       color: '#4b5563', bg: '#f3f4f6' },
    reprogramada:  { label: 'Reprogramada',  color: '#5b21b6', bg: '#ede9fe' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}

export function getArticleStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    activo:      { label: 'Activo',    color: '#065f46', bg: '#d1fae5' },
    renovado:    { label: 'Renovado',  color: '#1e40af', bg: '#dbeafe' },
    devuelto:    { label: 'Devuelto',  color: '#4b5563', bg: '#f3f4f6' },
    extraviado:  { label: 'Extraviado', color: '#7f1d1d', bg: '#fee2e2' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}

export function getShipmentStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    preparado:   { label: 'Preparado',   color: '#92400e', bg: '#fef3c7' },
    despachado:  { label: 'Despachado',  color: '#1e40af', bg: '#dbeafe' },
    en_transito: { label: 'En Tránsito', color: '#5b21b6', bg: '#ede9fe' },
    entregado:   { label: 'Entregado',   color: '#065f46', bg: '#d1fae5' },
    recibido:    { label: 'Recibido',    color: '#065f46', bg: '#d1fae5' },
    incidente:   { label: 'Incidente',   color: '#7f1d1d', bg: '#fee2e2' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}

// ─── Helpers de artículos ────────────────────────────────────────────────────

export function parseOrderItems(raw: unknown): OrderItem[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

export function articleNeedsRenewal(article: AgendaArticle): boolean {
  if (!article.expiration_date) return false;
  return isRenewalEnabled(article.expiration_date) && article.current_status === 'activo';
}

// ─── Generación de slots ─────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Calcula los horarios de N turnos distribuidos entre start_hour y end_hour,
 * saltando el período de descanso si se especifica.
 * Devuelve array de { start_time, end_time } en formato HH:MM.
 */
export function calculateSlotTimes(params: {
  start_hour: string;
  end_hour: string;
  num_slots: number;
  has_break: boolean;
  break_start?: string;
  break_end?: string;
}): { start_time: string; end_time: string }[] {
  const { start_hour, end_hour, num_slots, has_break, break_start, break_end } = params;

  const startMin = toMinutes(start_hour);
  const endMin = toMinutes(end_hour);
  const breakStartMin = has_break && break_start ? toMinutes(break_start) : null;
  const breakEndMin = has_break && break_end ? toMinutes(break_end) : null;
  const breakDuration = (breakStartMin !== null && breakEndMin !== null) ? (breakEndMin - breakStartMin) : 0;

  const availableMinutes = endMin - startMin - breakDuration;
  if (availableMinutes <= 0 || num_slots <= 0) return [];

  const slotDuration = Math.floor(availableMinutes / num_slots);
  if (slotDuration <= 0) return [];

  const slots: { start_time: string; end_time: string }[] = [];
  let cursor = startMin;

  for (let i = 0; i < num_slots; i++) {
    // Saltar descanso si el cursor cae dentro o en el inicio del descanso
    if (breakStartMin !== null && breakEndMin !== null && cursor >= breakStartMin && cursor < breakEndMin) {
      cursor = breakEndMin;
    }
    // También saltar si el slot anterior llegó justo al inicio del descanso
    if (breakStartMin !== null && breakEndMin !== null && cursor === breakStartMin) {
      cursor = breakEndMin;
    }

    const slotEnd = cursor + slotDuration;
    if (slotEnd > endMin) break;

    slots.push({ start_time: toHHMM(cursor), end_time: toHHMM(slotEnd) });
    cursor = slotEnd;
  }

  return slots;
}

export async function generateSlotsForMonth(params: {
  year: number;
  month: number;
  days_of_week: number[];
  start_hour: string;
  end_hour: string;
  num_slots: number;
  has_break: boolean;
  break_start?: string;
  break_end?: string;
  capacity: number;
}): Promise<{ created: number; skipped: number }> {
  const { year, month, days_of_week, capacity } = params;
  const isPg = (db as any).type === 'pg';

  // Calcular los horarios de turnos una sola vez (igual para todos los días)
  const slotTimes = calculateSlotTimes(params);
  if (slotTimes.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (!days_of_week.includes(date.getDay())) continue;

    const fechaStr = date.toISOString().split('T')[0];

    for (const { start_time, end_time } of slotTimes) {
      const existing = await db.get(
        'SELECT id FROM agenda_time_slots WHERE fecha = ? AND start_time = ?',
        [fechaStr, start_time]
      );

      if (existing) {
        skipped++;
      } else {
        const insertSql = isPg
          ? 'INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING'
          : 'INSERT OR IGNORE INTO agenda_time_slots (fecha, start_time, end_time, capacity) VALUES (?,?,?,?)';
        await db.run(insertSql.replace(/\$\d/g, '?'), [fechaStr, start_time, end_time, capacity]);
        created++;
      }
    }
  }

  return { created, skipped };
}
