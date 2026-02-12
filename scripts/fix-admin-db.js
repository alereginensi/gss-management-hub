const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);

const adminPass = '$2b$10$ms9LTCqoDe5zRtwxnMZZ1.ZlQKcOdjBeZD.scyLnG0vkOpnt/ouAq';
const result = db.prepare("UPDATE users SET password = ?, approved = 1, role = 'admin' WHERE email = ?")
    .run(adminPass, 'admin@gss.com');

console.log("Update result:", result);

const user = db.prepare("SELECT email, password, role, approved FROM users WHERE email = 'admin@gss.com'").get();
console.log("Updated user:", JSON.stringify(user, null, 2));
