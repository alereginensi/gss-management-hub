const Database = require('better-sqlite3');
const db = new Database('./tickets.db');

console.log('🔍 Password Security Verification\n');

// Check all users
const users = db.prepare('SELECT id, email, password, role FROM users ORDER BY id').all();

console.log('📊 User Password Status:\n');

let hashedCount = 0;
let emptyCount = 0;
let plainTextCount = 0;

users.forEach(user => {
    let status = '';
    let icon = '';

    if (!user.password || user.password.trim() === '') {
        status = 'No password (Solicitante)';
        icon = '⚪';
        emptyCount++;
    } else if (user.password.startsWith('$2')) {
        status = 'Hashed with bcrypt';
        icon = '✅';
        hashedCount++;
    } else {
        status = '⚠️  PLAIN TEXT - SECURITY RISK!';
        icon = '❌';
        plainTextCount++;
    }

    console.log(`${icon} ${user.email.padEnd(35)} | ${user.role.padEnd(12)} | ${status}`);
});

console.log('\n📈 Summary:');
console.log(`   ✅ Hashed passwords: ${hashedCount}`);
console.log(`   ⚪ Empty passwords: ${emptyCount} (expected for solicitantes)`);
console.log(`   ❌ Plain text passwords: ${plainTextCount}`);

if (plainTextCount === 0) {
    console.log('\n🎉 SUCCESS! All passwords are properly secured with bcrypt hashing.');
} else {
    console.log('\n⚠️  WARNING: Some passwords are still in plain text. Run migration again.');
}

// Show sample hashed password format
const hashedUser = users.find(u => u.password && u.password.startsWith('$2'));
if (hashedUser) {
    console.log('\n🔐 Sample hashed password format:');
    console.log(`   ${hashedUser.password.substring(0, 60)}...`);
}

db.close();
