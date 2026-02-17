const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('🔍 Test Data Audit\n');

// Check users
console.log('👥 USERS:');
const users = db.prepare('SELECT id, email, name, role, approved FROM users ORDER BY id').all();
users.forEach(u => {
    const testIndicators = [];
    if (u.email.includes('test')) testIndicators.push('test email');
    if (u.email.includes('gmail.com') && u.role !== 'user') testIndicators.push('gmail for staff');
    if (u.name && u.name.includes('test')) testIndicators.push('test name');

    const isTest = testIndicators.length > 0;
    const icon = isTest ? '🧪' : '✅';
    const note = isTest ? ` [${testIndicators.join(', ')}]` : '';

    console.log(`${icon} ID ${u.id}: ${u.email.padEnd(35)} | ${u.role.padEnd(12)} | ${u.name}${note}`);
});

// Check tickets
console.log('\n🎫 TICKETS:');
const tickets = db.prepare('SELECT id, subject, requester, status FROM tickets ORDER BY id').all();
if (tickets.length === 0) {
    console.log('   No tickets found');
} else {
    tickets.forEach(t => {
        const testIndicators = [];
        if (t.subject && t.subject.toLowerCase().includes('test')) testIndicators.push('test subject');
        if (t.subject && t.subject.toLowerCase().includes('prueba')) testIndicators.push('prueba subject');
        if (t.subject && t.subject.toLowerCase().includes('ejemplo')) testIndicators.push('ejemplo subject');
        if (parseInt(t.id) >= 1020 && parseInt(t.id) <= 1025) testIndicators.push('sample ID range');

        const isTest = testIndicators.length > 0;
        const icon = isTest ? '🧪' : '✅';
        const note = isTest ? ` [${testIndicators.join(', ')}]` : '';
        const subjectDisplay = t.subject ? t.subject.substring(0, 40).padEnd(40) : 'No subject'.padEnd(40);

        console.log(`${icon} ID ${t.id}: ${subjectDisplay} | ${t.status}${note}`);
    });
}

// Check logbook
console.log('\n📔 LOGBOOK ENTRIES:');
const logbookCount = db.prepare('SELECT COUNT(*) as count FROM logbook').get();
console.log(`   Total entries: ${logbookCount.count}`);

// Check tasks
console.log('\n✓ TASKS:');
const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
console.log(`   Total tasks: ${tasksCount.count}`);

// Check collaborators
console.log('\n👥 COLLABORATORS:');
const collabCount = db.prepare('SELECT COUNT(*) as count FROM ticket_collaborators').get();
console.log(`   Total collaborations: ${collabCount.count}`);

// Summary
console.log('\n📊 SUMMARY:');
console.log(`   Users: ${users.length}`);
console.log(`   Tickets: ${tickets.length}`);
console.log(`   Logbook entries: ${logbookCount.count}`);
console.log(`   Tasks: ${tasksCount.count}`);
console.log(`   Collaborations: ${collabCount.count}`);

const testUsers = users.filter(u =>
    u.email.includes('test') ||
    (u.email.includes('gmail.com') && u.role !== 'user')
);

console.log(`\n🧪 Test Data Found:`);
console.log(`   Test users: ${testUsers.length}`);

db.close();

console.log('\n💡 Review the items marked with 🧪 to determine what should be deleted.');
