// Usage: HASH=<bcrypt-hash> PASS=yourpassword node scripts/verify_hash.js
const bcrypt = require('bcryptjs');

const hash = process.env.HASH;
const password = process.env.PASS;
if (!hash || !password) { console.error('Set HASH and PASS env vars'); process.exit(1); }

bcrypt.compare(password, hash).then(res => {
    console.log(`Password matches hash: ${res}`);
});
