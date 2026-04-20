// Usage: PASS=yourpassword node scripts/gen-verify-hash.js
const bcrypt = require('bcryptjs');
const password = process.env.PASS;
if (!password) { console.error('Set PASS env var'); process.exit(1); }
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log("Generated hash:", hash);
const isValid = bcrypt.compareSync(password, hash);
console.log("Verification result:", isValid);
