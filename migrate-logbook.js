const Database = require('better-sqlite3');
const db = new Database('tickets.db');

console.log('Starting migration: Remove title column from logbook table...');

try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');

    // Create new table without title column
    db.exec(`
        CREATE TABLE logbook_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            sector TEXT,
            supervisor TEXT,
            location TEXT,
            report TEXT,
            staff_member TEXT,
            uniform TEXT,
            supervised_by TEXT,
            extra_data TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Copy data from old table to new table
    db.exec(`
        INSERT INTO logbook_new (id, date, sector, supervisor, location, report, staff_member, uniform, supervised_by, extra_data, createdAt)
        SELECT id, date, sector, supervisor, location, report, staff_member, uniform, supervised_by, extra_data, createdAt
        FROM logbook
    `);

    // Drop old table
    db.exec('DROP TABLE logbook');

    // Rename new table to logbook
    db.exec('ALTER TABLE logbook_new RENAME TO logbook');

    // Commit transaction
    db.exec('COMMIT');

    console.log('✓ Migration completed successfully!');
    console.log('✓ Title column removed from logbook table');

    // Verify the new schema
    const schema = db.prepare('SELECT sql FROM sqlite_master WHERE type="table" AND name="logbook"').get();
    console.log('\nNew table schema:');
    console.log(schema.sql);

} catch (error) {
    console.error('✗ Migration failed:', error.message);
    db.exec('ROLLBACK');
    process.exit(1);
}

db.close();
