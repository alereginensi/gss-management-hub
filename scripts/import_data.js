const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);
const csvPath = path.resolve(process.cwd(), 'data', 'Clientes lugares y cargos(Clientes + Lugares).csv');

function importData() {
    console.log('Starting data import...');

    let content;
    const tempUtf8Path = path.resolve(process.cwd(), 'data', 'temp_utf8.csv');

    if (fs.existsSync(tempUtf8Path)) {
        console.log('Using converted UTF-8 file...');
        content = fs.readFileSync(tempUtf8Path, 'utf-8');
    } else {
        console.log('Using original file with windows-1252 decoder...');
        const buffer = fs.readFileSync(csvPath);
        const decoder = new TextDecoder('windows-1252');
        content = decoder.decode(buffer);
    }
    const lines = content.split('\n');

    // Clean existing data?
    // User requested substitution, so we clear locations and sectors.
    // Be careful with foreign keys if there is existing data using them.
    // For now, we assume we can clear them as requested.
    db.prepare('DELETE FROM sectors').run();
    db.prepare('DELETE FROM locations').run();
    // Reset auto-increment
    db.prepare("DELETE FROM sqlite_sequence WHERE name='locations' OR name='sectors'").run();

    console.log('Cleared existing locations and sectors.');

    const insertLocation = db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)');
    const getLocationId = db.prepare('SELECT id FROM locations WHERE name = ?');
    const insertSector = db.prepare('INSERT OR IGNORE INTO sectors (name, location_id) VALUES (?, ?)');

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(';');
        const client = parts[0]?.trim(); // Maps to Location
        const place = parts[1]?.trim();  // Maps to Sector

        if (client) {
            insertLocation.run(client);
            const locId = getLocationId.get(client).id;

            if (place) {
                insertSector.run(place, locId);
            }
        }
    }

    console.log('Import completed successfully.');

    // Verification
    const locCount = db.prepare('SELECT count(*) as c FROM locations').get().c;
    const secCount = db.prepare('SELECT count(*) as c FROM sectors').get().c;
    console.log(`Summary: ${locCount} Locations (Clients), ${secCount} Sectors (Places) imported.`);
}

importData();
