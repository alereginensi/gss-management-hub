
import db from '../lib/db';

console.log('--- Starting DB Debug ---');

if (!db) {
    console.error('FATAL: db object is null. Initialization failed in the try-catch block of lib/db.ts.');
    process.exit(1);
}

try {
    console.log('Running test query on locations...');
    const locations = db.prepare('SELECT * FROM locations').all();
    console.log(`Success! Found ${locations.length} locations.`);
    console.log('First 3 locations:', locations.slice(0, 3));

    console.log('Running test query on sectors...');
    const sectors = db.prepare('SELECT * FROM sectors').all();
    console.log(`Success! Found ${sectors.length} sectors.`);
} catch (e) {
    console.error('FATAL: Query failed:', e);
}
