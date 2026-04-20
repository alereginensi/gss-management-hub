const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

// Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASS=yourpassword node scripts/fix-admin-db.js
const adminEmail = process.env.ADMIN_EMAIL;
const adminPass = process.env.ADMIN_PASS;

if (!adminEmail || !adminPass) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASS env vars before running this script.');
    process.exit(1);
}

const adminHash = bcrypt.hashSync(adminPass, 10);
const result = db.prepare("UPDATE users SET password = ?, approved = 1, role = 'admin' WHERE email = ?")
    .run(adminHash, adminEmail);

console.log("Update result:", result);

const user = db.prepare("SELECT email, role, approved FROM users WHERE email = ?").get(adminEmail);
console.log("Updated user:", JSON.stringify(user, null, 2));
