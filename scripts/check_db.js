const Database = require('better-sqlite3');
const fs = require('fs');

const run = () => {
    const files = ['./data/database.sqlite', './data/gss.sqlite'];
    for (const f of files) {
        if (!fs.existsSync(f)) continue;
        console.log(`Checking ${f}...`);
        try {
            const db = new Database(f);
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            console.log(`Tables in ${f}:`, tables.map(t => t.name).join(', '));

            if (tables.some(t => t.name === 'tasks')) {
                const countRow = db.prepare("SELECT COUNT(*) as c FROM tasks").get();
                console.log(`  Tasks count: ${countRow.c}`);
            }
            if (tables.some(t => t.name === 'users')) {
                const users = db.prepare("SELECT id, email, role FROM users LIMIT 3").all();
                console.log(`  Users:`, users);
            }
        } catch (e) {
            console.error(`Error reading ${f}:`, e.message);
        }
    }
}

run();
