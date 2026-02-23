import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const PRODUCTION_DB_PATH = '/app/tickets.db';
const IS_PROD = process.env.NODE_ENV === 'production';
let dbPath = IS_PROD ? '/app/data/tickets.db' : path.join(process.cwd(), 'tickets.db');

if (IS_PROD) {
  console.log(`🔍 CURRENT USER: ${require('os').userInfo().username} (UID: ${process.getuid?.()})`);

  try {
    // 1. Recursive Search: If the expected DB doesn't exist, search for ANY existing .db file
    // This helps if the volume was mounted at a different subpath
    if (!fs.existsSync(dbPath)) {
      console.log(`📡 DB not found at ${dbPath}, searching recursively in /app...`);
      const searchForDb = (dir: string): string | null => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fullPath.includes('node_modules')) continue;
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            const found = searchForDb(fullPath);
            if (found) return found;
          } else if (file.endsWith('.db') && stats.size > 0) {
            return fullPath;
          }
        }
        return null;
      };
      const discoveredDb = searchForDb('/app');
      if (discoveredDb) {
        console.log(`✨ DISCOVERED existing database at: ${discoveredDb}`);
        dbPath = discoveredDb;
      }
    }

    // 2. Standardize Directory
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      console.log(`📁 Creating missing directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 3. Robust Write Check
    const testFile = path.join(dbDir, `.write_test_${Date.now()}`);
    try {
      fs.writeFileSync(testFile, 'write test');
      fs.unlinkSync(testFile);
      console.log(`✅ Write check passed for directory: ${dbDir}`);
    } catch (writeErr: any) {
      console.error(`❌ CRITICAL: No write permissions at ${dbDir}. Error: ${writeErr.message}`);
    }

    // 4. Inode Tracking
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`📄 Database Inode: ${stats.ino} | Size: ${stats.size} bytes`);
    }
  } catch (err: any) {
    console.error(`⚠️ Warning during path discovery: ${err.message}`);
  }
}

console.log(`🚀 Final Database Path: ${dbPath}`);

let db: any;

try {
  db = new Database(dbPath, { verbose: console.log });
  console.log('✅ Database connection successful');
} catch (error: any) {
  console.error('❌ FATAL: Failed to connect to database at', dbPath);
  console.error('Error details:', error.message);

  if (IS_PROD) {
    throw new Error(`Persistence failure: Could not open database at ${dbPath}. ${error.message}`);
  } else {
    console.warn('Falling back to IN-MEMORY database (Development mode only).');
    db = new Database(':memory:');
  }
}

// Initialize tables
if (db) {
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
    statusColor TEXT,
    createdAt DATETIME
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

  CREATE TABLE IF NOT EXISTS counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  `);


  // Initialize Locations & Sectors from CSV data (Clientes y Lugares)
  // MOVED TO /api/admin/seed to prevent startup timeouts
  /*
  // Initialize Locations & Sectors from CSV data (Clientes y Lugares)
  try {
    // Check if we need to seed
    const countLocs = db.prepare('SELECT count(*) as count FROM locations').get() as { count: number };

    // Use transaction for safety and speed
    const seedTransaction = db.transaction(() => {
      const insertLoc = db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)');
      const insertSec = db.prepare('INSERT OR IGNORE INTO sectors (name, location_id) VALUES (?, ?)');
      const getLocId = db.prepare('SELECT id FROM locations WHERE name = ?');

      const clientData: Record<string, string[]> = {
        'AMEC': [],
        'Arcanus': ['Durazno'],
        'Automotora Carrica': ['Bulevar Artigas', 'Av. Millan'],
        'Banco de Seguro': ['Casa Central', 'Bulevar Artigas', 'Casa Central - Garaje'],
        // ... (data omitted to save space)
      };

      for (const [cliente, lugares] of Object.entries(clientData)) {
        insertLoc.run(cliente);
        const loc = getLocId.get(cliente) as { id: number } | undefined;
        if (loc) {
          for (const lugar of lugares) {
            insertSec.run(lugar, loc.id);
          }
        }
      }
    });

    seedTransaction();
    console.log('Locations & sectors seeded successfully.');
  } catch (e) {
    console.error('NON-FATAL ERROR initializing locations:', e);
  }
  */

  if (db) {
    console.log('DEBUG: Starting DB migrations...');
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
  } catch (e) {
    console.error("DB Admin Init Error:", e);
  }
} // End if (db) block from line 23

// Separate block for Admin User to ensure it runs
if (db) {
  try {
    const adminPass = '$2b$10$A8RCT0E4YCsaaPttIs6l8.ALRz57EBSWPGhrE7OSn.csFLL6a2lx.';
    const checkAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@gss.com');

    if (!checkAdmin) {
      console.log('Creating default admin user...');
      db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)')
        .run('Admin System', 'admin@gss.com', adminPass, 'Administración', 'admin', 1);
      console.log('Default admin created.');
    } else {
      console.log('Updating default admin user...');
      // Always update the password and approval status for the default admin to ensure it works
      db.prepare("UPDATE users SET password = ?, role = 'admin', approved = 1 WHERE email = ?")
        .run(adminPass, 'admin@gss.com');
      console.log('Default admin updated.');
    }
  } catch (e) {
    console.error("CRITICAL: Failed to create/update admin user:", e);
  }
}

if (db) {


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
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(createdAt);
    
    CREATE TABLE IF NOT EXISTS ticket_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'comment', -- comment, status_change
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );
    CREATE INDEX IF NOT EXISTS idx_activities_ticket_id ON ticket_activities(ticket_id);
  `);
    console.log('Database indexes and tables verified/created');

    // Migrations for existing tables
    try { db.exec("ALTER TABLE tickets ADD COLUMN supervisor TEXT;"); } catch (e) { }
    try { db.exec("ALTER TABLE tickets ADD COLUMN statusColor TEXT;"); } catch (e) { }
    try { db.exec("ALTER TABLE tickets ADD COLUMN createdAt DATETIME;"); } catch (e) { }

    // Cleanup corrupt IDs
    try {
      const result = db.prepare("DELETE FROM tickets WHERE id IN ('NaN', 'Infinity', '-Infinity')").run();
      if (result.changes > 0) {
        console.log(`🧹 Cleaned up ${result.changes} corrupt tickets.`);
      }
    } catch (e) {
      console.error("Error cleaning tickets:", e);
    }

    // Migration: Fill missing createdAt from the Spanish 'date' field
    try {
      const ticketsWithNoCreatedAt = db.prepare("SELECT id, date FROM tickets WHERE createdAt IS NULL").all() as { id: string, date: string }[];
      if (ticketsWithNoCreatedAt.length > 0) {
        console.log(`🔄 Migrating ${ticketsWithNoCreatedAt.length} tickets with missing createdAt...`);
        const updateStmt = db.prepare("UPDATE tickets SET createdAt = ? WHERE id = ?");

        const migrateTransaction = db.transaction((tickets: any) => {
          for (const t of tickets) {
            try {
              // date format: "DD/MM/YYYY HH:mm"
              const parts = t.date.split(' ');
              const dateParts = parts[0].split('/');
              const timeParts = parts[1].split(':');

              const isoDate = new Date(
                parseInt(dateParts[2]), // YYYY
                parseInt(dateParts[1]) - 1, // MM (0-indexed)
                parseInt(dateParts[0]), // DD
                parseInt(timeParts[0]), // HH
                parseInt(timeParts[1]) // mm
              ).toISOString();

              updateStmt.run(isoDate, t.id);
            } catch (e) {
              // Fallback to current time if parse fails
              updateStmt.run(new Date().toISOString(), t.id);
            }
          }
        });

        migrateTransaction(ticketsWithNoCreatedAt);
        console.log("✅ Successfully migrated ticket timestamps.");
      }
    } catch (e) {
      console.error("Error migrating ticket timestamps:", e);
    }
    // Initialize counters
    try {
      const initCounter = db.prepare('INSERT OR IGNORE INTO counters (key, value) VALUES (?, ?)');

      // Get current max ticket ID to initialize the counter
      const maxTicketId = db.prepare("SELECT MAX(CAST(id AS INTEGER)) as maxId FROM tickets").get() as { maxId: number | null };
      const currentMax = maxTicketId?.maxId || 99;

      initCounter.run('ticket_id', currentMax);
      console.log(`Counter 'ticket_id' initialized to ${currentMax}`);
    } catch (e) {
      console.error('Error initializing counters:', e);
    }
  } catch (e) {
    console.error('Error creating database indexes:', e);
  }
}

export default db;
