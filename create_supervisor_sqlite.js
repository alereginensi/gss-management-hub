const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'tickets.db');

try {
    const db = new Database(dbPath);

    // Contraseña hash de Admin123
    const hashedPassword = '$2a$10$wE/i/uH.0oOT4H3wK21BTuH52Kx92S9N1cXVb7d5m0T6xLWeI2bLq';

    const stmt = db.prepare(`
        INSERT INTO users (email, password, name, role, rubro, department) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET 
            password=excluded.password, 
            name=excluded.name, 
            role=excluded.role, 
            rubro=excluded.rubro,
            department=excluded.department
    `);

    stmt.run(
        'supervisor@gss.com',
        hashedPassword,
        'Supervisor de Prueba',
        'supervisor',
        'Limpieza',
        'Operaciones'
    );

    console.log('✅ Usuario supervisor@gss.com creado exitosamente (clave: Admin123)');
} catch (e) {
    console.error('❌ Error creando usuario:', e.message);
}
