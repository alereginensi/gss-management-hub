const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('Checking for orphaned collaborators...\n');

// Find collaborators with deleted users
const orphanedCollaborators = db.prepare(`
    SELECT c.id, c.ticket_id, c.user_id, c.added_by, c.added_at
    FROM ticket_collaborators c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE u.id IS NULL
`).all();

console.log(`Found ${orphanedCollaborators.length} orphaned collaborators:`);
orphanedCollaborators.forEach(c => {
    console.log(`  - Collaborator ID ${c.id}: ticket ${c.ticket_id}, user_id ${c.user_id} (deleted)`);
});

// Find all collaborators
const allCollaborators = db.prepare('SELECT COUNT(*) as count FROM ticket_collaborators').get();
console.log(`\nTotal collaborators in database: ${allCollaborators.count}`);

// Clean up orphaned collaborators
if (orphanedCollaborators.length > 0) {
    console.log('\nCleaning up orphaned collaborators...');
    const result = db.prepare(`
        DELETE FROM ticket_collaborators
        WHERE user_id NOT IN (SELECT id FROM users)
    `).run();
    console.log(`Deleted ${result.changes} orphaned collaborator records.`);
}

db.close();
console.log('\nDone!');
