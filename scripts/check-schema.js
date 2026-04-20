const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('Database Schema Check\n');

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

console.log('Tables in database:');
tables.forEach(t => console.log(` - ${t.name}`));

// Check tickets table schema
console.log('\nTickets table columns:');
const ticketsInfo = db.prepare("PRAGMA table_info(tickets)").all();
ticketsInfo.forEach(col => {
 console.log(` - ${col.name} (${col.type})`);
});

db.close();
