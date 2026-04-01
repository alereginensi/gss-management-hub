
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// We can't easily import from lib/db.ts in a standalone Node script without transpilation
// if it uses ESmodules or specific Next.js features.
// However, we can use the same logic as lib/db.ts to connect directly.

const dotenv = require('dotenv');
dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let db;
let type = 'sqlite';

if (dbUrl) {
    const { Pool } = require('pg');
    db = new Pool({
        connectionString: dbUrl,
        ssl: IS_PROD ? { rejectUnauthorized: false } : false
    });
    type = 'pg';
    console.log('🐘 Connected to PostgreSQL');
} else {
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'tickets.db');
    db = new Database(dbPath);
    type = 'sqlite';
    console.log('⚠️ Connected to SQLite:', dbPath);
}

async function runQuery(text, params = []) {
    if (type === 'pg') {
        let count = 1;
        const pgText = text.replace(/\?/g, () => `$${count++}`);
        const res = await db.query(pgText, params);
        return res;
    } else {
        return db.prepare(text).run(...params);
    }
}

async function importCasmu() {
    const workbook = new ExcelJS.Workbook();
    const filePath = path.join(process.cwd(), 'personal_casmu.xlsx');
    
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        process.exit(1);
    }

    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    
    let processed = 0;
    let updated = 0;
    let created = 0;

    console.log('🚀 Starting import...');

    // We'll iterate row by row
    // Row 1: Header
    // Col 3: Documento, Col 4: Nombre, Col 5: Apellido
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const cedula = row.getCell(3).value?.toString().trim();
        const nombrePart = row.getCell(4).value?.toString().trim() || '';
        const apellidoPart = row.getCell(5).value?.toString().trim() || '';
        const nombreCompleto = `${nombrePart} ${apellidoPart}`.trim();

        if (!cedula || !nombreCompleto) continue;

        try {
            if (type === 'pg') {
                const res = await runQuery(
                    `INSERT INTO limpieza_usuarios (nombre, cedula, cliente, activo)
                     VALUES (?, ?, ?, 1)
                     ON CONFLICT (cedula) 
                     DO UPDATE SET nombre = EXCLUDED.nombre, cliente = EXCLUDED.cliente
                     RETURNING (xmax = 0) AS inserted`,
                    [nombreCompleto, cedula, 'Casmu']
                );
                if (res.rows[0].inserted) created++;
                else updated++;
            } else {
                // SQLite ON CONFLICT
                const res = runQuery(
                    `INSERT INTO limpieza_usuarios (nombre, cedula, cliente, activo)
                     VALUES (?, ?, ?, 1)
                     ON CONFLICT(cedula) DO UPDATE SET 
                        nombre=excluded.nombre,
                        cliente=excluded.cliente`,
                    [nombreCompleto, cedula, 'Casmu']
                );
                if (res.changes === 1) {
                    // better-sqlite3 doesn't easily tell you if it was an insert or update on conflict 
                    // without rowid check, but we can assume success.
                    processed++;
                }
            }
            processed++;
        } catch (err) {
            console.error(`❌ Error at row ${i} (CI: ${cedula}):`, err.message);
        }
    }

    console.log('====================================');
    console.log(`✅ Import finished!`);
    console.log(`Total processed: ${processed}`);
    if (type === 'pg') {
        console.log(`Created: ${created}`);
        console.log(`Updated: ${updated}`);
    }
    console.log('====================================');
    
    if (type === 'pg') await db.end();
}

importCasmu();
