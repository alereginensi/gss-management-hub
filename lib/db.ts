import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production'
  ? path.resolve('/app/data/tickets.db')
  : path.resolve(process.cwd(), 'tickets.db');

console.log(`Using database at: ${dbPath}`);

let db: Database.Database;

try {
  db = new Database(dbPath, { verbose: console.log });
  console.log('Database connection successful');
} catch (error) {
  console.error('CRITICAL: Failed to connect to database at', dbPath);
  console.error(error);
  // @ts-ignore
  db = null;
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
`);


  // Initialize Locations & Sectors from CSV data (Clientes y Lugares)
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
        'Bas': ['Melo (506)', 'Florida (509)', 'San Jose (531)', 'Fray Bentos (532)', 'Durazno (515)', 'Minas (520)', 'Colonia (523)', 'Mercedes (518)', 'Trinidad (517)', '8 de octubre (511)'],
        'Berdick': ['Planta', 'Portero', 'Planta Nueva', 'Oficina'],
        'Capacitación Limpieza': [],
        'Carolina Mangarelli': ['Lagomar'],
        'Carrica automotores': ['Puente de las Americas', 'Prado'],
        'Casa Valentin': [],
        'Casas Lagomar': ['Graciela Garcia', 'Carolina Mangarelli', 'Martha Garcia'],
        'Casmu': [
          'Sanatorio 2 Torre 1 Piso 6', 'Sanatorio 2 Torre 2 Piso 2', 'Sanatorio 2 Torre 2 Urgencia',
          'Sanatorio 2 Policlinico', 'Sanatorio 2 Torre 1 Piso 4', 'Sanatorio 2 Torre 1 Piso 3',
          'Sanatorio 2 Torre 1 Piso 5', 'Sanatorio 2 Torre 2', 'Sanatorio 2 Torre 1 Piso 2',
          'Sanatorio 2 Ropería', 'Sanatorio 2 Asilo', 'Sanatorio 2 Torre 1 Piso 1',
          'Sanatorio 2', 'Sanatorio 2 Torre 2 Urgencia Ginecológica', 'Sanatorio 2 Torre 1',
          'Sanatorio 2 Torre 2 Cuartos Medicos', 'Sanatorio 2 Torre 1 Punta', 'Sanatorio 2 Centro Mamario',
          'Sanatorio 2 Torre 2 Abreu', 'Sanatorio 2 Torre 2 PB y Sub', 'Sanatorio 2 Local 8',
          'Sanatorio 2 Asilo Almacenes', 'Sanatorio 2 Policlinico Tomógrafo', 'Sanatorio 2 Torre 2 Urgencia Pediátrica',
          'Sanatorio 2 Torre 2 Piso 5', 'Sanatorio 2 Local 8 Lavado de Móviles', 'Sanatorio 2 Torre 2 Piso 1',
          'Sanatorio 2 Torre 2 SOE', 'Sanatorio 2 Asilo Pañol', 'Sanatorio 2 Asilo Contact Center',
          'Sanatorio 2 Torre 2 Cocina', 'Sanatorio 2 Asilo Medicamentos', 'Sanatorio 2 Piscina',
          'Sanatorio 2 Torre 2 Piso 3', 'Sanatorio 2 Policlínico Tomógrafo', 'Sanatorio 2 Taller Veracierto',
          'Sanatorio 2 Cabina Abreu', 'Upeca Portones', 'Sanatorio 1 Odontología', 'Sanatorio 4',
          'Sanatorio 1', 'Upeca Maldonado', 'Upeca Punta Carretas', '1727 Bv Artigas 1910',
          'Upeca Paso de la Arena', 'Sanatorio 4 Oncologia', '1727 Agraciada', 'Upeca Colon',
          '1727 Malvin Norte', 'Sanatorio 4 Centro Medico', 'Upeca Solymar', 'Taller Central Veracierto',
          '1727 Solymar', 'Upeca Cerro', 'Upeca Guana', 'Upeca Cordon', 'Sanatorio 1 Salud Mental',
          'Upeca Paso Carrasco', 'Upeca Agraciada', 'Upeca Piriapolis', 'Upeca Piedras Blancas',
          'Upeca Parque Posadas', 'Upeca UAM', 'Upeca Parque Batlle', 'Centro Oftalmologico',
          '1727 Colon', 'Upeca Tres cruces', 'Sanatorio 1 Vacunacion', '1727 Piedras Blancas',
          'Upeca Sur y Palermo', 'Sanatorio 1 Farmacia', 'Upeca Malvin Norte',
          'Sanatorio 1 - Adicional Upeca Cordon', '1727 Paso de la arena', 'Sanatorio 4 Hemodialisis',
          'Referente Vigilante Auxiliar', 'Monitoreo', 'Deposito Cerro Adicional', 'Sanatorio 1 Cabina',
          'Sanatorio Torre 1', 'Guana Centro Oftalmologico', 'Solymar (movil 15)', '1727 Bv. Artigas',
          'Sanatorio 2 Salud Mental', 'Sanatorio 2 Cabina Asilo', 'Sanatorio 2 Policlínico',
          'Punta Carretas', 'Sanatorio 2 CTI', 'Centro Mamario', 'Upeca Barrio Sur y Palermo',
          'Malvin Alto (movil 1)', 'Encuesta', 'Capacitacion Administrativo', 'Colon (movil 9)',
          'Piedras Blancas (movil 7)', 'Paso de la Arena (movil 8)', 'Tres Cruces (movil 2)',
          'Tres Cruces (movil 5)', 'Tres Cruces (movil 3)', 'Prado (movil 30)',
          'Centro Oftalmologico Guana', 'Prado (movil 4)', 'Solymar (movil 40)'
        ],
        'Celia': ['Limpieza'],
        'CES Seguridad': ['Grito de Gloria'],
        'Ciudad Pinturas': ['Giannatassio'],
        'Claro': [
          'CAC Paso Molino', 'Mini CAC Las Piedras', 'Mini CAC Minas', 'CAC Costa Urbana',
          'Isla Shopping Geant', 'Mini CAC Mercedes', 'Mini CAC Rivera', 'Mini CAC Florida',
          'CAC 18 De Julio', 'Mini CAC Tacuarembo', 'Mini CAC Artigas', 'CAC Paysandú',
          'CAC Salto', 'CAC Unión', 'Isla Nuevo Centro', 'Isla Tres Cruces', 'CAC Maldonado',
          'San Martin Edificio Corporativo', 'Mini CAC Pando', 'Isla Punta Carretas',
          'Isla Portones Shopping', 'Atlántida', 'Isla Montevideo Shopping'
        ],
        'Clinica Lura': [],
        'Cooke Uruguay': [],
        'Decosol': ['Via Disegno', 'Bagno & Company Av. Italia'],
        'Edificio Amezaga': [],
        'Edificio Charrua': ['Barbacoa'],
        'Edificio Paullier': [],
        'Edificio San Martin': [],
        'Edificio Thays': [],
        'Glic Global': ['Tienda Online'],
        'Hif Global': [],
        'Hora de Lactancia': [],
        'Hospital BSE': [],
        'Hotel Ibis': [],
        'Indian': ['Atlantico', 'Punta Market Punta del Este', 'Fragata', 'Punta Shopping', 'Gorlero', 'Ariel', 'Portones', 'Maldonado', 'Montevideo Shopping'],
        'INDIAN Chic Parisien': ['Salto', 'Tacuarembo'],
        'Indian Fragata': [],
        'Indian Gorlero': [],
        'Indian Punta Market': [],
        'L&G': [],
        'La Molienda': ['Sarandi', 'Ejido', 'Rondeau Cocina', '18 de Julio', 'Rondeau Oficina', 'Uruguay'],
        'La Molienda Colonia': [],
        'Lactosan': [],
        'Logitech': [],
        'Mayorista el As': [],
        'Microlab': [],
        'Mundo Mac': ['Punta Shopping'],
        'Nedabal': [],
        'Nutriem Latam': [],
        'Obra GSS': [],
        'Porto vanila': ['Planta elaboradora'],
        'Proyecto Medishop': [],
        'Rawer Ltda': [],
        'Riven SRL': ['Clínica Dental Br. Artigas'],
        'Schmidt Premoldeados': ['Obra'],
        'Silber Studio': [],
        'Tata': ['Young (152)', 'Trinidad (145)', 'Trinidad (335)', 'San Jose (121)', 'Florida (315)', 'Mercedes (317)'],
        'Teyma': ['Fac. Enfermería'],
        'Tort Itda': ['2do Local'],
        'UDE': ['Punta Del Este'],
        'Veiga Ventos': ['Via Disegno'],
        'Viavip': ['Smart Parking'],
        'Wine Select': ['Vinos del Mundo'],
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
    const adminPass = '$2b$10$ms9LTCqoDe5zRtwxnMZZ1.ZlQKcOdjBeZD.scyLnG0vkOpnt/ouAq';
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
    CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(date);
    
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
  } catch (e) {
    console.error('Error creating database indexes:', e);
  }
}

export default db;
