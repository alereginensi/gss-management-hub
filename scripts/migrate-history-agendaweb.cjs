/**
 * MIGRACIÓN DE HISTORIAL (TURNOS, CITAS, INTENTOS FALLIDOS) DESDE GSS-AGENDA-WEB
 * 
 * Uso: SOURCE_DB_URL="posgresql://..." node scripts/migrate-history-agendaweb.cjs
 */
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), override: true });

const SOURCE_URL = process.env.SOURCE_DB_URL;
const DEST_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!SOURCE_URL) {
 console.error('Error: SOURCE_DB_URL no definida.');
 process.exit(1);
}

async function migrate() {
 console.log('Iniciando migración de historial...');

 const sourcePool = new Pool({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
 
 let destDb;
 let isPg = false;
 if (DEST_URL) {
 console.log('Conectando a destino PostgreSQL...');
 destDb = new Pool({ connectionString: DEST_URL, ssl: { rejectUnauthorized: false } });
 isPg = true;
 } else {
 console.log('Conectando a destino SQLite (tickets.db)...');
 destDb = new Database(path.join(process.cwd(), 'tickets.db'));
 }

 try {
 // 1. Mapear Empleados por Documento (para obtener IDs actuales en el Hub)
 console.log('Mapeando empleados actuales...');
 const employeesRows = isPg 
 ? (await destDb.query('SELECT id, documento FROM agenda_employees')).rows
 : destDb.prepare('SELECT id, documento FROM agenda_employees').all();
 
 const empMap = new Map(); // documento -> id_hub
 employeesRows.forEach(e => empMap.set(String(e.documento), e.id));

 // 2. Migrar TimeSlots
 console.log('Migrando franjas horarias (TimeSlots)...');
 
 if (isPg) {
 try {
 await destDb.query('ALTER TABLE agenda_time_slots ADD CONSTRAINT unique_agenda_slots UNIQUE (fecha, start_time, end_time)');
 console.log('Restricción única añadida a PostgreSQL.');
 } catch (err) {
 // Ignorar si ya existe
 }
 }

 const { rows: sourceSlots } = await sourcePool.query('SELECT * FROM time_slots');
 const slotMap = new Map(); // old_id -> new_id
 
 for (const slot of sourceSlots) {
 const fechaStr = slot.date.toISOString().split('T')[0];
 try {
 let newSlotId;
 if (isPg) {
 const res = await destDb.query(`
 INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity, current_bookings, estado, created_at)
 VALUES ($1, $2, $3, $4, $5, 'activo', $6)
 ON CONFLICT (fecha, start_time, end_time) DO UPDATE SET 
 capacity = EXCLUDED.capacity, 
 current_bookings = EXCLUDED.current_bookings
 RETURNING id
 `, [fechaStr, slot.start_time, slot.end_time, slot.max_capacity, slot.current_bookings, slot.created_at]);
 newSlotId = res.rows[0].id;
 } else {
 // SQLite no tiene ON CONFLICT múltiple fácil aquí, usamos INSERT o IGNORE y luego SELECT
 destDb.prepare(`
 INSERT OR IGNORE INTO agenda_time_slots (fecha, start_time, end_time, capacity, current_bookings, estado)
 VALUES (?, ?, ?, ?, ?, 'activo')
 `).run(fechaStr, slot.start_time, slot.end_time, slot.max_capacity, slot.current_bookings);
 
 const row = destDb.prepare('SELECT id FROM agenda_time_slots WHERE fecha = ? AND start_time = ? AND end_time = ?').get(fechaStr, slot.start_time, slot.end_time);
 newSlotId = row.id;
 }
 slotMap.set(slot.id, newSlotId);
 } catch (err) {
 console.error(`Error en slot ${slot.id}:`, err.message);
 }
 }
 console.log(`${slotMap.size} franjas horarias procesadas.`);

 // 3. Migrar Appointments
 console.log('Migrando citas (Appointments)...');
 const { rows: sourceApps } = await sourcePool.query(`
 SELECT a.*, e.document_number 
 FROM appointments a
 JOIN employees e ON a.employee_id = e.id
 `);
 
 if (isPg) {
 try {
 await destDb.query('ALTER TABLE agenda_appointments ADD CONSTRAINT unique_appt_slot UNIQUE (employee_id, time_slot_id)');
 console.log('Restricción única añadida a Citas en PostgreSQL.');
 } catch (err) {}
 }

 let appCount = 0;
 for (const app of sourceApps) {
 const hubEmpId = empMap.get(String(app.document_number));
 const hubSlotId = slotMap.get(app.time_slot_id);

 if (!hubEmpId || !hubSlotId) continue;

 const employeeSig = app.signature_staff_url || app.signature_url || null;
 const logisticsSig = app.signature_logistics_url || null;

 try {
 if (isPg) {
 await destDb.query(`
 INSERT INTO agenda_appointments (
 employee_id, time_slot_id, status, order_items, delivered_order_items, 
 remito_number, remito_pdf_url, employee_signature_url, responsible_signature_url, 
 delivery_notes, delivered_at, created_at, updated_at
 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
 ON CONFLICT (employee_id, time_slot_id) DO UPDATE SET
 remito_pdf_url = EXCLUDED.remito_pdf_url,
 employee_signature_url = EXCLUDED.employee_signature_url,
 responsible_signature_url = EXCLUDED.responsible_signature_url,
 remito_number = EXCLUDED.remito_number,
 status = EXCLUDED.status,
 delivered_at = EXCLUDED.delivered_at
 `, [
 hubEmpId, hubSlotId, app.status, JSON.stringify(app.order_items), 
 app.delivered_order_items ? JSON.stringify(app.delivered_order_items) : null,
 app.remito_number, app.delivery_note_url, employeeSig, logisticsSig, app.notes, 
 app.resolved_at ? (typeof app.resolved_at === 'string' ? app.resolved_at : app.resolved_at.toISOString()) : null,
 app.created_at || new Date(), app.created_at || new Date()
 ]);
 } else {
 destDb.prepare(`
 INSERT OR REPLACE INTO agenda_appointments (
 employee_id, time_slot_id, status, order_items, delivered_order_items, 
 remito_number, remito_pdf_url, employee_signature_url, responsible_signature_url, 
 delivery_notes, delivered_at, created_at, updated_at
 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 `).run(
 hubEmpId, hubSlotId, app.status, JSON.stringify(app.order_items), 
 app.delivered_order_items ? JSON.stringify(app.delivered_order_items) : null,
 app.remito_number, app.delivery_note_url, employeeSig, logisticsSig, app.notes, 
 app.resolved_at ? (typeof app.resolved_at === 'string' ? app.resolved_at : app.resolved_at.toISOString()) : null,
 (app.created_at || new Date()).toISOString(), (app.created_at || new Date()).toISOString()
 );
 }
 appCount++;
 } catch (err) {
 console.error(`Error en cita ${app.id}:`, err.message);
 }
 }
 console.log(`${appCount} citas migradas.`);

 /*
 // 4. Migrar Failed Attempts
 console.log('Migrando intentos fallidos (No Habilitados)...');
 const { rows: sourceFailed } = await sourcePool.query('SELECT * FROM failed_attempts');
 let failedCount = 0;
 
 for (const f of sourceFailed) {
 try {
 if (isPg) {
 await destDb.query(`
 INSERT INTO agenda_failed_attempts (documento, motivo, created_at)
 VALUES ($1, $2, $3)
 `, [f.document_number, f.reason, f.created_at]);
 } else {
 destDb.prepare(`
 INSERT INTO agenda_failed_attempts (documento, motivo, created_at)
 VALUES (?, ?, ?)
 `).run(f.document_number, f.reason, f.created_at.toISOString());
 }
 failedCount++;
 } catch (err) {
 console.error(`Error en intento fallido ${f.id}:`, err.message);
 }
 }
 console.log(`${failedCount} intentos fallidos migrados.`);
 */

 console.log('\nMigración de historial finalizada con éxito.');

 } finally {
 await sourcePool.end();
 if (isPg) await destDb.end();
 else destDb.close();
 }
}

migrate().catch(err => {
 console.error('Error fatal:', err);
 process.exit(1);
});
