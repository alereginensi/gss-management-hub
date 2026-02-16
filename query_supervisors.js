const db = require('better-sqlite3')('tickets.db');
const supervisors = db.prepare("SELECT id, name, email FROM users WHERE role = 'supervisor'").all();
console.log(JSON.stringify(supervisors, null, 2));
