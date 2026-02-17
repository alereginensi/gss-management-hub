const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('➕ Adding "Tercerizados" to job roles...\n');

// Check if it already exists
const existing = db.prepare('SELECT * FROM job_roles WHERE name = ?').get('Tercerizados');

if (existing) {
    console.log('✅ "Tercerizados" already exists in database');
} else {
    // Add it
    const result = db.prepare('INSERT INTO job_roles (name) VALUES (?)').run('Tercerizados');
    console.log(`✅ Added "Tercerizados" with ID: ${result.lastInsertRowid}`);
}

// Show all roles
console.log('\n📋 All job roles:');
const roles = db.prepare('SELECT * FROM job_roles ORDER BY id').all();
roles.forEach(role => {
    console.log(`  ID ${role.id}: ${role.name}`);
});

db.close();
console.log('\n✅ Done!');
