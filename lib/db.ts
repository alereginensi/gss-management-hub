// better-sqlite3 is loaded dynamically inside fallbackToSqlite() to avoid
// native module startup errors on Railway (Linux) when using PostgreSQL.
import path from 'path';
import fs from 'fs';

const IS_PROD = process.env.NODE_ENV === 'production';

class DbWrapper {
  private pgPool: any | null = null;
  private sqliteDb: any | null = null;
  public type: 'pg' | 'sqlite' = 'sqlite';
  private _initPromise: Promise<void> | null = null;

  constructor() {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (dbUrl) {
      console.log('🐘 PostgreSQL URL detected, connecting...');
      // Load 'pg' dynamically — serverExternalPackages in next.config handles bundling
      try {
        const { Pool } = require('pg');
        this.pgPool = new Pool({
          connectionString: dbUrl,
          ssl: IS_PROD ? { rejectUnauthorized: false } : false,
          max: 10,                    // max connections in pool
          idleTimeoutMillis: 30000,   // close idle connections after 30s
          connectionTimeoutMillis: 5000, // fail fast if can't connect in 5s
        });
        this.type = 'pg';
      } catch (err) {
        console.error('❌ Error loading "pg" module:', err);
        if (IS_PROD) throw err; // Don't silently fall back in production
        console.log('⚠️ Falling back to SQLite for development.');
        this.fallbackToSqlite();
      }
    } else {
      this.fallbackToSqlite();
    }
    this._initPromise = this.initialize().then(() => { this._initPromise = null; });
  }

  private fallbackToSqlite() {
    console.log('⚠️ Using SQLite database.');
    const dbPath = IS_PROD ? '/app/data/tickets.db' : path.join(process.cwd(), 'tickets.db');

    // Ensure directory exists for SQLite
    const dbDir = path.dirname(dbPath);
    if (IS_PROD && !fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
      // Load better-sqlite3 dynamically so Railway doesn't try to load
      // the native binary when DATABASE_URL is set (PostgreSQL mode).
      const Database = require('better-sqlite3');
      this.sqliteDb = new Database(dbPath);
      this.type = 'sqlite';
    } catch (err) {
      console.error('❌ Failed to load better-sqlite3:', err);
      throw new Error('SQLite is unavailable. Please set DATABASE_URL to use PostgreSQL.');
    }
  }

  async query(text: string, params: any[] = []): Promise<any[]> {
    if (this._initPromise) await this._initPromise;
    const safeParams = params.map(p => p === undefined ? null : p);

    // Convert ? to $1, $2, etc for PG if needed, or vice-versa
    const normalizedText = this.type === 'pg'
      ? text.replace(/\?/g, (_, i) => `$${safeParams.indexOf(safeParams[i]) + 1}`) // This is a simplified placeholder conversion
      : text;

    // Better placeholder conversion for PG
    let pgText = text;
    if (this.type === 'pg') {
      let count = 1;
      pgText = text.replace(/\?/g, () => `$${count++}`);
    }

    if (this.type === 'pg') {
      const res = await this.pgPool!.query(pgText, safeParams);
      return res.rows;
    } else {
      return this.sqliteDb.prepare(text).all(...safeParams);
    }
  }

  async get(text: string, params: any[] = []): Promise<any> {
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  async run(text: string, params: any[] = []): Promise<{ lastInsertRowid?: number | string, changes: number }> {
    if (this._initPromise) await this._initPromise;
    const safeParams = params.map(p => p === undefined ? null : p);
    let pgText = text;
    if (this.type === 'pg') {
      let count = 1;
      pgText = text.replace(/\?/g, () => `$${count++}`);
      // For PG, if it's an INSERT, we might want the ID. 
      // But for a generic 'run', we'll just execute.
      const res = await this.pgPool!.query(pgText, safeParams);
      return { changes: res.rowCount || 0 };
    } else {
      const info = this.sqliteDb.prepare(text).run(...safeParams);
      return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    }
  }

  async exec(text: string): Promise<void> {
    if (this.type === 'pg') {
      await this.pgPool!.query(text);
    } else {
      this.sqliteDb.exec(text);
    }
  }

  async initialize() {
    console.log('🏗️ Initializing database tables...');
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
        attachment_url TEXT,
        created_at TIMESTAMP,
        is_important INTEGER DEFAULT 0,
        is_team_ticket INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS team_ticket_tasks (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        task_description TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logbook (
        id SERIAL PRIMARY KEY,
        title TEXT,
        date TEXT NOT NULL,
        time TEXT,
        sector TEXT,
        supervisor TEXT,
        location TEXT,
        incident TEXT,
        report TEXT,
        staff_member TEXT,
        uniform TEXT,
        supervised_by TEXT,
        extra_data TEXT,
        images TEXT,
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
        ticket_subject TEXT,
        status_color TEXT,
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
      
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logbook_columns (
        name TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        options TEXT
      );

      CREATE TABLE IF NOT EXISTS funcionarios_list (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_folder (
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        PRIMARY KEY (ticket_id, folder_id)
      );

      CREATE TABLE IF NOT EXISTS security_records (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        report_datetime TEXT,
        client TEXT,
        branch TEXT,
        supervisor TEXT,
        technician TEXT,
        record_type TEXT,
        security_event TEXT,
        mobile_intervention TEXT,
        affected_system TEXT,
        record_detail TEXT,
        event_classification TEXT,
        public_force INTEGER DEFAULT 0,
        complaint_number TEXT,
        end_datetime TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT,
        adenda_id TEXT,
        rut_emisor TEXT,
        rut_comprador TEXT,
        buyer_name TEXT,
        issue_date TEXT,
        due_date TEXT,
        total_amount REAL,
        neto_basica REAL,
        neto_minima REAL,
        iva_basica REAL,
        iva_minima REAL,
        discounts REAL,
        exempt REAL,
        notes TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        received_items TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        quantity REAL,
        article TEXT,
        unit_price REAL,
        discount REAL DEFAULT 0,
        subtotal REAL
      );

      CREATE TABLE IF NOT EXISTS material_requests (
        id SERIAL PRIMARY KEY,
        client TEXT,
        article TEXT,
        quantity REAL,
        items TEXT,
        needed_date TEXT,
        requested_by TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logistics_shipments (
        id SERIAL PRIMARY KEY,
        tracking_number TEXT,
        recipient TEXT NOT NULL,
        destination TEXT NOT NULL,
        date_sent TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        weight REAL,
        declared_value REAL,
        description TEXT,
        notes TEXT,
        invoice_image_url TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logistics_shipment_comments (
        id SERIAL PRIMARY KEY,
        shipment_id INTEGER NOT NULL REFERENCES logistics_shipments(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    if (this.type === 'pg') {
      try {
        await this.pgPool!.query(schema);
        console.log('✅ PostgreSQL tables verified/created');

        // Ensure default admin exists
        const adminPass = '$2b$10$A8RCT0E4YCsaaPttIs6l8.ALRz57EBSWPGhrE7OSn.csFLL6a2lx.';
        const checkAdmin = await this.pgPool!.query('SELECT * FROM users WHERE email = $1', ['admin@gss.com']);
        if (checkAdmin.rows.length === 0) {
          await this.pgPool!.query(
            'INSERT INTO users (name, email, password, department, role, approved) VALUES ($1, $2, $3, $4, $5, $6)',
            ['Admin System', 'admin@gss.com', adminPass, 'Administración', 'admin', 1]
          );
          console.log('✅ Default admin created in Postgres');
        }

        // Ensure ticket counter exists
        const checkCounter = await this.pgPool!.query('SELECT * FROM counters WHERE key = $1', ['ticket_id']);
        if (checkCounter.rows.length === 0) {
          await this.pgPool!.query('INSERT INTO counters (key, value) VALUES ($1, $2)', ['ticket_id', 1000]);
          console.log('✅ Ticket ID counter initialized in Postgres at 1000');
        }
        // Run migrations for logbook table
        try {
          // Check tickets table for attachment_url
          const ticketCols = await this.pgPool!.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets'
          `);
          const existingTicketCols = ticketCols.rows.map((r: any) => r.column_name);
          if (!existingTicketCols.includes('attachment_url')) {
            console.log('🐘 Migrating tickets: adding attachment_url column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN attachment_url TEXT');
          }
          if (!existingTicketCols.includes('requester_email')) {
            console.log('🐘 Migrating tickets: adding requester_email column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN requester_email TEXT');
          }
          if (!existingTicketCols.includes('status_color')) {
            console.log('🐘 Migrating tickets: adding status_color column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN status_color TEXT');
          }
          if (!existingTicketCols.includes('created_at')) {
            console.log('🐘 Migrating tickets: adding created_at column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN created_at TIMESTAMP');
          }
          if (!existingTicketCols.includes('started_at')) {
            console.log('🐘 Migrating tickets: adding started_at column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN started_at TEXT');
          }
          if (!existingTicketCols.includes('resolved_at')) {
            console.log('🐘 Migrating tickets: adding resolved_at column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN resolved_at TEXT');
          }
          if (!existingTicketCols.includes('is_important')) {
            console.log('🐘 Migrating tickets: adding is_important column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN is_important INTEGER DEFAULT 0');
          }
          if (!existingTicketCols.includes('is_team_ticket')) {
            console.log('🐘 Migrating tickets: adding is_team_ticket column');
            await this.pgPool!.query('ALTER TABLE tickets ADD COLUMN is_team_ticket INTEGER DEFAULT 0');
          }
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS team_ticket_tasks (
              id SERIAL PRIMARY KEY,
              ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL,
              user_name TEXT NOT NULL,
              task_description TEXT NOT NULL,
              completed INTEGER DEFAULT 0,
              completed_at TEXT
            )
          `);

          const logbookCols = await this.pgPool!.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'logbook'
          `);
          const existingCols = logbookCols.rows.map((r: any) => r.column_name);

          if (!existingCols.includes('incident')) {
            console.log('🐘 Migrating logbook: adding incident column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN incident TEXT');
          }
          if (!existingCols.includes('report')) {
            console.log('🐘 Migrating logbook: adding report column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN report TEXT');
          }
          if (!existingCols.includes('supervised_by')) {
            console.log('🐘 Migrating logbook: adding supervised_by column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN supervised_by TEXT');
          }
          if (!existingCols.includes('supervisor')) {
            console.log('🐘 Migrating logbook: adding supervisor column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN supervisor TEXT');
          }
          if (!existingCols.includes('created_at')) {
            console.log('🐘 Migrating logbook: adding created_at column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
          }
          if (!existingCols.includes('time')) {
            console.log('🐘 Migrating logbook: adding time column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN time TEXT');
          }
          if (!existingCols.includes('images')) {
            console.log('🐘 Migrating logbook: adding images column');
            await this.pgPool!.query('ALTER TABLE logbook ADD COLUMN images TEXT');
          }

          // Migrate notifications ID to BIGINT for Postgres
          const notifCols = await this.pgPool!.query(`
            SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'id'
          `);
          if (notifCols.rows.length > 0 && notifCols.rows[0].data_type === 'integer') {
            console.log('🐘 Migrating notifications: changing id to BIGINT');
            await this.pgPool!.query('ALTER TABLE notifications ALTER COLUMN id TYPE BIGINT');
          }

          // Check notifications table for ticket_subject and status_color
          const nCols = await this.pgPool!.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'
          `);
          const existingNCols = nCols.rows.map((r: any) => r.column_name);
          if (!existingNCols.includes('ticket_subject')) {
            console.log('🐘 Migrating notifications: adding ticket_subject column');
            await this.pgPool!.query('ALTER TABLE notifications ADD COLUMN ticket_subject TEXT');
          }
          if (!existingNCols.includes('status_color')) {
            console.log('🐘 Migrating notifications: adding status_color column');
            await this.pgPool!.query('ALTER TABLE notifications ADD COLUMN status_color TEXT');
          }

          // Ensure logbook_columns exists (migration for existing DBs)
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS logbook_columns (
              name TEXT PRIMARY KEY,
              label TEXT NOT NULL,
              type TEXT NOT NULL,
              options TEXT
            )
          `);

          // Ensure folders tables exist (migration for existing DBs)
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS folders (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS ticket_folder (
              ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
              folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
              PRIMARY KEY (ticket_id, folder_id)
            )
          `);

          // Ensure funcionarios_list exists and seed initial data
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS funcionarios_list (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              active INTEGER DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          const funcCount = await this.pgPool!.query('SELECT COUNT(*) FROM funcionarios_list');
          if (parseInt(funcCount.rows[0].count) < 100) {
            console.log('🐘 Seeding/reseeding funcionarios_list...');
            await this.pgPool!.query('DELETE FROM funcionarios_list');
            await this.seedFuncionarios();
          }

          // Fix logbook entries missing supervisor: copy from sibling entries (same date + location + supervised_by)
          try {
            const fixed = await this.pgPool!.query(`
              UPDATE logbook l1
              SET supervisor = (
                SELECT l2.supervisor
                FROM logbook l2
                WHERE l2.date = l1.date
                  AND l2.location = l1.location
                  AND l2.supervised_by = l1.supervised_by
                  AND l2.supervisor IS NOT NULL
                  AND l2.supervisor <> ''
                LIMIT 1
              )
              WHERE (l1.supervisor IS NULL OR l1.supervisor = '')
                AND l1.location IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM logbook l2
                  WHERE l2.date = l1.date
                    AND l2.location = l1.location
                    AND l2.supervised_by = l1.supervised_by
                    AND l2.supervisor IS NOT NULL
                    AND l2.supervisor <> ''
                )
            `);
            if (fixed.rowCount && fixed.rowCount > 0) {
              console.log(`✅ Fixed ${fixed.rowCount} logbook entries with missing supervisor`);
            }
          } catch (fixErr) {
            console.error('❌ Error fixing logbook supervisors:', fixErr);
          }

          // Second pass: for entries still missing supervisor, assign if there is
          // exactly ONE distinct supervisor for that location + service type in history
          try {
            const fixed2 = await this.pgPool!.query(`
              UPDATE logbook l1
              SET supervisor = (
                SELECT l2.supervisor
                FROM logbook l2
                WHERE l2.location = l1.location
                  AND l2.supervised_by = l1.supervised_by
                  AND l2.supervisor IS NOT NULL
                  AND l2.supervisor <> ''
                GROUP BY l2.supervisor
                LIMIT 1
              )
              WHERE (l1.supervisor IS NULL OR l1.supervisor = '')
                AND l1.location IS NOT NULL
                AND l1.supervised_by IS NOT NULL
                AND (
                  SELECT COUNT(DISTINCT l2.supervisor)
                  FROM logbook l2
                  WHERE l2.location = l1.location
                    AND l2.supervised_by = l1.supervised_by
                    AND l2.supervisor IS NOT NULL
                    AND l2.supervisor <> ''
                ) = 1
            `);
            if (fixed2.rowCount && fixed2.rowCount > 0) {
              console.log(`✅ Fixed ${fixed2.rowCount} more logbook entries via location+service history`);
            }
          } catch (fixErr2) {
            console.error('❌ Error in second supervisor fix pass:', fixErr2);
          }
        } catch (migErr) {
          console.error('❌ Error migrating logbook table in Postgres:', migErr);
        }

        // Ensure ticket_views exists for Postgres
        try {
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS ticket_views (
              ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (ticket_id, user_id)
            )
          `);
        } catch (vErr) {
          console.error('❌ Error creating ticket_views table in Postgres:', vErr);
        }

        // Ensure material_requests has file_url and purchase_orders has received_items
        try {
          const mrCols = await this.pgPool!.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'material_requests'`);
          const mrColNames = mrCols.rows.map((r: any) => r.column_name);
          if (!mrColNames.includes('file_url')) {
            await this.pgPool!.query('ALTER TABLE material_requests ADD COLUMN file_url TEXT');
          }
        } catch (e) {}
        try {
          const poCols = await this.pgPool!.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_orders'`);
          const poColNames = poCols.rows.map((r: any) => r.column_name);
          if (!poColNames.includes('received_items')) {
            await this.pgPool!.query('ALTER TABLE purchase_orders ADD COLUMN received_items TEXT');
          }
        } catch (e) {}
        try {
          const userCols = await this.pgPool!.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
          const userColNames = userCols.rows.map((r: any) => r.column_name);
          if (!userColNames.includes('modules')) {
            await this.pgPool!.query('ALTER TABLE users ADD COLUMN modules TEXT');
          }
        } catch (e) {}
        try {
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
              id SERIAL PRIMARY KEY,
              order_number TEXT, adenda_id TEXT, rut_emisor TEXT, rut_comprador TEXT, buyer_name TEXT,
              issue_date TEXT, due_date TEXT, total_amount REAL, neto_basica REAL, neto_minima REAL,
              iva_basica REAL, iva_minima REAL, discounts REAL, exempt REAL, notes TEXT, file_url TEXT,
              status TEXT DEFAULT 'pending', received_items TEXT, created_by TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS purchase_order_items (
              id SERIAL PRIMARY KEY,
              order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
              quantity REAL, article TEXT, unit_price REAL, discount REAL DEFAULT 0, subtotal REAL
            )
          `);
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS material_requests (
              id SERIAL PRIMARY KEY, client TEXT, article TEXT, quantity REAL, items TEXT,
              needed_date TEXT, requested_by TEXT, file_url TEXT, status TEXT DEFAULT 'pending',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
        } catch (e) {}
        try {
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS logistics_shipments (
              id SERIAL PRIMARY KEY,
              tracking_number TEXT,
              recipient TEXT NOT NULL,
              destination TEXT NOT NULL,
              date_sent TEXT NOT NULL,
              status TEXT DEFAULT 'pending',
              weight REAL,
              declared_value REAL,
              description TEXT,
              notes TEXT,
              invoice_image_url TEXT,
              created_by TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS logistics_shipment_comments (
              id SERIAL PRIMARY KEY,
              shipment_id INTEGER NOT NULL REFERENCES logistics_shipments(id) ON DELETE CASCADE,
              user_name TEXT NOT NULL,
              comment TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
        } catch (e) {}

        // Ensure folders and ticket_folder tables exist (migration for existing DBs)
        try {
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS folders (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await this.pgPool!.query(`
            CREATE TABLE IF NOT EXISTS ticket_folder (
              ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
              folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
              PRIMARY KEY (ticket_id, folder_id)
            )
          `);
        } catch (folderErr) {
          console.error('❌ Error creating folders tables in Postgres:', folderErr);
        }

      } catch (err) {
        console.error('❌ Error initializing Postgres:', err);
      }
    } else {
      // For SQLite, we also need to handle missing columns if necessary
      try {
        const ticketInfo = this.sqliteDb.prepare("PRAGMA table_info(tickets)").all();
        const existingTicketCols = ticketInfo.map((c: any) => c.name);
        if (!existingTicketCols.includes('attachment_url')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN attachment_url TEXT');
        }
        if (!existingTicketCols.includes('requester_email')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN requester_email TEXT');
        }
        if (!existingTicketCols.includes('status_color')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN status_color TEXT');
        }
        if (!existingTicketCols.includes('created_at')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN created_at DATETIME');
        }
        if (!existingTicketCols.includes('started_at')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN started_at TEXT');
        }
        if (!existingTicketCols.includes('resolved_at')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN resolved_at TEXT');
        }
        if (!existingTicketCols.includes('is_important')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN is_important INTEGER DEFAULT 0');
        }
        if (!existingTicketCols.includes('is_team_ticket')) {
          this.sqliteDb.exec('ALTER TABLE tickets ADD COLUMN is_team_ticket INTEGER DEFAULT 0');
        }
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS team_ticket_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            task_description TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            completed_at TEXT
          )
        `);

        // Ensure folders tables exist for SQLite
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS ticket_folder (
            ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
            folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            PRIMARY KEY (ticket_id, folder_id)
          )
        `);

        const tableInfo = this.sqliteDb.prepare("PRAGMA table_info(logbook)").all();
        const existingCols = tableInfo.map((c: any) => c.name);

        if (!existingCols.includes('incident')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN incident TEXT');
        }
        if (!existingCols.includes('report')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN report TEXT');
        }
        if (!existingCols.includes('supervised_by')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN supervised_by TEXT');
        }
        if (!existingCols.includes('supervisor')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN supervisor TEXT');
        }
        if (!existingCols.includes('created_at')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        }
        if (!existingCols.includes('time')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN time TEXT');
        }
        if (!existingCols.includes('images')) {
          this.sqliteDb.exec('ALTER TABLE logbook ADD COLUMN images TEXT');
        }

        // Ensure ticket_views exists for SQLite
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS ticket_views (
            ticket_id TEXT NOT NULL REFERENCES tickets(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (ticket_id, user_id)
          )
        `);

        // Check notifications table for SQLite
        const notifInfo = this.sqliteDb.prepare("PRAGMA table_info(notifications)").all();
        const existingNotifCols = notifInfo.map((c: any) => c.name);
        if (!existingNotifCols.includes('ticket_subject')) {
          this.sqliteDb.exec('ALTER TABLE notifications ADD COLUMN ticket_subject TEXT');
        }
        if (!existingNotifCols.includes('status_color')) {
          this.sqliteDb.exec('ALTER TABLE notifications ADD COLUMN status_color TEXT');
        }

        // Fix logbook entries missing supervisor: copy from sibling entries (same date + location + supervised_by)
        try {
          const fixStmt = this.sqliteDb.prepare(`
            UPDATE logbook SET supervisor = (
              SELECT l2.supervisor FROM logbook l2
              WHERE l2.date = logbook.date
                AND l2.location = logbook.location
                AND l2.supervised_by = logbook.supervised_by
                AND l2.supervisor IS NOT NULL
                AND l2.supervisor <> ''
              LIMIT 1
            )
            WHERE (supervisor IS NULL OR supervisor = '')
              AND location IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM logbook l2
                WHERE l2.date = logbook.date
                  AND l2.location = logbook.location
                  AND l2.supervised_by = logbook.supervised_by
                  AND l2.supervisor IS NOT NULL
                  AND l2.supervisor <> ''
              )
          `);
          const result = fixStmt.run();
          if (result.changes > 0) {
            console.log(`✅ Fixed ${result.changes} logbook entries with missing supervisor`);
          }
        } catch (fixErr) {
          console.error('❌ Error fixing logbook supervisors:', fixErr);
        }

        // Second pass: assign if exactly ONE distinct supervisor for location + service type
        try {
          const fixStmt2 = this.sqliteDb.prepare(`
            UPDATE logbook SET supervisor = (
              SELECT l2.supervisor FROM logbook l2
              WHERE l2.location = logbook.location
                AND l2.supervised_by = logbook.supervised_by
                AND l2.supervisor IS NOT NULL
                AND l2.supervisor <> ''
              GROUP BY l2.supervisor
              LIMIT 1
            )
            WHERE (supervisor IS NULL OR supervisor = '')
              AND location IS NOT NULL
              AND supervised_by IS NOT NULL
              AND (
                SELECT COUNT(DISTINCT l2.supervisor) FROM logbook l2
                WHERE l2.location = logbook.location
                  AND l2.supervised_by = logbook.supervised_by
                  AND l2.supervisor IS NOT NULL
                  AND l2.supervisor <> ''
              ) = 1
          `);
          const result2 = fixStmt2.run();
          if (result2.changes > 0) {
            console.log(`✅ Fixed ${result2.changes} more logbook entries via location+service history`);
          }
        } catch (fixErr2) {
          console.error('❌ Error in second supervisor fix pass:', fixErr2);
        }
      } catch (e) {
        // Table might not exist yet if initialize just ran, but sanitize anyway
      }

      this.sqliteDb.exec(schema.replace(/SERIAL/g, 'INTEGER').replace(/TIMESTAMP/g, 'DATETIME').replace(/REFERENCES\s+\w+\(\w+\)\s+ON DELETE CASCADE/g, '').replace(/REFERENCES\s+\w+\(\w+\)/g, ''));
      console.log('✅ SQLite tables verified/created');

      // Fix notifications table: ensure id column is INTEGER PRIMARY KEY (auto-increment)
      // Old schema had BIGSERIAL which SQLite converted to BIGINTEGER, not auto-incrementing
      try {
        const notifTableInfo = this.sqliteDb.prepare("PRAGMA table_info(notifications)").all() as any[];
        const idCol = notifTableInfo.find((c: any) => c.name === 'id');
        if (idCol && idCol.type.toUpperCase() !== 'INTEGER') {
          console.log('🔧 Migrating notifications table: fixing id column to INTEGER PRIMARY KEY AUTOINCREMENT');
          this.sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS notifications_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              ticket_id TEXT,
              message TEXT NOT NULL,
              type TEXT DEFAULT 'info',
              read INTEGER DEFAULT 0,
              ticket_subject TEXT,
              status_color TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO notifications_new (user_id, ticket_id, message, type, read, ticket_subject, status_color, created_at)
              SELECT user_id, ticket_id, message, type, COALESCE(read, 0), ticket_subject, status_color, created_at FROM notifications;
            DROP TABLE notifications;
            ALTER TABLE notifications_new RENAME TO notifications;
          `);
          console.log('✅ Notifications table migrated successfully');
        }
      } catch (notifMigErr) {
        console.error('❌ Error migrating notifications table:', notifMigErr);
      }

      // material_requests: add file_url
      try {
        const mrInfo = this.sqliteDb.prepare("PRAGMA table_info(material_requests)").all() as any[];
        const mrCols = mrInfo.map((c: any) => c.name);
        if (!mrCols.includes('file_url')) {
          this.sqliteDb.exec('ALTER TABLE material_requests ADD COLUMN file_url TEXT');
        }
      } catch (e) {}
      // purchase_orders: add received_items
      try {
        const poInfo = this.sqliteDb.prepare("PRAGMA table_info(purchase_orders)").all() as any[];
        const poCols = poInfo.map((c: any) => c.name);
        if (!poCols.includes('received_items')) {
          this.sqliteDb.exec('ALTER TABLE purchase_orders ADD COLUMN received_items TEXT');
        }
      } catch (e) {}
      // users: add modules
      try {
        const userInfo = this.sqliteDb.prepare("PRAGMA table_info(users)").all() as any[];
        const userCols = userInfo.map((c: any) => c.name);
        if (!userCols.includes('modules')) {
          this.sqliteDb.exec('ALTER TABLE users ADD COLUMN modules TEXT');
        }
      } catch (e) {}
      // purchase_orders, items, material_requests tables
      try {
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT, adenda_id TEXT, rut_emisor TEXT, rut_comprador TEXT, buyer_name TEXT,
            issue_date TEXT, due_date TEXT, total_amount REAL, neto_basica REAL, neto_minima REAL,
            iva_basica REAL, iva_minima REAL, discounts REAL, exempt REAL, notes TEXT, file_url TEXT,
            status TEXT DEFAULT 'pending', received_items TEXT, created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            quantity REAL, article TEXT, unit_price REAL, discount REAL DEFAULT 0, subtotal REAL
          )
        `);
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS material_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client TEXT, article TEXT, quantity REAL, items TEXT,
            needed_date TEXT, requested_by TEXT, file_url TEXT, status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (e) {}
      // logistics_shipments and comments tables
      try {
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS logistics_shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tracking_number TEXT,
            recipient TEXT NOT NULL,
            destination TEXT NOT NULL,
            date_sent TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            weight REAL,
            declared_value REAL,
            description TEXT,
            notes TEXT,
            invoice_image_url TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        this.sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS logistics_shipment_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_id INTEGER NOT NULL REFERENCES logistics_shipments(id) ON DELETE CASCADE,
            user_name TEXT NOT NULL,
            comment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (e) {}

      // Seed funcionarios_list for SQLite
      const funcCountSqlite = this.sqliteDb.prepare('SELECT COUNT(*) as count FROM funcionarios_list').get();
      if (funcCountSqlite.count < 100) {
        console.log('📋 Seeding/reseeding funcionarios_list (SQLite)...');
        this.sqliteDb.prepare('DELETE FROM funcionarios_list').run();
        await this.seedFuncionarios();
      }
    }
  }

  // Simplified transaction support
  async transaction(fn: (dbClient: any) => Promise<void>): Promise<void> {
    if (this.type === 'pg') {
      const client = await this.pgPool!.connect();
      try {
        await client.query('BEGIN');
        // Small wrapper for the transaction client
        const txDb = {
          query: (t: string, p: any[] = []) => {
            let count = 1;
            const pgText = t.replace(/\?/g, () => `$${count++}`);
            const safeParams = p.map(v => v === undefined ? null : v);
            return client.query(pgText, safeParams);
          },
          run: (t: string, p: any[] = []) => {
            let count = 1;
            const pgText = t.replace(/\?/g, () => `$${count++}`);
            const safeParams = p.map(v => v === undefined ? null : v);
            return client.query(pgText, safeParams);
          },
          get: async (t: string, p: any[] = []) => {
            let count = 1;
            const pgText = t.replace(/\?/g, () => `$${count++}`);
            const safeParams = p.map(v => v === undefined ? null : v);
            const res = await client.query(pgText, safeParams);
            return res.rows[0];
          }
        };
        await fn(txDb);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      // For SQLite, it's harder to handle async 'fn' inside better-sqlite3 transaction
      // because it's synchronous. We'll just run it and hope for the best or use BEGIN/COMMIT manually.
      this.sqliteDb.exec('BEGIN');
      try {
        await fn(this);
        this.sqliteDb.exec('COMMIT');
      } catch (e) {
        this.sqliteDb.exec('ROLLBACK');
        throw e;
      }
    }
  }

  async seedFuncionarios() {
    const nombres = [
      'Abigail Salguero', 'Abril Demontel', 'Abril Gonzalez', 'Adelyn Serrano', 'Adrian Zelpo',
      'Adriana Barboza', 'Adriana Delgado', 'Adriana Ippoliti', 'Adriana Machado', 'Adriana Martinez',
      'Adriana Pinto', 'Adriana Romero', 'Agustin Collazo', 'Agustin Moreira', 'Agustina Diaz',
      'Agustina Rottela', 'Agustina Sandoval', 'Agustina Silva', 'Alba Galvan', 'Alejandra Ibanez',
      'Alejandra Martinez', 'Alejandra Spindola', 'Alejandra Tellez', 'Alejandrina Maria de La Cruz',
      'Alejandro Izaguirre', 'Alejandro Moreira', 'Alejandro Tellez', 'Alen Mederos', 'Alex Cardozo',
      'Alexander Echevarria', 'Alexander Machado', 'Alexanders Gonzalez', 'Alexandra Allende',
      'Alexandra Aquino', 'Alexandra Cabrera', 'Alexandra Ogando', 'Alexandra Recoba', 'Alexandra Rodriguez',
      'Alexis Arias', 'Alexis Escudero', 'Alfoncina Encarnacion', 'Alfonsina Fleitas', 'Alison Olivera',
      'Allison Maneiro', 'Allyson Toledo', 'Alvaro Marquez', 'Alvaro Velazquez', 'Alyson Machado',
      'Ana Alves', 'Ana Coronel', 'Ana Fagundez', 'Ana Garcia', 'Ana Malacre', 'Ana Marino',
      'Ana Martinez', 'Ana Mercadal', 'Ana Moreira', 'Ana Pereyra', 'Ana Perez', 'Ana Santos',
      'Ana Scapino', 'Ana Sentecil', 'Ana Suero', 'Ana Villagran', 'Ana Yack', 'Analia Felix',
      'Analia Filipini', 'Andrea De los Santos', 'Andrea Lavega', 'Andrea Lima', 'Andrea Silveira',
      'Andrea Zanotta', 'Andreita Adames', 'Angel Fauto', 'Angela Beracochea', 'Angela Curbelo',
      'Angela Curcio', 'Angela Escudero', 'Angela Recarey', 'Anthony Fonseca', 'Antonella Batista',
      'Antonella Duarte', 'Antonella Ibarra', 'Anty Gularte', 'Ariana Silvera', 'Ariel Rodriguez',
      'Arley Amador', 'Armando Dominguez', 'Armando Garcia', 'Arturo Centurion', 'Augusto Castagnola',
      'Barbara Guillen', 'Barbara Ramirez', 'Beatriz Romero', 'Bernarda Rodriguez', 'Berta Rosas',
      'Bettina Cabrera', 'Bettina Freitas', 'Brady Luis', 'Brahian Santa Cruz', 'Braian Diaz',
      'Brandon Aguiar', 'Brenda Fagundez', 'Brian Aguirre', 'Brian Duarte', 'Brian Olivo',
      'Brian Sansberro', 'Brian da Silva', 'Brisa Ocampo', 'Bruno Brambate', 'Bruno Gonzalez',
      'Bryan Alegre', 'Camila Acuna', 'Camila Cajica', 'Camila Carro', 'Camila Chavez',
      'Camila Gancio', 'Camila Marquez', 'Camila Rivero', 'Camilo Flores', 'Candela Calderon',
      'Candela Ferreira', 'Candela Rodriguez', 'Carla Castro', 'Carla Machado', 'Carla Martinez',
      'Carla Mendez', 'Carlos Aguirre', 'Carlos Berrueta', 'Carlos Berrutti', 'Carlos Diaz',
      'Carlos Echenique', 'Carlos Fernandez', 'Carlos Fugini', 'Carlos Lopez', 'Carlos Perez',
      'Carlos Rodriguez', 'Carlos Sosa', 'Carmecia Volquez', 'Carolina Aguiar', 'Carolina Rodriguez',
      'Caroline Sosa', 'Catherine Bezzoso', 'Catherine Callaba', 'Catherine Martinez', 'Catherine Montenegro',
      'Catherine Pintos', 'Catherine Ramos', 'Cecilia Ferreira', 'Cecilia Godoy', 'Cecilia Paez',
      'Cecilia Saura', 'Celina Almiron', 'Cesar Sanchez', 'Chiara Gonzalez', 'Christian Bello',
      'Christian Santurio', 'Cielo Bosch', 'Cindy Almada', 'Cinthya Farina', 'Cintia De la Santa Cruz',
      'Claudia Diaz', 'Claudia Fleitas', 'Claudia Furtado', 'Claudia Gallero', 'Claudia Olivera',
      'Claudia Rodriguez', 'Claudia Villasante', 'Clemente Lechuga', 'Clide Marchelli', 'Cris Ceballos',
      'Cristian Hernandez', 'Cristian Rodriguez', 'Cristian Silva', 'Cristian Traverso', 'Cristina Mallo',
      'Cristina Sanchez', 'Cristofer Peralta', 'Dagmara Cuello', 'Daiana Alvarez', 'Daiana Da Silva',
      'Daiana Guzman', 'Dailina Feliz', 'Daimarelys Garcia', 'Daineris Matos', 'Dalia Castaneda',
      'Damaris Guibert', 'Damian Comini', 'Daniel Bonilla', 'Daniel Castro', 'Daniela Alvez',
      'Daniela Disego', 'Daniela Genoud', 'Daniela Sauco', 'Daniela Sosa', 'Dario Borges',
      'Darling Fervenza', 'Darnays Salgado', 'Daurin Sena', 'David Hernandez', 'Dayana Castillo',
      'Dayana Piedrabuena', 'Dayana Rojas', 'Dayana Vera', 'Debora Martinez', 'Deborah Alvarez',
      'Deborath Rodriguez', 'Deisy Da Rosa', 'Delfina Acosta', 'Delfino Silva', 'Delta Fragoso',
      'Deury Franco', 'Diana Lopez', 'Diana Medina', 'Diana Novas', 'Diany Pena', 'Diego Perez',
      'Diego Rodriguez', 'Diego Sena', 'Diego Tilve', 'Dominique Rodriguez', 'Douglas Pereira',
      'Dunia Martinez', 'Ecaterina Umpierrez', 'Edgar Rivero', 'Edgardo Echevarria', 'Edgardo Rivero',
      'Edison Da Silva', 'Eduardo Zapata', 'Eliana Rivas', 'Eliana Trucido', 'Eliana Vitancurt',
      'Elias Cutti', 'Elida Lencina', 'Elida Tajes', 'Elisa Echague', 'Eliza Curbelo',
      'Elizabeth Perez', 'Elizabeth Severo', 'Eluana Scarpa', 'Elvira Raman', 'Emanuel Cardozo',
      'Emanuel Correa', 'Emanuel Fernandez', 'Emerson Dotta', 'Emilia Dotel', 'Emiliano Gonzalez',
      'Emilio Merladett', 'Emilsen Romero', 'Emily Enrique', 'Emily Gutierrez', 'Emily Villalpando',
      'Emily de los Santos', 'Emperatriz Advincola', 'Enrique Figueira', 'Enso Techeira', 'Erik Rodriguez',
      'Erika Izquierdo', 'Erika Nunez', 'Erika Pereyra', 'Ernesto Santiesteban', 'Esmeralda Marquez',
      'Esteban Fernandez', 'Estefani Brocal', 'Estefani Severo', 'Estefania Ramos', 'Estefany Bustamante',
      'Estela Abad', 'Estela Alvarez', 'Estela Riffel', 'Ethel Gonzalez', 'Evangelina Quinteros',
      'Evans Cortinas', 'Evelin Figueras', 'Evelyn Apud', 'Evelyn Caligaris', 'Evelyn Panizza',
      'Evelyn Silveira', 'Evy Gonzalez', 'Fabiana Caetano', 'Fabiana Focarile', 'Fabiana Gomez',
      'Fabiana Presa', 'Fabiana Zerpa', 'Fabio Da Silva', 'Fabiola Pereyra', 'Fabriccio Albertini',
      'Facundo Cabalero', 'Facundo Cardozo', 'Facundo Davila', 'Facundo Gomez', 'Facundo Gonzalez',
      'Facundo Silvera', 'Facundo Tabeira', 'Fanny Eusebio', 'Fatima Navarro', 'Fatima Paraduja',
      'Fatima Ramirez', 'Fatima Rodao', 'Fatima Silva', 'Faustino De la Cruz', 'Felix Gascon',
      'Fernanda Benitez', 'Fernanda Lopez', 'Fernando Pereda', 'Fernando Yaucire', 'Fiorella Ruiz Diaz',
      'Flavia Castilla', 'Florencia Aguiar', 'Florencia Carmona', 'Florencia Colman', 'Florencia Gazzan',
      'Florencia Hernandez', 'Florencia Outeda', 'Florencia Rodriguez', 'Florencia Suarez', 'Florencia Tabarez',
      'Florencia de los Santos', 'Franco Bauza', 'Franco Biagetti', 'Franco Caldas', 'Franco Pena',
      'Freddy Leguizamon', 'Freddy Pereira', 'Gabriel Da Luz', 'Gabriela Benitez', 'Gabriela Bustamante',
      'Gabriela Fonseca', 'Gabriela Garcia', 'Gabriela Sastre', 'Gabriela Soria', 'Gabriela Villanueva',
      'Gaston Costa', 'Geidy Marten', 'German Duran', 'German Luengo', 'German Pedroso',
      'German Sanchez', 'Gilberto Carballea', 'Gimena Fernandez', 'Giosi Almeida', 'Giovana Fernandez',
      'Giovana Vilche', 'Giuliana Salari', 'Gladys Rodriguez', 'Gladys Senorano', 'Gonzalo Guastavino',
      'Gonzalo Rodriguez', 'Graciela Garcia', 'Graciela Sanguinetti', 'Guadalupe Abella', 'Guillermo Cardoso',
      'Gustavo Angelino', 'Gustavo Correa', 'Gustavo Perazza', 'Gustavo Reyes', 'Gustavo Saravia',
      'Gutterman Rigoli', 'Hector Rivero', 'Hector Rodriguez', 'Helen Almeida', 'Hugo Betancor',
      'Hugo Daguerre', 'Hugo Diaz', 'Hugo Ramos', 'Humberto Lanz', 'Idalberto Perez',
      'Idelsy Garcia', 'Ignacio Leites', 'Ignacio Lemos', 'Indira Dos Santos', 'Ines Moreno',
      'Ingrid Diaz', 'Ingrid Falero', 'Irina Vega', 'Irma Barufaldi', 'Irma Ramirez',
      'Irma Sequeira', 'Isabel Rivero', 'Ismael Barreto', 'Ivan Fernandez', 'Ivan Navas',
      'Ivan Santana', 'Ivan Tejeira', 'Ivana Barrossi', 'Ivana Bentos', 'Jackeline Lara',
      'Jacqueline Silva', 'Jasmina Calderon', 'Jave Rodriguez', 'Javier Baez', 'Javier Castagnino',
      'Javier Hernandez', 'Javier Perez', 'Jeidy Ruiz', 'Jenifer Taboada', 'Jenina Fagundez',
      'Jennifer Amaro', 'Jennifer Benitez', 'Jennifer Correa', 'Jennifer Ferreira', 'Jennifer Fraga',
      'Jennifer Madruga', 'Jennifer Olivera', 'Jennifer Sequeira', 'Jessica Barreto', 'Jessica Correa',
      'Jessica Fonseca', 'Jessica Garcia', 'Jessica Gonzalez', 'Jessica Hernandez', 'Jessica Rodriguez',
      'Jessica Salazar', 'Jessica Soca', 'Jesus Escudero', 'Jissel Candelario', 'Joe Jerez',
      'John Celle', 'Johnan Cabrera', 'Jonathan Berto', 'Jonathan Flores', 'Jonathan Machado',
      'Jonathan Marcoff', 'Jonathan Mendez', 'Jonathan Pezzoli', 'Jorge Felimon', 'Jorge Fonte',
      'Jorge Marmol', 'Jorge Morales', 'Jorge Sosa', 'Jose Fernandez', 'Jose Gutierrez',
      'Jose Hernandez', 'Jose Jara', 'Jose Laguarda', 'Jose Molina', 'Jose Olivera',
      'Jose Sampayo', 'Jose Silva', 'Jose Suarez', 'Joselin Fraga', 'Joseline Araujo',
      'Juan Alonso', 'Juan Bitancourtt', 'Juan Castro', 'Juan Coelho', 'Juan Larrosa',
      'Juan Mesquita', 'Juan Rodriguez', 'Juan Velazquez', 'Juana Garibaldi', 'Julia Maneiro',
      'Julia Serrat', 'Julian Fiorelli', 'Juliana Lagos', 'Juliana Tarigo', 'Julio Fleitas',
      'Julio Guardalopez', 'Karen Clavijo', 'Karen Guarino', 'Karen Silva', 'Karina Boschetti',
      'Karina Milan', 'Karina Montero', 'Karina Ramos', 'Karina Torres', 'Kateherin de la Cruz',
      'Katehryn Barboza', 'Katerin Beledo', 'Katerin Ferreira', 'Katerine Morales', 'Katherine Barreto',
      'Katherine Cabrera', 'Katherine Ferreira', 'Katia Villasante', 'Katy Fernandez', 'Kelvin Modesto',
      'Kevin Coitinho', 'Kevin Espana', 'Kevin Gonzalez', 'Kevin Martinez', 'Kiara Ferreira',
      'Laura Cena', 'Laura De Leon', 'Laura Ferreira', 'Laura Gimenez', 'Laura Machado',
      'Laura Romero', 'Laura Sequeira', 'Laura Sosa', 'Lautaro Ferreyra', 'Leandro Piriz',
      'Leandro Rodriguez', 'Leniel Perez', 'Leo Piedrabuena', 'Leodany Munoz', 'Leonardo Nalerio',
      'Leonardo Oliva', 'Leticia Ferreira', 'Leticia Olivera', 'Leyrys Alvarez', 'Lidia Ferraro',
      'Lilyan Perez', 'Linda Vilar', 'Lismairi Arias', 'Liz San Martin', 'Lohana Rodriguez',
      'Lorena Arezo', 'Lorena Bogado', 'Lorena Bustamante', 'Lorena Fernandez', 'Lorena Fierro',
      'Lorena Hospital', 'Lorena Irute', 'Lorena Ojeda', 'Lorena Romero', 'Lorena Silva',
      'Lourdes Barreiro', 'Lourdes Conil', 'Lourdes Peluffo', 'Lourdes Romero', 'Luana Martinez',
      'Lucas Almada', 'Lucas Campopiano', 'Lucas Moreira', 'Lucas San Juan', 'Lucero Advincola',
      'Lucia Abreu', 'Lucia Fagundez', 'Lucia Fernandez', 'Lucia Marquez', 'Lucia Medina',
      'Lucia Rivas', 'Lucia Rodriguez', 'Lucia Sosaya', 'Lucia Suarez', 'Lucia Villareal',
      'Luciana Bonifacio', 'Luciana Tabarez', 'Luciano Oliva', 'Luciano Saravia', 'Lucila Ferreira',
      'Lucy De los Santos', 'Luis Alboa', 'Luis Delgado', 'Luis Flores', 'Luis Machado',
      'Luis Perez', 'Luis Ramirez', 'Luis Rodriguez', 'Luis Sagas', 'Luis Soria',
      'Luis Vasquez', 'Luis Yucra', 'Luz Matos', 'Mabel Ledesma', 'Mabel Rodriguez',
      'Macarena Borges', 'Macarena Fernandez', 'Macarena Montero', 'Macarena Tricanico', 'Macarena Vinoles',
      'Maday Fernandez', 'Magela Dure', 'Maia Cabrera', 'Maicol Correa', 'Maicol Martinez',
      'Maikol Hernandez', 'Maikro Silveira', 'Mailen Rodriguez', 'Maira Barbero', 'Maira Falero',
      'Maira Sanchez', 'Maisa Moreira', 'Maite Fernandez', 'Maite Sasias', 'Malena Gonzalez',
      'Malena Sosa', 'Marcela Airala', 'Marcela Ferreira', 'Marcelo Gomez', 'Marcelo Pintos',
      'Marcelo Rodriguez', 'Marco Silva', 'Marcos Cespedes', 'Marcos Curbelo', 'Maria Alonso',
      'Maria Amaro', 'Maria Angulo', 'Maria Aplanalp', 'Maria Barcelo', 'Maria Barcelos',
      'Maria Caceres', 'Maria Chagas', 'Maria Da Cunha', 'Maria De los Santos', 'Maria Dieppa',
      'Maria Dominguez', 'Maria Fierro', 'Maria Galarraga', 'Maria Gomes', 'Maria Gomez',
      'Maria Henao', 'Maria Lobo', 'Maria Lopez', 'Maria Mansilla', 'Maria Martinez',
      'Maria Melendrez', 'Maria Melgarejo', 'Maria Mendez', 'Maria Monteagudo', 'Maria Morales',
      'Maria Nacimiento', 'Maria Napoleon', 'Maria Nunez', 'Maria Olivera', 'Maria Pereira',
      'Maria Penalosa', 'Maria Pintos', 'Maria Ramirez', 'Maria Ramos', 'Maria Real',
      'Maria Rodriguez', 'Maria Sanchez', 'Maria Scarano', 'Maria Silva', 'Maria Silvera',
      'Maria Torres', 'Maria Valerio', 'Maria Velazco', 'Maria de los Angeles Martinez',
      'Maria de los angeles Correa', 'Maria del Carmen Perrone', 'Mariadna Casas', 'Marian Gomez',
      'Mariana De Arrascaeta', 'Mariana Fernandez', 'Mariana La Palma', 'Mariana Olmedo',
      'Mariela Recuero', 'Mariela Ybarra', 'Marina Fernandez', 'Marina Suarez', 'Marisa Rosas',
      'Marisol Anaya', 'Maritza Adames', 'Marta Lavid', 'Martha Perdomo', 'Martina Abad',
      'Martina Correa', 'Mary Arocha', 'Mary De los Santos', 'Maria Arevalo', 'Maria Velazquez',
      'Mathias Bentancort', 'Mathias Monzon', 'Mathiu Morales', 'Matias Barreiro', 'Matias Caetano',
      'Matias Gonzalez', 'Matias Lubenko', 'Matias Machado', 'Matias Pintos', 'Matius Olivera',
      'Mauro De Castro', 'Maxima Maciel', 'Maximiliano Gonzalez', 'Maximiliano Mirabaye',
      'Mayerling Tovar', 'Mayra Orrego', 'Mayra Trucido', 'Megan Elizalde', 'Melani Falero',
      'Melani Piquet', 'Melanie Fajardo', 'Melany Perez', 'Melany Sanchez', 'Melisa Acosta',
      'Melissa Chocho', 'Melissa Eguren', 'Mercedes Contreras', 'Micaela Correa', 'Micaela Demestoy',
      'Micaela Leys', 'Micaela Lopez', 'Micaela Martinez', 'Michael Gonzalez', 'Michel Hernandez',
      'Miguel Muchacho', 'Miguel Perdomo', 'Miguel Retamosa', 'Miguel Rivero', 'Miladys Lopez',
      'Milagros Coitino', 'Milagros Diaz', 'Milagros Gonzalez', 'Milagros Gutierrez', 'Milagros Mazzulo',
      'Milton Echavaleta', 'Miriam Abero', 'Mirian Alvez', 'Mirian Landoni', 'Monica Baldomir',
      'Monica Delgado', 'Monica Godoy', 'Monica Maqueira', 'Monica Melgarejo', 'Monica Pereyra',
      'Monica Rodriguez', 'Myriam Gonzalez', 'Nadia Babace', 'Nadia Cardozo', 'Nadia Gimenez',
      'Nadia Mier', 'Nahim Gomez', 'Nahomi Cabrera', 'Nahuel Beltran', 'Nahuel Guillen',
      'Nahuel Moruzzi', 'Nairim Diaz', 'Nancy Blanche', 'Nancy Saya', 'Naomi Correa',
      'Nardo Urquiola', 'Natalia Bravo', 'Natalia Cabrera', 'Natalia Corbo', 'Natalia Cubilla',
      'Natalia Debernardi', 'Natalia Faroppa', 'Natalia Figueira', 'Natalia Vega', 'Nataly Amaral',
      'Nathali Bandera', 'Nathaniel De Leon', 'Nestor Cardozo', 'Nestor Ocampo', 'Nicauri Lluberes',
      'Nicol Fleitas', 'Nicolas Banega', 'Nicolas Bello', 'Nicolas Rodriguez', 'Nicole Garre',
      'Nicole Gonzalez', 'Nilda Perdomo', 'Nilza Dinardi', 'Ninozka Martinez', 'Niurka Llopiz',
      'Noelia Ramirez', 'Noemi Santiago', 'Norma Vignoli', 'Odelkys Diaz', 'Olivia Castillo',
      'Omaira Mangles', 'Omar Ferreira', 'Omar Indaburu', 'Oriana De la Campa', 'Orlando Fernandez',
      'Oscar Noguera', 'Pablo Mujica', 'Pablo Otero', 'Paloma Aguiar', 'Pamela Villa',
      'Paola Aguirre', 'Paola Alvez', 'Paola Fernandez', 'Paola Millan', 'Paola Rojas',
      'Patricia Alvarez', 'Patricia Aturaola', 'Patricia Cardozo', 'Patricia Crossa', 'Patricia Garrido',
      'Patricia Nunez', 'Patricia Rodriguez', 'Paula Ferradan', 'Paula Garcia', 'Paulina De los santos',
      'Pedro Nunez', 'Radames Garcia', 'Rafael Banfi', 'Raisel Martinez', 'Raquel Vaz',
      'Regina Carballo', 'Regla Delgado', 'Reinier Bello', 'Reni Adames', 'Reyna Quinones',
      'Ricardo Herrera', 'Ricardo Martinez', 'Richard Mello', 'Rina Ayala', 'Robert Placeres',
      'Roberto Moreta', 'Roberto Santana', 'Rocio Alvarez', 'Rocio Quijano', 'Rocio Ramirez',
      'Romina Aguirre', 'Romina Almeida', 'Romina Castillo', 'Romina Correa', 'Romina Gonzalez',
      'Romina Laquintana', 'Romina Pallero', 'Rosa Espinosa', 'Rosana Cal', 'Rossana Nunez',
      'Rossana Rodriguez', 'Roxana Figueira', 'Roxana Rodriguez', 'Roxana Silvera', 'Ruben Colombo',
      'Ruben Herrera', 'Ruben Sosa', 'Sabrina Nunez', 'Saily Morfi', 'Sandra Da Col',
      'Sandra Fernandez', 'Sandra Leon', 'Sandra Lopez', 'Sandra Montero', 'Sandra Pineyro',
      'Sandra Rebollo', 'Sandra Villalba', 'Santiago Alvez', 'Santiago Bernaola', 'Santiago Caballero',
      'Santiago Fernandez', 'Santiago Gonzalez', 'Sara Nierez', 'Sasha Ferreira', 'Schubert Caceres',
      'Sebastian Galvan', 'Sebastian Morales', 'Sebastian Rodriguez', 'Sebastian Scapino', 'Selenia De Aza',
      'Sergio Alvarez', 'Sergio Aquino', 'Sergio Bell', 'Sergio De Sosa Viera', 'Sergio Gonzalez',
      'Sergio Mederos', 'Sergio Rey', 'Sharon Alarcon', 'Shayra Rocha', 'Sheila Moraes',
      'Sheila Munoz', 'Sheila Taboada', 'Sheila de los Santos', 'Sheyla Fernandez', 'Shirley Rivero',
      'Silvana Montero', 'Silvana Pereyra', 'Silvana Techera', 'Silvia Flores', 'Silvia Melo',
      'Silvia Quevedo', 'Silvia Valdez', 'Silvia Viera', 'Silvina Britos', 'Sofia Araujo',
      'Sofia Britos', 'Sofia Carbone', 'Sofia Gomez', 'Sofia Miranda', 'Sofia Simonena',
      'Solange Acuna', 'Soledad Arbelo', 'Soraida Mendez', 'Stefani Ledesma', 'Stefanny Techera',
      'Stefany Alves', 'Stella Martins', 'Stephanie Guanco', 'Stephanie Vega', 'Susana Cabrera',
      'Susana Luis', 'Susana Taborda', 'Susana Yarza', 'Taissa Branas', 'Tamara Menendez',
      'Tamara Morales', 'Tamara Silva', 'Tanhia Luzardo', 'Tatiana Barboza', 'Tatiana Groba',
      'Teo Silvera', 'Teresita Alvez', 'Thaina Pereira', 'Thalia Almiron', 'Tomas Sosa',
      'Valentina De LaPuente', 'Valentina Lopez', 'Valentina Martinez', 'Valentina Santos', 'Valentino Pereyra',
      'Valeria Britos', 'Valeria Estrada', 'Valeria Lemes', 'Valeria Rodriguez', 'Valeria Silvia',
      'Vanesa Gonzalez', 'Vanesa Lemos', 'Vanessa Insua', 'Vanessa Rodriguez', 'Vanessa Zamora',
      'Vanina Albano', 'Veronica Alonso', 'Veronica Cabrera', 'Veronica Maneiro', 'Veronica Peluffo',
      'Veronica Rosano', 'Veronica Suarez', 'Veronica Vasquez', 'Vicky Britos', 'Victor Aguilera',
      'Victor Garcia', 'Victor Rivero', 'Victor Ruilopez', 'Victoria Amaral', 'Victoria Camacho',
      'Vilma Pirez', 'Virginia Torres', 'Viviana Rosa', 'Walter Farias', 'Washington Alvarez',
      'Washington Pintos', 'Wendi Morel', 'Wuilber Mijares', 'Yaima Hernandez', 'Yaimy Oves',
      'Yainier Barea', 'Yaiza Bermudez', 'Yajaira Sanchez', 'Yakivill Mora', 'Yamila Amaral',
      'Yamila Curbelo', 'Yamila Dentone', 'Yamila Fernandez', 'Yanina Alcantara', 'Yarilexis Nuviola',
      'Yasmany Chaviano', 'Yazmin Castano', 'Yeila Lopez', 'Yenifer Gonzalez', 'Yerisel Chaviano',
      'Yerity Sanchez', 'Yesenia Ceruto', 'Yesica Freitas', 'Yesy Rieta', 'Yinangel Zabala',
      'Yisety Rosa', 'Yissell Gavilan', 'Yoan Garcia', 'Yoana Segredo', 'Yodalis Sanchez',
      'Yohan Rodriguez', 'Yokayra Hernandez', 'Yolanda Perez', 'Yonathan Aldave', 'Yrenia Lemos',
      'Yudelky Franco', 'Yudith Silva', 'Yuleisy De Paula', 'Yuliana Gimenez', 'Yuneidi Bautista',
      'Yuneisky Batista', 'Yuner Acevedo', 'Yunet Carballoso', 'Yuniel Rodriguez', 'Yunieski Speck',
      'Yunior Lopez', 'Yurema Acosta', 'Yury Chacon', 'Yusmar Laroche', 'Yusnely Pereira',
      'Zoila Pena', 'Zully De los Santos',
    ];
    const unique = [...new Set(nombres)];
    if (this.type === 'pg') {
      // Bulk insert in a single query to avoid deadlock with _initPromise
      const placeholders = unique.map((_, i) => `($${i + 1})`).join(', ');
      await this.pgPool!.query(
        `INSERT INTO funcionarios_list (name) VALUES ${placeholders}`,
        unique
      );
    } else {
      // SQLite: synchronous direct calls, no wrapper needed
      const stmt = this.sqliteDb.prepare('INSERT INTO funcionarios_list (name) VALUES (?)');
      for (const name of unique) {
        stmt.run(name);
      }
    }
    console.log(`✅ Seeded ${unique.length} funcionarios`);
  }

  prepare(text: string) {
    if (this.type === 'sqlite') {
      return this.sqliteDb.prepare(text);
    }
    // For PG, we return an object that mimics better-sqlite3's Statement but uses await
    return {
      all: (...params: any[]) => this.query(text, params),
      get: (...params: any[]) => this.get(text, params),
      run: (...params: any[]) => this.run(text, params)
    };
  }
}

const db = new DbWrapper();

export default db;
