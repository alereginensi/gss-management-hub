const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

try {
    const users = db.prepare('SELECT email, role, approved, password FROM users').all();
    console.log("Users in DB:", JSON.stringify(users, null, 2));
} catch (e) {
    console.error("Error reading users:", e.message);
}
