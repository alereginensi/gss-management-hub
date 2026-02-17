const db = require('better-sqlite3')('tickets.db');

console.log('Creating notifications table...');

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ticket_id TEXT,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
    `);

    console.log('✅ Notifications table created successfully!');

    // Verify
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get();
    console.log('\nTable schema:');
    console.log(tableInfo.sql);
} catch (error) {
    console.error('❌ Error creating notifications table:', error.message);
}

db.close();
