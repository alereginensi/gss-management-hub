// Usage: HASH=<bcrypt-hash> PASS=yourpassword node scripts/test-hash-comp.js
const bcrypt = require('bcryptjs');

async function testHash() {
    const hash = process.env.HASH;
    const password = process.env.PASS;
    if (!hash || !password) { console.error('Set HASH and PASS env vars'); process.exit(1); }
    const isValid = await bcrypt.compare(password, hash);
    console.log("Hash compatibility test result:", isValid);
}

testHash();
