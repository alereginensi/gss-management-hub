/**
 * Seed script for local development.
 * Creates users, tickets, logbook entries, and attendance records.
 *
 * Usage:
 *   npm run seed
 *
 * Options:
 *   TEST_PASS=env var — password for all seed users (default: Dev1234!)
 *   CLEAN=1           — delete all existing seed data before inserting
 */

require('dotenv').config({ path: '.env.local' });
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(DB_PATH);

const PASS = process.env.TEST_PASS || 'Dev1234!';
const CLEAN = process.env.CLEAN === '1';

const SEED_EMAILS = [
  'admin@example.com',
  'jefe@example.com',
  'supervisor@example.com',
  'funcionario1@example.com',
  'funcionario2@example.com',
  'tecnico@example.com',
  'logistica@example.com',
  'contador@example.com',
  'rrhh@example.com',
  'encargado@example.com',
];

// ── Limpieza opcional ────────────────────────────────────────────────────────

if (CLEAN) {
  console.log('Limpiando datos seed anteriores...');
  const ids = db
    .prepare(`SELECT id FROM users WHERE email IN (${SEED_EMAILS.map(() => '?').join(',')})`)
    .all(...SEED_EMAILS)
    .map(u => u.id);

  if (ids.length) {
    db.prepare(`DELETE FROM tasks WHERE user_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }

  db.prepare("DELETE FROM tickets WHERE id LIKE 'SEED-%'").run();
  db.prepare("DELETE FROM logbook WHERE supervisor = 'seed-dev'").run();
  console.log('Limpieza completa.\n');
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

const hash = bcrypt.hashSync(PASS, 10);

const USERS = [
  { name: 'Admin Dev',           email: 'admin@example.com',        role: 'admin',              department: 'IT',            rubro: 'IT' },
  { name: 'Jefe Operaciones',    email: 'jefe@example.com',         role: 'jefe',               department: 'Operaciones',   rubro: 'Operaciones' },
  { name: 'Supervisor Limpieza', email: 'supervisor@example.com',   role: 'supervisor',         department: 'Limpieza',      rubro: 'Limpieza' },
  { name: 'Funcionario Uno',     email: 'funcionario1@example.com', role: 'funcionario',        department: 'Limpieza',      rubro: 'Limpieza' },
  { name: 'Funcionario Dos',     email: 'funcionario2@example.com', role: 'funcionario',        department: 'Mantenimiento', rubro: 'Mantenimiento' },
  { name: 'Técnico Electrónica', email: 'tecnico@example.com',      role: 'tecnico',            department: 'Seguridad',     rubro: 'Seguridad Electrónica' },
  { name: 'Encargado Logística', email: 'logistica@example.com',    role: 'logistica',          department: 'Logística',     rubro: 'Logística' },
  { name: 'Contador GSS',        email: 'contador@example.com',     role: 'contador',           department: 'Finanzas',      rubro: 'Administración' },
  { name: 'RRHH Dev',            email: 'rrhh@example.com',         role: 'rrhh',               department: 'RRHH',          rubro: 'RRHH' },
  { name: 'Encargado Limpieza',  email: 'encargado@example.com',    role: 'encargado_limpieza', department: 'Limpieza',      rubro: 'Limpieza' },
];

const upsertUser = db.prepare(`
  INSERT INTO users (name, email, password, department, role, rubro, approved)
  VALUES (@name, @email, @password, @department, @role, @rubro, 1)
  ON CONFLICT(email) DO UPDATE SET role=excluded.role, approved=1
`);

const userIds = {};
console.log('Usuarios:');
for (const u of USERS) {
  upsertUser.run({ ...u, password: hash });
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  userIds[u.email] = row.id;
  console.log(`  [${String(row.id).padStart(3)}] ${u.name.padEnd(24)} rol: ${u.role}`);
}

// ── Tickets ──────────────────────────────────────────────────────────────────

const upsertTicket = db.prepare(`
  INSERT OR REPLACE INTO tickets
    (id, subject, description, department, priority, status, requester, requester_email, date, status_color, created_at)
  VALUES
    (@id, @subject, @description, @department, @priority, @status, @requester, @requester_email, @date, @status_color, @created_at)
`);

const TICKETS = [
  {
    id: 'SEED-001',
    subject: 'Fallo en iluminación piso 2',
    description: 'Las luces del piso 2 parpadean de forma intermitente desde el lunes.',
    department: 'Mantenimiento', priority: 'Alta', status: 'Nuevo',
    requester: 'Supervisor Limpieza', requester_email: 'supervisor@example.com',
    date: daysAgo(3, 'date'), status_color: '#3b82f6', created_at: daysAgo(3),
  },
  {
    id: 'SEED-002',
    subject: 'Solicitud de limpieza profunda — sala de reuniones A',
    description: 'Se requiere limpieza profunda antes del evento del viernes.',
    department: 'Limpieza', priority: 'Media', status: 'En Progreso',
    requester: 'Jefe Operaciones', requester_email: 'jefe@example.com',
    date: daysAgo(5, 'date'), status_color: '#eab308', created_at: daysAgo(5),
  },
  {
    id: 'SEED-003',
    subject: 'Usuario no puede iniciar sesión tras cambio de contraseña',
    description: 'Un usuario de RRHH no puede acceder al sistema luego del cambio forzado.',
    department: 'IT', priority: 'Alta', status: 'Resuelto',
    requester: 'RRHH Dev', requester_email: 'rrhh@example.com',
    date: daysAgo(7, 'date'), status_color: '#22c55e', created_at: daysAgo(7),
  },
  {
    id: 'SEED-004',
    subject: 'Uniformes para ingreso de nuevo personal la próxima semana',
    description: 'Se incorporan 3 funcionarios. Requieren kit completo (camisa, pantalón, calzado).',
    department: 'Logística', priority: 'Media', status: 'Nuevo',
    requester: 'Encargado Logística', requester_email: 'logistica@example.com',
    date: daysAgo(1, 'date'), status_color: '#3b82f6', created_at: daysAgo(1),
  },
  {
    id: 'SEED-005',
    subject: 'Mantenimiento preventivo cámaras — cliente Central',
    description: 'Vencimiento del mantenimiento trimestral de las cámaras en Edificio Central.',
    department: 'Seguridad Electrónica', priority: 'Baja', status: 'Cerrado',
    requester: 'Técnico Electrónica', requester_email: 'tecnico@example.com',
    date: daysAgo(14, 'date'), status_color: '#6b7280', created_at: daysAgo(14),
  },
];

console.log('\nTickets:');
for (const t of TICKETS) {
  upsertTicket.run(t);
  console.log(`  ${t.id}  [${t.status.padEnd(11)}]  ${t.subject}`);
}

// ── Bitácora ─────────────────────────────────────────────────────────────────

const insertLogbook = db.prepare(`
  INSERT INTO logbook (title, date, time, sector, supervisor, location, incident, report, created_at)
  VALUES (@title, @date, @time, @sector, @supervisor, @location, @incident, @report, @created_at)
`);

const existingLogbook = db
  .prepare("SELECT COUNT(*) as c FROM logbook WHERE supervisor = 'seed-dev'")
  .get();

if (existingLogbook.c === 0) {
  const LOGBOOK = [
    {
      title: 'Inspección matutina — piso 1',
      date: daysAgo(1, 'date'), time: '08:15', sector: 'Planta Baja',
      supervisor: 'seed-dev', location: 'Edificio Central',
      incident: 'Sin novedades',
      report: 'Personal completo. Área en condiciones óptimas.',
      created_at: daysAgo(1),
    },
    {
      title: 'Novedad — derrame sector cocina',
      date: daysAgo(2, 'date'), time: '11:30', sector: 'Cocina',
      supervisor: 'seed-dev', location: 'Planta Industrial',
      incident: 'Derrame de líquido en sector cocina.',
      report: 'Se limpió de inmediato. Sin lesionados. Área habilitada a las 12:00.',
      created_at: daysAgo(2),
    },
    {
      title: 'Cierre de turno noche',
      date: daysAgo(3, 'date'), time: '22:00', sector: 'General',
      supervisor: 'seed-dev', location: 'Edificio Central',
      incident: 'Sin novedades',
      report: 'Ronda completa. Todo en orden. Personal retirado a horario.',
      created_at: daysAgo(3),
    },
  ];

  console.log('\nBitácora:');
  for (const l of LOGBOOK) {
    insertLogbook.run(l);
    console.log(`  ${l.date} ${l.time}  ${l.location} — ${l.sector}`);
  }
}

// ── Asistencia (tasks) ───────────────────────────────────────────────────────

const insertTask = db.prepare(`
  INSERT INTO tasks (user_id, description, type, created_at, location, sector)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const FUNCIONARIOS = [
  { email: 'funcionario1@example.com', location: 'Edificio Central',  sector: 'Planta Baja' },
  { email: 'funcionario2@example.com', location: 'Planta Industrial', sector: 'Sector B' },
];

const existingTasks = db
  .prepare(`SELECT COUNT(*) as c FROM tasks WHERE user_id IN (${FUNCIONARIOS.map(() => '?').join(',')})`)
  .get(...FUNCIONARIOS.map(f => userIds[f.email]));

if (existingTasks.c === 0) {
  console.log('\nAsistencia:');
  for (let day = 0; day < 5; day++) {
    for (const f of FUNCIONARIOS) {
      const uid = userIds[f.email];
      const base = new Date();
      base.setDate(base.getDate() - day);

      const checkIn = new Date(base);
      checkIn.setHours(8, rand(0, 30), 0, 0);
      insertTask.run(uid, `Ingreso en ${f.location} — ${f.sector}`, 'check_in', checkIn.toISOString(), f.location, f.sector);

      const numTasks = 2 + rand(0, 2);
      const taskDescs = ['Limpieza de área', 'Revisión de equipos', 'Control de acceso', 'Reposición de insumos'];
      for (let i = 0; i < numTasks; i++) {
        const t = new Date(checkIn);
        t.setHours(9 + i * 2, rand(0, 59), 0, 0);
        insertTask.run(uid, taskDescs[rand(0, taskDescs.length - 1)], 'task', t.toISOString(), f.location, f.sector);
      }

      const checkOut = new Date(checkIn);
      checkOut.setHours(17, rand(0, 30), 0, 0);
      insertTask.run(uid, 'Salida registrada', 'check_out', checkOut.toISOString(), f.location, f.sector);
    }
  }
  console.log(`  5 días × 2 funcionarios generados`);
}

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log('\n✓ Seed completo.');
console.log(`\nContraseña para todos los usuarios de prueba: ${PASS}`);
console.log('Para limpiar y volver a generar: CLEAN=1 npm run seed\n');

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n, format = 'iso') {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return format === 'date' ? d.toISOString().split('T')[0] : d.toISOString();
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
