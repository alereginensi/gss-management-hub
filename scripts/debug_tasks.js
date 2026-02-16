const db = require('better-sqlite3')('tickets.db');
const q = `
    SELECT count(*) as count 
    FROM tasks t 
    JOIN users u ON t.user_id = u.id 
    WHERE 1=1 
    AND date(t.created_at) >= ? 
    AND date(t.created_at) <= ?
`;
const params = ['2026-02-16', '2026-02-16'];
console.log('Query:', q);
console.log('Params:', params);
const res = db.prepare(q).get(...params);
console.log('Count:', res.count);

// Also check raw dates in DB
const raw = db.prepare('SELECT created_at, date(created_at) as d FROM tasks ORDER BY created_at DESC LIMIT 5').all();
console.log('Raw sample:', raw);
