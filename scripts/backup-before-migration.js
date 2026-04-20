const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = './tickets.db';
const backupDir = './backups';

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
 fs.mkdirSync(backupDir, { recursive: true });
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupPath = path.join(backupDir, `tickets-pre-migration-${timestamp}.db`);

console.log('Creating database backup...');
console.log(` Source: ${dbPath}`);
console.log(` Backup: ${backupPath}`);

try {
 // Copy the database file
 fs.copyFileSync(dbPath, backupPath);

 // Verify backup
 const db = new Database(backupPath, { readonly: true });
 const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
 db.close();

 console.log(`Backup created successfully!`);
 console.log(` Users in backup: ${userCount.count}`);
 console.log(`\nSafe to proceed with migration.`);
 console.log(` Run: node scripts/migrate-passwords.js`);
} catch (error) {
 console.error('Backup failed:', error.message);
 process.exit(1);
}
