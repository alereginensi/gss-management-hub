const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('Admin123!', 10);
const fs = require('fs');
fs.writeFileSync('hash.txt', hash);
console.log('Done');
