import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Nullable for regular users
    department TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    approved INTEGER DEFAULT 0, -- 0 for pending, 1 for approved
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, -- Made optional
    date TEXT NOT NULL,
    sector TEXT,
    supervisor TEXT,
    location TEXT,
    report TEXT,
    staff_member TEXT,
    uniform TEXT,
    supervised_by TEXT,
    extra_data TEXT, -- JSON string
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logbook_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL, -- text, number, date, select
    options TEXT -- JSON string for select types
  );
`);

// Migration: Ensure 'approved' column exists in users table
try {
  db.exec("ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists or table doesn't exist yet
}

try {
  db.exec("ALTER TABLE logbook ADD COLUMN supervised_by TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE logbook ADD COLUMN uniform TEXT");
} catch (e) {
  // Column already exists
}

// Ensure at least one admin exists for testing
try {
  const adminPass = '$2b$10$ms9LTCqoDe5zRtwxnMZZ1.ZlQKcOdjBeZD.scyLnG0vkOpnt/ouAq';
  const checkAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@gss.com');

  if (!checkAdmin) {
    // Password is 'admin123'
    db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Admin System', 'admin@gss.com', adminPass, 'Administración', 'admin', 1);
  } else {
    // Always update the password and approval status for the default admin to ensure it works
    db.prepare("UPDATE users SET password = ?, role = 'admin', approved = 1 WHERE email = ?")
      .run(adminPass, 'admin@gss.com');
  }
} catch (e) {
  console.error("DB Admin Init Error:", e);
}

// Initialize default settings if they don't exist
const initSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
initSettings.run('notification_emails', 'admin@gss-facility.com');
initSettings.run('power_automate_url', '');

// Default departments for initialization (should match TicketContext.tsx)
const departments = [
  'Mantenimiento',
  'Limpieza',
  'IT',
  'Seguridad',
  'RRHH',
  'Administración',
  'Logística'
];

departments.forEach(dept => {
  const deptKey = `notification_emails_${dept}`.replace(/\s+/g, '_');
  initSettings.run(deptKey, 'admin@gss-facility.com');
});

export default db;
