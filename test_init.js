const { default: db } = require('./lib/db');

async function run() {
    try {
        await db.initialize();
        console.log('Database initialized successfully');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
