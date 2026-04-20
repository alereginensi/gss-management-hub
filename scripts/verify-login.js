// Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASS=yourpassword node scripts/verify-login.js
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

async function testLogin(email, password) {
    console.log(`Testing login for: ${email}`);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        console.log("User not found!");
        return;
    }
    console.log("User found. Role:", user.role, "Approved:", user.approved);

    if (!user.password) {
        console.log("User has NO password set in DB.");
        return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isValid);
}

const email = process.env.ADMIN_EMAIL;
const pass = process.env.ADMIN_PASS;
if (!email || !pass) { console.error('Set ADMIN_EMAIL and ADMIN_PASS env vars'); process.exit(1); }

testLogin(email, pass).then(() => {
    const admins = db.prepare('SELECT email FROM users WHERE role = "admin"').all();
    console.log("All admins in DB:", JSON.stringify(admins));
});
