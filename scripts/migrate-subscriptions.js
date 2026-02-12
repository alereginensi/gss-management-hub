const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tickets.db');
const db = new Database(dbPath);

console.log('Migrating database to support Push Subscriptions...');

try {
    // Add push_subscription column to users table
    // It will store the JSON string of the subscription object
    db.prepare('ALTER TABLE users ADD COLUMN push_subscription TEXT').run();
    console.log('Added push_subscription column to users table.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('Column push_subscription already exists.');
    } else {
        console.error('Error adding column:', error);
    }
}

db.close();
console.log('Migration complete.');
