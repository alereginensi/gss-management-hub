const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

try {
    const tickets = db.prepare('SELECT id, subject, requesterEmail, createdAt FROM tickets ORDER BY rowid DESC LIMIT 20').all();
    console.log("Last 20 Tickets in DB:");
    console.table(tickets);

    const maxIdRow = db.prepare('SELECT MAX(CAST(id AS INTEGER)) as maxId FROM tickets').get();
    console.log("Max ID result:", maxIdRow);

    const countRow = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    console.log("Total tickets count:", countRow.count);
} catch (e) {
    console.error("Error reading tickets:", e.message);
}
