import db from './lib/db';

async function main() {
    console.log('Testing PG logbook insert...');
    try {
        const dummyEntry = {
            date: new Date().toISOString().split('T')[0],
            sector: 'Test Sector',
            supervisor: null,
            location: 'Test Location',
            incident: 'Test Incident',
            report: 'Test Report',
            staff_member: 'Test Staff',
            uniform: 'Completo',
            extra_data: {},
            supervised_by: 'Limpieza'
        };

        const insertSql = `
            INSERT INTO logbook (date, sector, supervisor, location, incident, report, staff_member, uniform, extra_data, supervised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.transaction(async (tx) => {
            const result = await tx.run(insertSql, [
                dummyEntry.date || null,
                dummyEntry.sector || null,
                dummyEntry.supervisor || null,
                dummyEntry.location || null,
                dummyEntry.incident || '',
                dummyEntry.report || '',
                dummyEntry.staff_member || '',
                dummyEntry.uniform || '',
                JSON.stringify(dummyEntry.extra_data || {}),
                dummyEntry.supervised_by || null
            ]);
            console.log('Result:', result);
        });
        console.log('SUCCESS!');
    } catch (e: any) {
        console.error('ERROR:', e.message);
        console.error(e);
    }
    process.exit(0);
}

main();
