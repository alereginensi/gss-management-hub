const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('📋 Job Roles (Rubros) in Database:\n');

const roles = db.prepare('SELECT * FROM job_roles ORDER BY id').all();

if (roles.length === 0) {
    console.log('⚠️  No job roles found in database!');
} else {
    console.log(`Found ${roles.length} job roles:\n`);
    roles.forEach(role => {
        console.log(`  ID ${role.id}: ${role.name}`);
    });
}

db.close();
