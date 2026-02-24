import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const force = searchParams.get('force') === 'true';
        const type = searchParams.get('type');

        if (type === 'supervisors') {
            const CSV_PATH = path.join(process.cwd(), 'data', 'func_bitacora(Hoja2).csv');
            if (!fs.existsSync(CSV_PATH)) {
                return NextResponse.json({ error: 'CSV file not found at ' + CSV_PATH }, { status: 404 });
            }

            const content = fs.readFileSync(CSV_PATH, 'latin1');
            const lines = content.split('\n');
            const rows = lines.slice(1); // skip header

            let createdCount = 0;
            let skippedCount = 0;
            let alreadyExistsCount = 0;

            for (const line of rows) {
                if (!line.trim()) continue;
                const cols = line.split(';');
                if (cols.length < 9) continue;

                const area = cols[0].trim();       // department
                const sector = cols[1].trim();     // rubro
                const funcionarioRaw = cols[2].trim(); // "NAME - PASSWORD"
                const email = cols[3].trim();
                const rol = cols[8].trim();        // "Comun" or "Administrador 2"

                if (rol === 'Administrador 2') {
                    skippedCount++;
                    continue;
                }

                const nameParts = funcionarioRaw.split(' - ');
                const name = nameParts[0].trim();
                const password = nameParts[1] ? nameParts[1].trim() : '1234';

                if (!email || !name) continue;

                const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
                if (existing) {
                    alreadyExistsCount++;
                    continue;
                }

                const hashedPassword = await hashPassword(password);
                await db.prepare(`
                    INSERT INTO users (name, email, password, department, role, rubro, approved)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(name, email, hashedPassword, area, 'supervisor', sector, 1);

                createdCount++;
            }

            return NextResponse.json({
                message: 'Supervisor seeding complete',
                created: createdCount,
                skippedAdmins: skippedCount,
                alreadyExists: alreadyExistsCount
            });
        }

        // Initialize Locations & Sectors from CSV data (Clientes y Lugares)
        const countLocs = await db.prepare('SELECT count(*) as count FROM locations').get() as { count: number };

        if (countLocs?.count > 0 && !force) {
            return NextResponse.json({ message: 'Locations already seeded. Use ?force=true to re-seed.' }, { status: 200 });
        }

        // Use transaction for safety and speed
        await db.transaction(async (tx) => {
            const isPg = (db as any).type === 'pg';

            const insertLocSql = isPg
                ? 'INSERT INTO locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING'
                : 'INSERT OR IGNORE INTO locations (name) VALUES (?)';

            const insertSecSql = isPg
                ? 'INSERT INTO sectors (name, location_id) VALUES ($1, $2) ON CONFLICT (name, location_id) DO NOTHING'
                : 'INSERT OR IGNORE INTO sectors (name, location_id) VALUES (?, ?)';

            const clientData: Record<string, string[]> = {
                'AMEC': [],
                'Arcanus': ['Durazno'],
                'Automotora Carrica': ['Bulevar Artigas', 'Av. Millan'],
                'Banco de Seguro': ['Casa Central', 'Bulevar Artigas', 'Casa Central - Garaje'],
                'Bas': ['Melo (506)', 'Florida (509)', 'San Jose (531)', 'Fray Bentos (532)', 'Durazno (515)', 'Minas (520)', 'Colonia (523)', 'Mercedes (518)', 'Trinidad (517)', '8 de octubre (511)'],
                'Berdick': ['Planta', 'Portero', 'Planta Nueva', 'Oficina'],
                'Capacitación Limpieza': [],
                'Carolina Mangarelli': ['Lagomar'],
                'Carrica automotores': ['Puente de las Americas', 'Prado'],
                'Casa Valentin': [],
                'Casas Lagomar': ['Graciela Garcia', 'Carolina Mangarelli', 'Martha Garcia'],
                'Casmu': [
                    'Sanatorio 2 Torre 1 Piso 6', 'Sanatorio 2 Torre 2 Piso 2', 'Sanatorio 2 Torre 2 Urgencia',
                    'Sanatorio 2 Torre 2 Policlinico', 'Sanatorio 2 Torre 1 Piso 4', 'Sanatorio 2 Torre 1 Piso 3',
                    'Sanatorio 2 Torre 1 Piso 5', 'Sanatorio 2 Torre 2', 'Sanatorio 2 Torre 1 Piso 2',
                    'Sanatorio 2 Ropería', 'Sanatorio 2 Asilo', 'Sanatorio 2 Torre 1 Piso 1',
                    'Sanatorio 2', 'Sanatorio 2 Torre 2 Urgencia Ginecológica', 'Sanatorio 2 Torre 1',
                    'Sanatorio 2 Torre 2 Cuartos Medicos', 'Sanatorio 2 Torre 1 Punta', 'Sanatorio 2 Centro Mamario',
                    'Sanatorio 2 Torre 2 Abreu', 'Sanatorio 2 Torre 2 PB y Sub', 'Sanatorio 2 Local 8',
                    'Sanatorio 2 Asilo Almacenes', 'Sanatorio 2 Policlinico Tomógrafo', 'Sanatorio 2 Torre 2 Urgencia Pediátrica',
                    'Sanatorio 2 Torre 2 Piso 5', 'Sanatorio 2 Local 8 Lavado de Móviles', 'Sanatorio 2 Torre 2 Piso 1',
                    'Sanatorio 2 Torre 2 SOE', 'Sanatorio 2 Asilo Pañol', 'Sanatorio 2 Asilo Contact Center',
                    'Sanatorio 2 Torre 2 Cocina', 'Sanatorio 2 Asilo Medicamentos', 'Sanatorio 2 Piscina',
                    'Sanatorio 2 Torre 2 Piso 3', 'Sanatorio 2 Policlínico Tomógrafo', 'Sanatorio 2 Taller Veracierto',
                    'Sanatorio 2 Cabina Abreu', 'Upeca Portones', 'Sanatorio 1 Odontología', 'Sanatorio 4',
                    'Sanatorio 1', 'Upeca Maldonado', 'Upeca Punta Carretas', '1727 Bv Artigas 1910',
                    'Upeca Paso de la Arena', 'Sanatorio 4 Oncologia', '1727 Agraciada', 'Upeca Colon',
                    '1727 Malvin Norte', 'Sanatorio 4 Centro Medico', 'Upeca Solymar', 'Taller Central Veracierto',
                    '1727 Solymar', 'Upeca Cerro', 'Upeca Guana', 'Upeca Cordon', 'Sanatorio 1 Salud Mental',
                    'Upeca Paso Carrasco', 'Upeca Agraciada', 'Upeca Piriapolis', 'Upeca Piedras Blancas',
                    'Upeca Parque Posadas', 'Upeca UAM', 'Upeca Parque Batlle', 'Centro Oftalmologico',
                    '1727 Colon', 'Upeca Tres cruces', 'Sanatorio 1 Vacunacion', '1727 Piedras Blancas',
                    'Upeca Sur y Palermo', 'Sanatorio 1 Farmacia', 'Upeca Malvin Norte',
                    'Sanatorio 1 - Adicional Upeca Cordon', '1727 Paso de la arena', 'Sanatorio 4 Hemodialisis',
                    'Referente Vigilante Auxiliar', 'Monitoreo', 'Deposito Cerro Adicional', 'Sanatorio 1 Cabina',
                    'Sanatorio Torre 1', 'Guana Centro Oftalmologico', 'Solymar (movil 15)', '1727 Bv. Artigas',
                    'Sanatorio 2 Salud Mental', 'Sanatorio 2 Cabina Asilo', 'Sanatorio 2 Policlínico',
                    'Punta Carretas', 'Sanatorio 2 CTI', 'Centro Mamario', 'Upeca Barrio Sur y Palermo',
                    'Malvin Alto (movil 1)', 'Encuesta', 'Capacitacion Administrativo', 'Colon (movil 9)',
                    'Piedras Blancas (movil 7)', 'Paso de la Arena (movil 8)', 'Tres Cruces (movil 2)',
                    'Tres Cruces (movil 5)', 'Tres Cruces (movil 3)', 'Prado (movil 30)',
                    'Centro Oftalmologico Guana', 'Prado (movil 4)', 'Solymar (movil 40)'
                ],
                'Celia': ['Limpieza'],
                'CES Seguridad': ['Grito de Gloria'],
                'Ciudad Pinturas': ['Giannatassio'],
                'Claro': [
                    'CAC Paso Molino', 'Mini CAC Las Piedras', 'Mini CAC Minas', 'CAC Costa Urbana',
                    'Isla Shopping Geant', 'Mini CAC Mercedes', 'Mini CAC Rivera', 'Mini CAC Florida',
                    'CAC 18 De Julio', 'Mini CAC Tacuarembo', 'Mini CAC Artigas', 'CAC Paysandú',
                    'CAC Salto', 'CAC Unión', 'Isla Nuevo Centro', 'Isla Tres Cruces', 'CAC Maldonado',
                    'San Martin Edificio Corporativo', 'Mini CAC Pando', 'Isla Punta Carretas',
                    'Isla Portones Shopping', 'Atlántida', 'Isla Montevideo Shopping'
                ],
                'Clinica Lura': [],
                'Cooke Uruguay': [],
                'Decosol': ['Via Disegno', 'Bagno & Company Av. Italia'],
                'Edificio Amezaga': [],
                'Edificio Charrua': ['Barbacoa'],
                'Edificio Paullier': [],
                'Edificio San Martin': [],
                'Edificio Thays': [],
                'Glic Global': ['Tienda Online'],
                'Hif Global': [],
                'Hora de Lactancia': [],
                'Nutriem Latam': [],
                'Obra GSS': [],
                'Porto vanila': ['Planta elaboradora'],
                'Proyecto Medishop': [],
                'Rawer Ltda': [],
                'Riven SRL': ['Clínica Dental Br. Artigas'],
                'Schmidt Premoldeados': ['Obra'],
                'Silber Studio': [],
                'Tata': ['Young (152)', 'Trinidad (145)', 'Trinidad (335)', 'San Jose (121)', 'Florida (315)', 'Mercedes (317)'],
                'Teyma': ['Fac. Enfermería'],
                'Tort Itda': ['2do Local'],
                'UDE': ['Punta Del Este'],
                'Veiga Ventos': ['Via Disegno'],
                'Viavip': ['Smart Parking'],
                'Wine Select': ['Vinos del Mundo'],
            };

            for (const [cliente, lugares] of Object.entries(clientData)) {
                await tx.run(insertLocSql, [cliente]);
                const loc = await tx.get('SELECT id FROM locations WHERE name = ?', [cliente]) as { id: number } | undefined;
                if (loc) {
                    for (const lugar of lugares) {
                        await tx.run(insertSecSql, [lugar, loc.id]);
                    }
                }
            }
        });

        console.log('Locations & sectors seeded successfully.');

        return NextResponse.json({ message: 'Seeding successful' }, { status: 200 });
    } catch (error) {
        console.error('Error during manually seeding:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
