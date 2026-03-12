const { default: db } = require('./lib/db.js');

async function createSupervisor() {
    try {
        const stmt = db.prepare(`
            INSERT INTO users (email, password, name, role, rubro) 
            VALUES (?, ?, ?, ?, ?)
        `);
        // Password is 'Admin123'
        await stmt.run(
            'supervisor.logbook@gss.com',
            '$2a$10$wE/i/uH.0oOT4H3wK21BTuH52Kx92S9N1cXVb7d5m0T6xLWeI2bLq',
            'Responsable Pruebas',
            'supervisor',
            'Limpieza'
        );
        console.log('Test supervisor created: supervisor.logbook@gss.com / Admin123');
    } catch (e) {
        console.error(e);
    }
}

createSupervisor();
