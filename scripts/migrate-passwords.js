const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('./tickets.db');

console.log('🔐 Password Migration Script\n');
console.log('This script will hash all plain text passwords in the database.\n');

// Function to check if password is already hashed
function isPasswordHashed(password) {
    return password && (password.startsWith('$2b$') || password.startsWith('$2a$') || password.startsWith('$2y$'));
}

// Get all users
const users = db.prepare('SELECT id, email, password FROM users').all();

console.log(`Found ${users.length} users in database\n`);

let migratedCount = 0;
let alreadyHashedCount = 0;
let emptyPasswordCount = 0;

// Process each user
for (const user of users) {
    if (!user.password || user.password.trim() === '') {
        console.log(`⚠️  User ${user.email} (ID: ${user.id}) has no password - skipping`);
        emptyPasswordCount++;
        continue;
    }

    if (isPasswordHashed(user.password)) {
        console.log(`✅ User ${user.email} (ID: ${user.id}) already has hashed password`);
        alreadyHashedCount++;
        continue;
    }

    // Hash the plain text password
    console.log(`🔄 Hashing password for ${user.email} (ID: ${user.id})...`);
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(user.password, salt);

    // Update the database
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    console.log(`✅ Successfully hashed password for ${user.email}`);
    migratedCount++;
}

console.log('\n📊 Migration Summary:');
console.log(`   Total users: ${users.length}`);
console.log(`   Migrated: ${migratedCount}`);
console.log(`   Already hashed: ${alreadyHashedCount}`);
console.log(`   Empty passwords: ${emptyPasswordCount}`);

// Verify migration
console.log('\n🔍 Verifying migration...');
const plainTextPasswords = db.prepare(`
    SELECT id, email 
    FROM users 
    WHERE password IS NOT NULL 
    AND password != '' 
    AND password NOT LIKE '$2%'
`).all();

if (plainTextPasswords.length === 0) {
    console.log('✅ All passwords are now hashed!');
} else {
    console.log(`⚠️  Warning: ${plainTextPasswords.length} users still have plain text passwords:`);
    plainTextPasswords.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
}

db.close();
console.log('\n✅ Migration complete!');
