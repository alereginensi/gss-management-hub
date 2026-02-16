const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

console.log('Initializing tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    UNIQUE(name, location_id)
  );
`);

console.log('Tables initialized.');
