const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('Setting up foreign key constraints for better data integrity...\n');

// Check if foreign key constraints are enabled
const fkStatus = db.pragma('foreign_keys');
console.log('Foreign keys status:', fkStatus);

// Enable foreign keys
db.pragma('foreign_keys = ON');
console.log('Foreign keys enabled\n');

// Check current schema
console.log('Current ticket_collaborators schema:');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ticket_collaborators'").get();
console.log(schema?.sql || 'Table not found');

console.log('\nForeign keys are now enabled.');
console.log('Note: To make this permanent, the application should enable foreign keys on every connection.');
console.log('This is already done in lib/db.ts');

db.close();
