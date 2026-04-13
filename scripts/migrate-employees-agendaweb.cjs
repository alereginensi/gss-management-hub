/**
 * MIGRACIÓN DE EMPLEADOS DESDE GSS-AGENDA-WEB
 * 
 * Uso: SOURCE_DB_URL="posgresql://..." node scripts/migrate-employees-agendaweb.cjs
 */
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), override: true });

const SOURCE_URL = process.env.SOURCE_DB_URL;
const DEST_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!SOURCE_URL) {
  console.error('❌ Error: SOURCE_DB_URL no definida.');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 Iniciando migración de empleados...');

  // 1. Conexión origen
  const sourcePool = new Pool({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
  
  // 2. Conexión destino (Hub)
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
    // 2.5 Asegurar que las tablas existan (especialmente en SQLite local)
    console.log('🏗️ Verificando tablas en destino...');
    const schema = `
      CREATE TABLE IF NOT EXISTS agenda_employees (
        id SERIAL PRIMARY KEY,
        documento TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        empresa TEXT,
        sector TEXT,
        puesto TEXT,
        workplace_category TEXT,
        fecha_ingreso TEXT,
        talle_superior TEXT,
        talle_inferior TEXT,
        calzado TEXT,
        enabled INTEGER DEFAULT 1,
        allow_reorder INTEGER DEFAULT 0,
        estado TEXT DEFAULT 'activo',
        observaciones TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Ajustar SERIAL para SQLite
    const localSchema = isPg ? schema : schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, "TEXT DEFAULT (datetime('now'))");
    
    if (isPg) {
      await destDb.query(localSchema);
    } else {
      destDb.exec(localSchema);
    }
    console.log('✅ Tablas verificadas.');

    // 3. Obtener empleados de origen
    console.log('📥 Obteniendo empleados del sistema anterior...');
    const { rows: sourceEmployees } = await sourcePool.query('SELECT * FROM employees');
    console.log(`✅ ${sourceEmployees.length} empleados encontrados.`);

    let migrated = 0;
    let errors = 0;

    for (const emp of sourceEmployees) {
      const nombreCompleto = `${emp.first_name} ${emp.last_name}`.trim();
      const enabled = emp.enabled ? 1 : 0;
      const allowReorder = emp.allow_reorder ? 1 : 0;

      try {
        if (isPg) {
          await destDb.query(`
            INSERT INTO agenda_employees (documento, nombre, empresa, puesto, enabled, allow_reorder, estado, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'activo', NOW())
            ON CONFLICT (documento) DO UPDATE SET
              nombre = EXCLUDED.nombre,
              empresa = EXCLUDED.empresa,
              puesto = EXCLUDED.puesto,
              enabled = EXCLUDED.enabled,
              allow_reorder = EXCLUDED.allow_reorder
          `, [emp.document_number, nombreCompleto, emp.company, emp.position, enabled, allowReorder]);
        } else {
          destDb.prepare(`
            INSERT INTO agenda_employees (documento, nombre, empresa, puesto, enabled, allow_reorder, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'activo')
            ON CONFLICT (documento) DO UPDATE SET
              nombre = excluded.nombre,
              empresa = excluded.empresa,
              puesto = excluded.puesto,
              enabled = excluded.enabled,
              allow_reorder = excluded.allow_reorder
          `).run(emp.document_number, nombreCompleto, emp.company, emp.position, enabled, allowReorder);
        }
        migrated++;
        if (migrated % 100 === 0) console.log(`... ${migrated} procesados`);
      } catch (err) {
        console.error(`❌ Error migrando ${emp.document_number}:`, err.message);
        errors++;
      }
    }

    console.log('\n✨ Migración finalizada.');
    console.log(`✅ Exitosos: ${migrated}`);
    console.log(`❌ Errores: ${errors}`);

  } finally {
    await sourcePool.end();
    if (isPg) await destDb.end();
    else destDb.close();
  }
}

migrate().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
