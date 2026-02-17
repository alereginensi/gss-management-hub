const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('🗑️  Test Data Cleanup Script (Fixed)\n');

// Test users to delete
const testUserEmails = [
    'reginensia@gmail.com',
    'limpieza@gmail.com',
    'test_invlogin_1771257756469@gss.com',
    'mantenimiento@test.com',
    'seguridad@test.com'
];

// Test tickets to delete
const testTicketIds = ['1022', '1023', '1024'];

console.log('Test users to be deleted:');
testUserEmails.forEach(email => console.log(`  - ${email}`));
console.log('\nTest tickets to be deleted:');
testTicketIds.forEach(id => console.log(`  - Ticket #${id}`));
console.log('');

// Get user IDs and names
const usersToDelete = [];
testUserEmails.forEach(email => {
    const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email);
    if (user) {
        usersToDelete.push(user);
        console.log(`✓ Found user: ${user.email} (ID: ${user.id}, Name: ${user.name}, Role: ${user.role})`);
    } else {
        console.log(`⚠️  User not found: ${email}`);
    }
});

console.log(`\n📊 Total users to delete: ${usersToDelete.length}`);
console.log(`📊 Total tickets to delete: ${testTicketIds.length}\n`);

if (usersToDelete.length === 0 && testTicketIds.length === 0) {
    console.log('No data to delete. Exiting.');
    db.close();
    process.exit(0);
}

// Start cleanup
console.log('🧹 Starting cleanup...\n');

let deletedCount = {
    collaborators: 0,
    notifications: 0,
    tasks: 0,
    logbook: 0,
    supervisor_worker: 0,
    tickets: 0,
    users: 0
};

// Delete test tickets first (and their related data)
if (testTicketIds.length > 0) {
    console.log('1️⃣ Removing test tickets and related data...');
    testTicketIds.forEach(ticketId => {
        // Delete ticket collaborators
        const collabResult = db.prepare('DELETE FROM ticket_collaborators WHERE ticket_id = ?').run(ticketId);
        deletedCount.collaborators += collabResult.changes;

        // Delete ticket notifications
        const notifResult = db.prepare('DELETE FROM notifications WHERE ticket_id = ?').run(ticketId);
        deletedCount.notifications += notifResult.changes;

        // Delete ticket itself
        const ticketResult = db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
        deletedCount.tickets += ticketResult.changes;
    });
    console.log(`   Deleted ${deletedCount.tickets} tickets`);
    console.log(`   Deleted ${deletedCount.collaborators} ticket collaborations`);
}

// Delete user-related data
if (usersToDelete.length > 0) {
    console.log('2️⃣ Removing user collaborations...');
    usersToDelete.forEach(user => {
        const result = db.prepare('DELETE FROM ticket_collaborators WHERE user_id = ?').run(user.id);
        deletedCount.collaborators += result.changes;
    });
    console.log(`   Deleted ${deletedCount.collaborators} total collaboration records`);

    console.log('3️⃣ Removing user notifications...');
    usersToDelete.forEach(user => {
        const result = db.prepare('DELETE FROM notifications WHERE user_id = ?').run(user.id);
        deletedCount.notifications += result.changes;
    });
    console.log(`   Deleted ${deletedCount.notifications} total notifications`);

    console.log('4️⃣ Removing assigned tasks...');
    usersToDelete.forEach(user => {
        const result = db.prepare('DELETE FROM tasks WHERE user_id = ?').run(user.id);
        deletedCount.tasks += result.changes;
    });
    console.log(`   Deleted ${deletedCount.tasks} tasks`);

    console.log('5️⃣ Removing supervisor-worker relationships...');
    usersToDelete.forEach(user => {
        // Remove as supervisor
        const supResult = db.prepare('DELETE FROM supervisor_worker WHERE supervisor_id = ?').run(user.id);
        // Remove as worker
        const workerResult = db.prepare('DELETE FROM supervisor_worker WHERE worker_id = ?').run(user.id);
        deletedCount.supervisor_worker += supResult.changes + workerResult.changes;
    });
    console.log(`   Deleted ${deletedCount.supervisor_worker} supervisor-worker relationships`);

    console.log('6️⃣ Removing logbook entries...');
    usersToDelete.forEach(user => {
        // Try by staff_member name
        const result = db.prepare('DELETE FROM logbook WHERE staff_member = ?').run(user.name);
        deletedCount.logbook += result.changes;
    });
    console.log(`   Deleted ${deletedCount.logbook} logbook entries`);

    console.log('7️⃣ Removing users...');
    usersToDelete.forEach(user => {
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
        deletedCount.users += result.changes;
    });
    console.log(`   Deleted ${deletedCount.users} users`);
}

// Summary
console.log('\n✅ Cleanup Complete!\n');
console.log('📊 Summary:');
console.log(`   Tickets: ${deletedCount.tickets}`);
console.log(`   Collaborations: ${deletedCount.collaborators}`);
console.log(`   Notifications: ${deletedCount.notifications}`);
console.log(`   Tasks: ${deletedCount.tasks}`);
console.log(`   Supervisor-Worker links: ${deletedCount.supervisor_worker}`);
console.log(`   Logbook entries: ${deletedCount.logbook}`);
console.log(`   Users: ${deletedCount.users}`);

// Verify
console.log('\n🔍 Verification:');
const remainingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
const remainingTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
console.log(`   Remaining users: ${remainingUsers.count}`);
console.log(`   Remaining tickets: ${remainingTickets.count}`);

const remainingTestUsers = db.prepare(`
    SELECT email FROM users 
    WHERE email LIKE '%test%' 
    OR (email LIKE '%gmail.com%' AND role != 'user')
`).all();

if (remainingTestUsers.length === 0) {
    console.log('   ✅ No test users remaining');
} else {
    console.log(`   ⚠️  ${remainingTestUsers.length} potential test users still found:`);
    remainingTestUsers.forEach(u => console.log(`      - ${u.email}`));
}

db.close();
console.log('\n🎉 Done!');
