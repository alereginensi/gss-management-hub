const db = require('better-sqlite3')('tickets.db');

const testUsers = [
    { id: 17, name: 'limpieza rubro', location: 'Centro Comercial A', sector: 'Plaza de Comidas' },
    { id: 20, name: 'Prueba Mantenimiento', location: 'Edificio Corporativo B', sector: 'Mantenimiento General' },
    { id: 21, name: 'Prueba Seguridad', location: 'Planta Industrial C', sector: 'Acceso Principal' },
    { id: 15, name: 'prueba funcionario', location: 'Hospital D', sector: 'Emergencias' }
];

const taskTypes = ['Limpieza profunda', 'Revisión técnica', 'Ronda de vigilancia', 'Mantenimiento preventivo', 'Control de stock', 'Asistencia al cliente'];

function generateRandomTime(baseHour, varianceMinutes) {
    const minutes = Math.floor(Math.random() * varianceMinutes);
    const date = new Date();
    date.setHours(baseHour, minutes, 0, 0);
    return date;
}

function formatDateToISO(date, dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    d.setHours(date.getHours(), date.getMinutes(), 0, 0);
    return d.toISOString();
}

console.log('--- Generando registros de asistencia de prueba ---');

const insertStmt = db.prepare('INSERT INTO tasks (user_id, description, type, created_at, location, sector) VALUES (?, ?, ?, ?, ?, ?)');

db.transaction(() => {
    // Generate data for the last 5 days
    for (let day = 0; day < 5; day++) {
        testUsers.forEach(user => {
            // 1. Check-in (around 08:00)
            const checkInTime = generateRandomTime(8, 30);
            const checkInISO = formatDateToISO(checkInTime, day);
            insertStmt.run(user.id, `Ingreso registrado en ${user.location} - ${user.sector}`, 'check_in', checkInISO, user.location, user.sector);

            // 2. Random tasks (1 to 3)
            const numTasks = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numTasks; i++) {
                const taskTime = generateRandomTime(9 + (i * 2), 60);
                const taskISO = formatDateToISO(taskTime, day);
                const taskDesc = taskTypes[Math.floor(Math.random() * taskTypes.length)];
                insertStmt.run(user.id, taskDesc, 'task', taskISO, user.location, user.sector);
            }

            // 3. Check-out (around 17:00)
            const checkOutTime = generateRandomTime(17, 30);
            const checkOutISO = formatDateToISO(checkOutTime, day);
            insertStmt.run(user.id, 'Salida registrada', 'check_out', checkOutISO, user.location, user.sector);
        });
    }
})();

console.log('✅ Registros generados exitosamente para 4 usuarios durante los últimos 5 días.');
const count = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE type IN ('check_in', 'check_out', 'task')").get();
console.log(`Total de registros en tabla tasks: ${count.count}`);
