const db = require('better-sqlite3')('./data/database.sqlite');

const insertTasks = () => {
    // Let's assume user_id 2 is a worker
    const userId = 2;
    const today = new Date();

    console.log('Inserting test tasks for user 2...');

    // 1. Task 1: 08:00 AM at Casmu - Sanatorio 2
    const time1 = new Date(today);
    time1.setHours(8, 0, 0, 0);
    db.prepare(`
        INSERT INTO tasks (user_id, description, type, location, sector, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'Limpieza profunda de habitaciones', 'task', 'Casmu', 'Sanatorio 2', time1.toISOString());
    console.log('Task 1 inserted:', time1.toISOString());

    // 2. Task 2: 12:00 PM at same location
    const time2 = new Date(today);
    time2.setHours(12, 0, 0, 0);
    db.prepare(`
        INSERT INTO tasks (user_id, description, type, location, sector, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'Vaciado de papeleras', 'task', 'Casmu', 'Sanatorio 2', time2.toISOString());
    console.log('Task 2 inserted:', time2.toISOString());

    // 3. Task 3: 16:30 PM at same location (Checkout task)
    const time3 = new Date(today);
    time3.setHours(16, 30, 0, 0);
    db.prepare(`
        INSERT INTO tasks (user_id, description, type, location, sector, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'Cierre de turno y desinfección final', 'task', 'Casmu', 'Sanatorio 2', time3.toISOString());
    console.log('Task 3 inserted:', time3.toISOString());

    console.log('Test tasks inserted successfully. Total time should be 8h 30m.');
};

insertTasks();
