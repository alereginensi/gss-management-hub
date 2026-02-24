const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const usersToCreate = [
    { name: 'CARLA DA LUZ', email: 'carla.daluz@gss.com.uy', password: '5255' },
    { name: 'LOURDES CASAL', email: 'lourdes.casal@gss.com.uy', password: '3243' },
    { name: 'VICTOR RUILOPEZ', email: 'victor.ruilopez@gss.com.uy', password: '5561' },
    { name: 'JUAN CIGARAN', email: 'juan.cigaran@gss.com.uy', password: '2195' },
    { name: 'MARTIN BATISTA', email: 'martin.batista@gss.com.uy', password: '4873' },
    { name: 'NAHIM GOMEZ', email: 'nahim.gomez@gss.com.uy', password: '2082' },
    { name: 'MEBYL CROSSA', email: 'mebyl.crossa@gss.com.uy', password: '3301' },
    { name: 'DANIEL PEÑALVA', email: 'daniel.penalva@gss.com.uy', password: '1234' },
    { name: 'SANTIAGO MEDINA', email: 'santiago.medina@gss.com.uy', password: '2259' },
    { name: 'SANTIAGO PEÑALVA', email: 'santiago.penalva@gss.com.uy', password: '12329' }
];

async function createUsers() {
    for (const user of usersToCreate) {
        try {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(user.password, salt);

            const res = await pool.query(
                `INSERT INTO users (name, email, password, department, role, approved) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT (email) DO UPDATE 
                 SET password = EXCLUDED.password, role = EXCLUDED.role, approved = EXCLUDED.approved
                 RETURNING id`,
                [user.name, user.email, hash, 'Sin Asignar', 'supervisor', 1]
            );

            console.log(`✅ User ${user.name} created/updated with ID: ${res.rows[0].id}`);
        } catch (err) {
            console.error(`❌ Failed to create user ${user.name}:`, err.message);
        }
    }
}

createUsers().finally(() => pool.end());
