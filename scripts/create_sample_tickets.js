const db = require('better-sqlite3')('tickets.db');

console.log('Creating sample tickets in database...');

const sampleTickets = [
    {
        id: '1024',
        subject: 'Fallo en Aire Acondicionado Piso 3',
        description: 'El aire acondicionado del piso 3 no está trabajando',
        department: 'Mantenimiento',
        priority: 'Alta',
        status: 'Nuevo',
        requester: 'Juan Pérez',
        requesterEmail: 'juan@gss.com',
        date: '2026-02-10',
        statusColor: '#3b82f6'
    },
    {
        id: '1023',
        subject: 'Solicitud de Limpieza Sala Reuniones',
        description: 'Se requiere limpieza profunda de la sala de reuniones',
        department: 'Limpieza',
        priority: 'Media',
        status: 'En Progreso',
        requester: 'Ana Gómez',
        requesterEmail: 'ana@gss.com',
        date: '2026-02-09',
        statusColor: '#eab308'
    },
    {
        id: '1022',
        subject: 'Cambio de Toner Impresora RRHH',
        description: 'La impresora de RRHH necesita cambio de toner',
        department: 'IT',
        priority: 'Baja',
        status: 'Resuelto',
        requester: 'Carlos Ruiz',
        requesterEmail: 'carlos@gss.com',
        date: '2026-02-07',
        statusColor: '#22c55e'
    }
];

try {
    const insert = db.prepare(`
        INSERT OR REPLACE INTO tickets 
        (id, subject, description, department, priority, status, requester, requesterEmail, date, statusColor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sampleTickets.forEach(ticket => {
        insert.run(
            ticket.id,
            ticket.subject,
            ticket.description,
            ticket.department,
            ticket.priority,
            ticket.status,
            ticket.requester,
            ticket.requesterEmail,
            ticket.date,
            ticket.statusColor
        );
        console.log(`✅ Created ticket ${ticket.id}: ${ticket.subject}`);
    });

    console.log('\n✅ All sample tickets created successfully!');

    // Verify
    const count = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    console.log(`\nTotal tickets in database: ${count.count}`);
} catch (error) {
    console.error('❌ Error creating tickets:', error.message);
}

db.close();
