const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'tickets.db');
const db = new Database(dbPath);
const bcrypt = require('bcryptjs');

const LOCATIONS = [
    'Edificio Central',
    'Planta Industrial',
    'Depósito Norte',
    'Depósito Sur',
    'Oficinas Administrativas'
];

const RUBROS = ['Limpieza', 'Mantenimiento', 'Seguridad', 'Logística'];

// 1. Ensure Users Exist for Each Rubro
const ensureUser = (name, email, rubro) => {
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        const pass = bcrypt.hashSync(process.env.TEST_PASS || Math.random().toString(36).slice(-10) + 'A1!', 10);
        const info = db.prepare('INSERT INTO users (name, email, password, department, role, rubro, approved) VALUES (?, ?, ?, ?, ?, ?, 1)')
            .run(name, email, pass, rubro, 'funcionario', rubro);
        console.log(`Created user: ${name} (${rubro})`);
        return info.lastInsertRowid;
    } else {
        // Update rubro if needed
        db.prepare('UPDATE users SET rubro = ?, role = ? WHERE id = ?').run(rubro, 'funcionario', user.id);
        console.log(`Updated user: ${name} (${rubro})`);
        return user.id;
    }
};

const users = [
    { id: ensureUser('Prueba Logística', 'logistica@example.com', 'Logística'), rubro: 'Logística' },
    { id: ensureUser('Prueba Limpieza', 'limpieza@example.com', 'Limpieza'), rubro: 'Limpieza' },
    { id: ensureUser('Prueba Mantenimiento', 'mantenimiento@test.com', 'Mantenimiento'), rubro: 'Mantenimiento' },
    { id: ensureUser('Prueba Seguridad', 'seguridad@test.com', 'Seguridad'), rubro: 'Seguridad' }
];

// Ensure Supervisor 'prueba supervisor' (ID 14) supervises ALL these users
const supervisor = db.prepare('SELECT id FROM users WHERE email = ?').get('supervisor@example.com');
if (supervisor) {
    users.forEach(u => {
        try {
            db.prepare('INSERT OR IGNORE INTO supervisor_worker (supervisor_id, worker_id) VALUES (?, ?)').run(supervisor.id, u.id);
            console.log(`Linked Supervisor ${supervisor.id} to Worker ${u.id}`);
        } catch (e) {
            console.log(`Link already exists or failed: ${e.message}`);
        }
    });
}

// 2. Generate Attendance Data for last 5 days
const today = new Date();
const tasksList = {
    'Limpieza': ['Limpieza de Baños', 'Limpieza de Pisos', 'Desinfección'],
    'Mantenimiento': ['Reparación Eléctrica', 'Pintura', 'Jardinería'],
    'Seguridad': ['Ronda Perimetral', 'Control de Acceso'],
    'Logística': ['Control de Stock', 'Carga de Camiones']
};

// Clear old tasks for these test users to avoid clutter?
// users.forEach(u => db.prepare('DELETE FROM tasks WHERE user_id = ?').run(u.id));
// console.log("Cleared old tasks for test users.");

for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    console.log(`Generating data for ${dateStr}...`);

    users.forEach(user => {
        // Randomize start time between 07:00 and 09:00
        const startHour = 7 + Math.floor(Math.random() * 2);
        const startMin = Math.floor(Math.random() * 60);

        const checkInTime = new Date(date);
        checkInTime.setHours(startHour, startMin, 0);

        // Random location
        const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

        // INSERT CHECK IN
        db.prepare('INSERT INTO tasks (user_id, description, type, created_at, location) VALUES (?, ?, ?, ?, ?)')
            .run(user.id, `Ingreso en: ${location}`, 'check_in', checkInTime.toISOString(), location);

        // INSERT 2-3 TASKS
        const numTasks = 2 + Math.floor(Math.random() * 2);
        for (let t = 0; t < numTasks; t++) {
            const taskTime = new Date(checkInTime);
            taskTime.setHours(startHour + 1 + t * 2, Math.floor(Math.random() * 60)); // Spread out tasks

            const taskDesc = tasksList[user.rubro][Math.floor(Math.random() * tasksList[user.rubro].length)];

            db.prepare('INSERT INTO tasks (user_id, description, type, created_at) VALUES (?, ?, ?, ?)')
                .run(user.id, taskDesc, 'task', taskTime.toISOString());
        }

        // INSERT CHECK OUT (8-9 hours later)
        const checkOutTime = new Date(checkInTime);
        checkOutTime.setHours(startHour + 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));

        db.prepare('INSERT INTO tasks (user_id, description, type, created_at) VALUES (?, ?, ?, ?)')
            .run(user.id, 'Salida registrada', 'check_out', checkOutTime.toISOString());
    });
}

console.log("Data generation complete!");
