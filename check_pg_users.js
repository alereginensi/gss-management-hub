const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const names = ['CARLA DA LUZ', 'LOURDES CASAL', 'VICTOR RUILOPEZ', 'JUAN CIGARAN', 'MARTIN BATISTA', 'NAHIM GOMEZ', 'MEBYL CROSSA', 'DANIEL PEÑALVA', 'SANTIAGO MEDINA', 'SANTIAGO PEÑALVA'];

async function checkUsers() {
    try {
        const res = await pool.query('SELECT name, email, role FROM users WHERE name = ANY($1)', [names]);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUsers();
