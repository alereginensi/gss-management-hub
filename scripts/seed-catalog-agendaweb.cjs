/**
 * SEED DE CATÁLOGO DESDE GSS-AGENDA-WEB
 * 
 * Uso: node scripts/seed-catalog-agendaweb.cjs
 */
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), override: true });

const DEST_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const COMPANY_UNIFORMS = {
  REIMA: [
    { name: "Camisa manga larga" },
    { name: "Corbata" },
    { name: "Calzado de vestir" },
    { name: "Buzo escote V" },
    { name: "Chaqueta de vestir" },
    { name: "Pantalón de vestir" },
    { name: "Remera gris" },
    { name: "Zapato negro sin puntera" },
    { name: "Buzo polar gris" },
    { name: "Campera gris" },
  ],
  ORBIS: [
    { name: "Camisa manga larga" },
    { name: "Chaqueta de vestir" },
    { name: "Pantalón de vestir" },
    { name: "Corbata" },
    { name: "Calzado de vestir" },
    { name: "Buzo escote V" },
  ],
  ERGON: [
    { name: "Calzado" },
    { name: "Polo" },
    { name: "Pantalón cargo" },
  ],
  SCOUT: [
    { name: "Casaca médica" },
    { name: "Pantalón médico" },
    { name: "Buzo polar" },
    { name: "Crocs" },
    { name: "Zapato negro sin puntera" },
  ],
};

async function seed() {
  console.log('🌱 Iniciando seed de catálogo...');

  // Conexión destino (Hub)
  let destDb;
  let isPg = false;

  if (DEST_URL) {
    console.log('🐘 Conectando a destino PostgreSQL...');
    destDb = new Pool({ connectionString: DEST_URL, ssl: { rejectUnauthorized: false } });
    isPg = true;
  } else {
    console.log('📁 Conectando a destino SQLite (tickets.db)...');
    destDb = new Database(path.join(process.cwd(), 'tickets.db'));
  }

  try {
    // 2.5 Asegurar que las tablas existan
    console.log('🏗️ Verificando tablas en destino...');
    const schema = `
      CREATE TABLE IF NOT EXISTS agenda_uniform_catalog (
        id SERIAL PRIMARY KEY,
        empresa TEXT,
        sector TEXT,
        puesto TEXT,
        workplace_category TEXT,
        article_type TEXT NOT NULL,
        article_name_normalized TEXT,
        quantity INTEGER DEFAULT 1,
        useful_life_months INTEGER DEFAULT 12,
        initial_enabled INTEGER DEFAULT 1,
        renewable INTEGER DEFAULT 1,
        reusable_allowed INTEGER DEFAULT 0,
        special_authorization_required INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const localSchema = isPg ? schema : schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, "TEXT DEFAULT (datetime('now'))");
    
    if (isPg) {
      await destDb.query(localSchema);
    } else {
      destDb.exec(localSchema);
    }
    console.log('✅ Tablas verificadas.');

    let inserted = 0;

    for (const [company, items] of Object.entries(COMPANY_UNIFORMS)) {
      for (const item of items) {
        try {
          if (isPg) {
            await destDb.query(`
              INSERT INTO agenda_uniform_catalog (empresa, article_type, quantity, useful_life_months, initial_enabled, renewable)
              VALUES ($1, $2, 1, 12, 1, 1)
              ON CONFLICT DO NOTHING
            `, [company, item.name]);
          } else {
            destDb.prepare(`
              INSERT INTO agenda_uniform_catalog (empresa, article_type, quantity, useful_life_months, initial_enabled, renewable)
              VALUES (?, ?, 1, 12, 1, 1)
              ON CONFLICT DO NOTHING
            `).run(company, item.name);
          }
          inserted++;
        } catch (err) {
          console.error(`❌ Error insertando ${item.name} para ${company}:`, err.message);
        }
      }
    }

    console.log(`\n✨ Seed finalizado. ${inserted} artículos procesados.`);

  } finally {
    if (isPg) await destDb.end();
    else destDb.close();
  }
}

seed().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
