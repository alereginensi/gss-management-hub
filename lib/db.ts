import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production'
  ? path.resolve('/app/data/tickets.db')
  : path.resolve(process.cwd(), 'tickets.db');

console.log(`Using database at: ${dbPath}`);
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
    rubro TEXT, -- Nullable, for funcionarios
    approved INTEGER DEFAULT 0, -- 0 for pending, 1 for approved
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    department TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    requester TEXT NOT NULL,
    requesterEmail TEXT,
    affected_worker TEXT,
    date TEXT NOT NULL,
    supervisor TEXT,
    startedAt TEXT,
    resolvedAt TEXT,
    statusColor TEXT
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

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT, -- Nullable for check-in/out
    type TEXT DEFAULT 'task', -- task, check_in, check_out
    location TEXT, -- New column for check-in location
    sector TEXT, -- New column for check-in sector
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS supervisor_worker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supervisor_id INTEGER NOT NULL,
    worker_id INTEGER NOT NULL,
    FOREIGN KEY (supervisor_id) REFERENCES users(id),
    FOREIGN KEY (worker_id) REFERENCES users(id),
    UNIQUE(supervisor_id, worker_id)
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS job_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    tasks TEXT, -- JSON string of tasks
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS ticket_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    added_by INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (added_by) REFERENCES users(id),
    UNIQUE(ticket_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticket_id TEXT,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    UNIQUE(name, location_id)
  );
`);

// Initialize Locations
try {
  const count = db.prepare('SELECT count(*) as count FROM locations').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO locations (name) VALUES (?)');
    const initialLocations = [
      'Edificio Central',
      'Planta Industrial',
      'Depósito Norte',
      'Depósito Sur',
      'Oficinas Administrativas',
      'Comedor',
      'Estacionamiento',
      'Puesto de Guardia 1',
      'Puesto de Guardia 2'
    ];
    initialLocations.forEach(loc => insert.run(loc));
    console.log('Initialized locations table');
  }
} catch (e) {
  console.error('Error initializing locations:', e);
}

// Initialize Job Roles
try {
  const count = db.prepare('SELECT count(*) as count FROM job_roles').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO job_roles (name, tasks) VALUES (?, ?)');
    const initialRoles = {
      'Limpieza': [
        'Limpieza de Pisos', 'Limpieza de Baños', 'Recolección de Residuos',
        'Limpieza de Vidrios', 'Desinfección de Superficies', 'Limpieza de Comedor', 'Reposo de Insumos'
      ],
      'Mantenimiento': [
        'Reparación Eléctrica', 'Reparación Sanitaria', 'Pintura', 'Carpintería',
        'Jardinería', 'Revisión de Luminarias', 'Mantenimiento Preventivo AA'
      ],
      'Seguridad': [
        'Ronda Perimetral', 'Control de Acceso', 'Revisión de Cámaras',
        'Reporte de Incidentes', 'Apertura de Portones', 'Cierre de Instalaciones'
      ],
      'Logística': [
        'Recepción de Mercadería', 'Control de Stock', 'Preparación de Pedidos',
        'Carga de Camiones', 'Inventario'
      ]
    };
    Object.entries(initialRoles).forEach(([role, tasks]) => {
      insert.run(role, JSON.stringify(tasks));
    });
    console.log('Initialized job_roles table');
  }
} catch (e) {
  console.error('Error initializing job_roles:', e);
}

// Migration: Ensure 'approved' column exists in users table
try {
  db.exec("ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists or table doesn't exist yet
}

try {
  db.exec("ALTER TABLE users ADD COLUMN rubro TEXT");
} catch (e) {
  // Column already exists
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
  db.exec("ALTER TABLE tasks ADD COLUMN location TEXT");
} catch (e) { }

try {
  db.exec("ALTER TABLE tasks ADD COLUMN sector TEXT");
} catch (e) { }

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

// Optimization: Database Indexes
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_location ON tasks(location);
    CREATE INDEX IF NOT EXISTS idx_tasks_sector ON tasks(sector);
    
    CREATE INDEX IF NOT EXISTS idx_logbook_date ON logbook(date);
    CREATE INDEX IF NOT EXISTS idx_logbook_location ON logbook(location);
    CREATE INDEX IF NOT EXISTS idx_logbook_sector ON logbook(sector);
    CREATE INDEX IF NOT EXISTS idx_logbook_created_at ON logbook(createdAt);
    
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(date);
  `);
  console.log('Database indexes verified/created');

  // Migrations for existing tables
  try { db.exec("ALTER TABLE tickets ADD COLUMN supervisor TEXT;"); } catch (e) { }
  try { db.exec("ALTER TABLE tickets ADD COLUMN statusColor TEXT;"); } catch (e) { }
} catch (e) {
  console.error('Error creating database indexes:', e);
}

export default db;
