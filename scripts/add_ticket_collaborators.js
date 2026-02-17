const db = require('better-sqlite3')('tickets.db');

console.log('Creating ticket_collaborators table...');

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_collaborators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            added_by INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (added_by) REFERENCES users(id),
            UNIQUE(ticket_id, user_id)
        );
    `);

    console.log('✅ ticket_collaborators table created successfully!');

    // Verify table exists
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_collaborators'").get();
    if (tableInfo) {
        console.log('✅ Table verified in database');
    } else {
        console.log('❌ Table not found after creation');
    }
} catch (error) {
    console.error('❌ Error creating table:', error.message);
}

db.close();
