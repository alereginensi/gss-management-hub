/**
 * PELIGRO — NO usar contra la base de datos de producción si ya tiene datos reales.
 *
 * Este script hace DROP de logbook, tickets, users y el resto de tablas principales y
 * vuelve a crear el esquema desde cero. Cualquier dato que solo exista en PostgreSQL
 * (p. ej. bitácora / logbook) se pierde. Para subir solo el personal de limpieza desde
 * SQLite local, usa: node scripts/migrate_limpieza_personal_only.cjs
 */
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SQLITE_DB_PATH = path.resolve(process.cwd(), 'tickets.db');
const DATABASE_URL = process.env.DATABASE_URL?.trim();

async function migrate() {
 if (!DATABASE_URL || DATABASE_URL === 'TU_URL_DE_RAILWAY_AQUI') {
 console.error('Error: DATABASE_URL no está configurada correctamente en .env.local');
 console.log('Por favor, edita .env.local y reemplaza TU_URL_DE_RAILWAY_AQUI con la URL real de Railway.');
 return;
 }

 console.log('Opening SQLite database...');
 const sqlite = new Database(SQLITE_DB_PATH);

 console.log('Connecting to PostgreSQL...');
 const pg = new Pool({
 connectionString: DATABASE_URL,
 ssl: { rejectUnauthorized: false }
 });

 try {
 console.log('Resetting and initializing database tables in PostgreSQL...');
 const dropSchema = `
 DROP TABLE IF EXISTS logbook_columns;
 DROP TABLE IF EXISTS counters;
 DROP TABLE IF EXISTS ticket_activities;
 DROP TABLE IF EXISTS notifications;
 DROP TABLE IF EXISTS ticket_collaborators;
 DROP TABLE IF EXISTS job_roles;
 DROP TABLE IF EXISTS sectors;
 DROP TABLE IF EXISTS locations;
 DROP TABLE IF EXISTS supervisor_worker;
 DROP TABLE IF EXISTS tasks;
 DROP TABLE IF EXISTS logbook;
 DROP TABLE IF EXISTS settings;
 DROP TABLE IF EXISTS tickets;
 DROP TABLE IF EXISTS users;
 `;
 await pg.query(dropSchema);

 const schema = `
 CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password TEXT,
 department TEXT NOT NULL,
 role TEXT DEFAULT 'user',
 rubro TEXT,
 approved INTEGER DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE IF NOT EXISTS tickets (
 id TEXT PRIMARY KEY,
 subject TEXT NOT NULL,
 description TEXT NOT NULL,
 department TEXT NOT NULL,
 priority TEXT NOT NULL,
 status TEXT NOT NULL,
 requester TEXT NOT NULL,
 requester_email TEXT,
 affected_worker TEXT,
 date TEXT NOT NULL,
 supervisor TEXT,
 started_at TEXT,
 resolved_at TEXT,
 status_color TEXT,
 created_at TIMESTAMP,
 image_url TEXT,
 audio_url TEXT
 );

 CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
 );

 CREATE TABLE IF NOT EXISTS logbook (
 id SERIAL PRIMARY KEY,
 title TEXT,
 date TEXT NOT NULL,
 sector TEXT,
 supervisor TEXT,
 location TEXT,
 report TEXT,
 staff_member TEXT,
 uniform TEXT,
 supervised_by TEXT,
 extra_data TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE IF NOT EXISTS tasks (
 id SERIAL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 description TEXT,
 type TEXT DEFAULT 'task',
 location TEXT,
 sector TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE IF NOT EXISTS supervisor_worker (
 id SERIAL PRIMARY KEY,
 supervisor_id INTEGER NOT NULL REFERENCES users(id),
 worker_id INTEGER NOT NULL REFERENCES users(id),
 UNIQUE(supervisor_id, worker_id)
 );

 CREATE TABLE IF NOT EXISTS locations (
 id SERIAL PRIMARY KEY,
 name TEXT UNIQUE NOT NULL,
 active INTEGER DEFAULT 1
 );

 CREATE TABLE IF NOT EXISTS sectors (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 location_id INTEGER NOT NULL REFERENCES locations(id),
 active INTEGER DEFAULT 1,
 UNIQUE(name, location_id)
 );

 CREATE TABLE IF NOT EXISTS job_roles (
 id SERIAL PRIMARY KEY,
 name TEXT UNIQUE NOT NULL,
 tasks TEXT,
 active INTEGER DEFAULT 1
 );

 CREATE TABLE IF NOT EXISTS ticket_collaborators (
 id SERIAL PRIMARY KEY,
 ticket_id TEXT NOT NULL REFERENCES tickets(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 added_by INTEGER NOT NULL REFERENCES users(id),
 added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(ticket_id, user_id)
 );

 CREATE TABLE IF NOT EXISTS notifications (
 id SERIAL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 ticket_id TEXT REFERENCES tickets(id),
 message TEXT NOT NULL,
 type TEXT DEFAULT 'info',
 read INTEGER DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE IF NOT EXISTS ticket_activities (
 id SERIAL PRIMARY KEY,
 ticket_id TEXT NOT NULL REFERENCES tickets(id),
 user_name TEXT NOT NULL,
 user_email TEXT,
 message TEXT NOT NULL,
 type TEXT DEFAULT 'comment',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE IF NOT EXISTS counters (
 key TEXT PRIMARY KEY,
 value INTEGER NOT NULL
 );

 CREATE TABLE IF NOT EXISTS logbook_columns (
 name TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 type TEXT NOT NULL,
 options TEXT
 );
 `;
 await pg.query(schema);
 console.log('PostgreSQL tables verified/created');

 // 1. Migrate Users
 console.log('Migrating users...');
 const users = sqlite.prepare('SELECT * FROM users').all();
 for (const user of users) {
 const { id, name, email, password, department, role, rubro, approved, createdAt } = user as any;
 await pg.query(
 'INSERT INTO users (id, name, email, password, department, role, rubro, approved, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (email) DO NOTHING',
 [id, name, email, password, department, role, rubro, approved, createdAt ? new Date(createdAt) : new Date()]
 );
 }

 // 2. Migrate Locations
 console.log('Migrating locations...');
 const locations = sqlite.prepare('SELECT * FROM locations').all();
 for (const loc of locations) {
 const { id, name, active } = loc as any;
 await pg.query(
 'INSERT INTO locations (id, name, active) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
 [id, name, active]
 );
 }

 // 3. Migrate Sectors
 console.log('Migrating sectors...');
 const sectors = sqlite.prepare('SELECT * FROM sectors').all();
 for (const sec of sectors) {
 const { id, name, location_id, active } = sec as any;
 await pg.query(
 'INSERT INTO sectors (id, name, location_id, active) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
 [id, name, location_id, active]
 );
 }

 // 4. Migrate Tickets
 console.log('Migrating tickets...');
 const tickets = sqlite.prepare('SELECT * FROM tickets').all();
 for (const ticket of tickets) {
 const { id, date, subject, department, requester, requesterEmail, description, priority, status, supervisor, affected_worker, image_url, audio_url, startedAt, resolvedAt, statusColor, createdAt } = ticket as any;
 await pg.query(
 'INSERT INTO tickets (id, date, subject, department, requester, requester_email, description, priority, status, supervisor, affected_worker, image_url, audio_url, started_at, resolved_at, status_color, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT (id) DO NOTHING',
 [id, date, subject, department, requester, requesterEmail, description, priority, status, supervisor, affected_worker, image_url, audio_url, startedAt, resolvedAt, statusColor, createdAt ? new Date(createdAt) : new Date()]
 );
 }

 // 5. Migrate Logbook
 console.log('Migrating logbook...');
 const entries = sqlite.prepare('SELECT * FROM logbook').all();
 for (const entry of entries) {
 const { id, date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by, createdAt } = entry as any;
 await pg.query(
 'INSERT INTO logbook (id, date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING',
 [id, date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by, createdAt ? new Date(createdAt) : new Date()]
 );
 }

 // 6. Migrate Tasks
 console.log('Migrating tasks...');
 const tasks = sqlite.prepare('SELECT * FROM tasks').all();
 for (const task of tasks) {
 const { id, user_id, description, type, created_at, location, sector } = task as any;
 await pg.query(
 'INSERT INTO tasks (id, user_id, description, type, created_at, location, sector) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
 [id, user_id, description, type, created_at, location, sector]
 );
 }

 // 7. Migrate Notifications
 console.log('Migrating notifications...');
 const notifications = sqlite.prepare('SELECT * FROM notifications').all();
 for (const notif of notifications) {
 const { id, user_id, ticket_id, message, read, type, created_at } = notif as any;
 await pg.query(
 'INSERT INTO notifications (id, user_id, ticket_id, message, read, type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
 [id, user_id, ticket_id, message, read, type, created_at]
 );
 }

 // 8. Migrate Ticket Activities
 console.log('Migrating ticket activities...');
 const activities = sqlite.prepare('SELECT * FROM ticket_activities').all();
 for (const act of activities) {
 const { id, ticket_id, user_name, user_email, message, created_at, type } = act as any;
 await pg.query(
 'INSERT INTO ticket_activities (id, ticket_id, user_name, user_email, message, created_at, type) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
 [id, ticket_id, user_name, user_email, message, created_at, type]
 );
 }

 // 9. Migrate Ticket Collaborators
 console.log('Migrating ticket collaborators...');
 const collaborators = sqlite.prepare('SELECT * FROM ticket_collaborators').all();
 for (const col of collaborators) {
 const { id, ticket_id, user_id, added_by, added_at } = col as any;
 await pg.query(
 'INSERT INTO ticket_collaborators (id, ticket_id, user_id, added_by, added_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
 [id, ticket_id, user_id, added_by, added_at]
 );
 }

 // 10. Migrate Settings
 console.log('Migrating settings...');
 const settings = sqlite.prepare('SELECT * FROM settings').all();
 for (const set of settings) {
 const { key, value } = set as any;
 await pg.query(
 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
 [key, value]
 );
 }

 // 11. Migrate Job Roles
 console.log('Migrating job roles...');
 const roles = sqlite.prepare('SELECT * FROM job_roles').all();
 for (const role of roles) {
 const { id, name, tasks, active } = role as any;
 await pg.query(
 'INSERT INTO job_roles (id, name, tasks, active) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
 [id, name, tasks, active]
 );
 }

 // 12. Migrate Supervisor Worker relationship
 console.log('Migrating supervisor workers...');
 const supWorkers = sqlite.prepare('SELECT * FROM supervisor_worker').all();
 for (const sw of supWorkers) {
 const { id, supervisor_id, worker_id } = sw as any;
 await pg.query(
 'INSERT INTO supervisor_worker (id, supervisor_id, worker_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
 [id, supervisor_id, worker_id]
 );
 }

 // 13. Migrate Counters
 console.log('Migrating counters...');
 try {
 const counters = sqlite.prepare('SELECT * FROM counters').all();
 for (const count of counters) {
 const { key, value } = count as any;
 await pg.query(
 'INSERT INTO counters (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
 [key, value]
 );
 }
 } catch (e) {
 console.log('ℹNo counters table found in SQLite, skipping migration (will initialize in Postgres).');
 }

 // Ensure ticket_id exists if not migrated
 const checkTicketCounter = await pg.query('SELECT * FROM counters WHERE key = $1', ['ticket_id']);
 if (checkTicketCounter.rows.length === 0) {
 console.log('ℹticket_id counter not found, initializing...');
 // Try to find max ticket ID if numeric
 const maxTicket = await pg.query('SELECT id FROM tickets WHERE id ~ \'^[0-9]+$\' ORDER BY id::integer DESC LIMIT 1');
 const startVal = maxTicket.rows.length > 0 ? parseInt(maxTicket.rows[0].id) + 1 : 1000;
 await pg.query('INSERT INTO counters (key, value) VALUES ($1, $2)', ['ticket_id', startVal]);
 console.log(`ticket_id counter set to ${startVal}`);
 }

 // 14. Migrate Logbook Columns
 console.log('Migrating logbook columns...');
 const logCols = sqlite.prepare('SELECT * FROM logbook_columns').all();
 for (const lc of logCols) {
 const { name, label, type, options } = lc as any;
 await pg.query(
 'INSERT INTO logbook_columns (name, label, type, options) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING',
 [name, label, type, options]
 );
 }

 // Adjust sequences (Postgres specific)
 console.log('Adjusting ID sequences...');
 const tables = ['users', 'locations', 'sectors', 'logbook', 'tasks', 'notifications', 'ticket_activities', 'ticket_collaborators', 'job_roles'];
 for (const table of tables) {
 try {
 await pg.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
 } catch (e) {
 // Some tables might not have standard serial id
 }
 }

 console.log('Migration completed successfully!');
 } catch (error) {
 console.error('Migration failed:', error);
 } finally {
 await pg.end();
 sqlite.close();
 }
}

migrate();
