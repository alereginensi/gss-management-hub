import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const IS_PROD = process.env.NODE_ENV === 'production';

class DbWrapper {
  private pgPool: any | null = null;
  private sqliteDb: any | null = null;
  public type: 'pg' | 'sqlite' = 'sqlite';

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
  }

  private fallbackToSqlite() {
    console.log('⚠️ Using SQLite database.');
    const dbPath = IS_PROD ? '/app/data/tickets.db' : path.join(process.cwd(), 'tickets.db');

    // Ensure directory exists for SQLite
    const dbDir = path.dirname(dbPath);
    if (IS_PROD && !fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.sqliteDb = new Database(dbPath);
    this.type = 'sqlite';
  }

  async query(text: string, params: any[] = []): Promise<any[]> {
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
        created_at TIMESTAMP
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
        incident TEXT,
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
        id BIGSERIAL PRIMARY KEY,
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
        } catch (migErr) {
          console.error('❌ Error migrating logbook table in Postgres:', migErr);
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

        // Check notifications table for SQLite
        const notifInfo = this.sqliteDb.prepare("PRAGMA table_info(notifications)").all();
        const existingNotifCols = notifInfo.map((c: any) => c.name);
        if (!existingNotifCols.includes('ticket_subject')) {
          this.sqliteDb.exec('ALTER TABLE notifications ADD COLUMN ticket_subject TEXT');
        }
        if (!existingNotifCols.includes('status_color')) {
          this.sqliteDb.exec('ALTER TABLE notifications ADD COLUMN status_color TEXT');
        }
      } catch (e) {
        // Table might not exist yet if initialize just ran, but sanitize anyway
      }

      this.sqliteDb.exec(schema.replace(/SERIAL/g, 'INTEGER').replace(/TIMESTAMP/g, 'DATETIME').replace(/REFERENCES\s+\w+\(\w+\)/g, ''));
      console.log('✅ SQLite tables verified/created');
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

// Trigger initialization
if (typeof window === 'undefined') {
  db.initialize().catch(console.error);
}

export default db;
