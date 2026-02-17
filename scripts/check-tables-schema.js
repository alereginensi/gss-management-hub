const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

// Check notifications table schema
console.log('📋 Notifications table columns:');
const notificationsInfo = db.prepare("PRAGMA table_info(notifications)").all();
notificationsInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Check tasks table schema
console.log('\n✓ Tasks table columns:');
const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all();
tasksInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

// Check logbook table schema
console.log('\n📔 Logbook table columns:');
const logbookInfo = db.prepare("PRAGMA table_info(logbook)").all();
logbookInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
});

db.close();
