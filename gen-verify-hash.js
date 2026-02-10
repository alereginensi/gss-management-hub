const bcrypt = require('bcryptjs');
const password = 'admin123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log("Generated hash:", hash);

const isValid = bcrypt.compareSync(password, hash);
console.log("Verification result:", isValid);
