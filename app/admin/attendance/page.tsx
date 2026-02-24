'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useTicketContext } from '../../context/TicketContext';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { Calendar, Clock, ChevronDown, ChevronUp, Download, LogIn, LogOut, Filter } from 'lucide-react';

interface Workday {
    date: string;
    userId: number;
    userName: string;
    department: string;
    rubro?: string;
    location?: string;
    sector?: string;
    checkIn: string | null;
    checkOut: string | null;
    totalHours: string;
    tasks: { time: string; description: string }[];
}

export default function AttendancePage() {
    const { currentUser, isSidebarOpen } = useTicketContext();
    const [attendance, setAttendance] = useState<Workday[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterLocation, setFilterLocation] = useState('');
    const [filterRubro, setFilterRubro] = useState('');
    const [filterSector, setFilterSector] = useState('');
    const [roles, setRoles] = useState<any[]>([]);

    // Mismos clientes y sectores que la bitácora
    const CLIENT_SECTOR_MAP: Record<string, string[]> = {
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
            'Sanatorio 2 Policlinico', 'Sanatorio 2 Torre 1 Piso 4', 'Sanatorio 2 Torre 1 Piso 3',
            'Sanatorio 2 Torre 1 Piso 5', 'Sanatorio 2 Torre 2', 'Sanatorio 2 Torre 1 Piso 2',
            'Sanatorio 2 Ropería', 'Sanatorio 2 Asilo', 'Sanatorio 2 Torre 1 Piso 1',
            'Sanatorio 2', 'Sanatorio 2 Torre 2 Urgencia Ginecológica', 'Sanatorio 2 Torre 1',
            'Sanatorio 2 Torre 2 Cuartos Medicos', 'Sanatorio 2 Torre 1 Punta', 'Sanatorio 2 Centro Mamario',
            'Sanatorio 2 Torre 2 Abreu', 'Sanatorio 2 Torre 2 PB y Sub', 'Sanatorio 2 Local 8',
            'Sanatorio 2 Asilo Almacenes', 'Sanatorio 2 Policlinico Tomógrafo',
            'Sanatorio 2 Torre 2 Urgencia Pediátrica', 'Sanatorio 2 Torre 2 Piso 5',
            'Sanatorio 2 Local 8 Lavado de Móviles', 'Sanatorio 2 Torre 2 Piso 1', 'Sanatorio 2 Torre 2 SOE',
            'Sanatorio 2 Asilo Pañol', 'Sanatorio 2 Asilo Contact Center', 'Sanatorio 2 Torre 2 Cocina',
            'Sanatorio 2 Asilo Medicamentos', 'Sanatorio 2 Piscina', 'Sanatorio 2 Torre 2 Piso 3',
            'Sanatorio 2 Taller Veracierto', 'Sanatorio 2 Cabina Abreu',
            'Upeca Portones', 'Sanatorio 1 Odontología', 'Sanatorio 4', 'Sanatorio 1',
            'Upeca Maldonado', 'Upeca Punta Carretas', '1727 Bv Artigas 1910', 'Upeca Paso de la Arena',
            'Sanatorio 4 Oncologia', '1727 Agraciada', 'Upeca Colon', '1727 Malvin Norte',
            'Sanatorio 4 Centro Medico', 'Upeca Solymar', 'Taller Central Veracierto', '1727 Solymar',
            'Upeca Cerro', 'Upeca Guana', 'Upeca Cordon', 'Sanatorio 1 Salud Mental',
            'Upeca Paso Carrasco', 'Upeca Agraciada', 'Upeca Piriapolis', 'Upeca Piedras Blancas',
            'Upeca Parque Posadas', 'Upeca UAM', 'Upeca Parque Batlle', 'Centro Oftalmologico',
            '1727 Colon', 'Upeca Tres cruces', 'Sanatorio 1 Vacunacion', '1727 Piedras Blancas',
            'Upeca Sur y Palermo', 'Sanatorio 1 Farmacia', 'Upeca Malvin Norte',
            'Sanatorio 1 - Adicional Upeca Cordon', '1727 Paso de la arena',
            'Sanatorio 4 Hemodialisis', 'Referente Vigilante Auxiliar', 'Monitoreo',
            'Deposito Cerro Adicional', 'Sanatorio 1 Cabina', 'Sanatorio Torre 1',
            'Guana Centro Oftalmologico', 'Solymar (movil 15)', '1727 Bv. Artigas',
            'Sanatorio 2 Salud Mental', 'Sanatorio 2 Cabina Asilo', 'Punta Carretas',
            'Sanatorio 2 CTI', 'Centro Mamario', 'Upeca Barrio Sur y Palermo',
            'Malvin Alto (movil 1)', 'Colon (movil 9)', 'Piedras Blancas (movil 7)',
            'Paso de la Arena (movil 8)', 'Tres Cruces (movil 2)', 'Tres Cruces (movil 5)',
            'Tres Cruces (movil 3)', 'Prado (movil 30)', 'Centro Oftalmologico Guana',
            'Prado (movil 4)', 'Solymar (movil 40)'
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
        'Hospital BSE': [],
        'Hotel Ibis': [],
        'Indian': ['Atlantico', 'Punta Market Punta del Este', 'Fragata', 'Punta Shopping', 'Gorlero', 'Ariel', 'Portones', 'Maldonado', 'Montevideo Shopping'],
        'INDIAN Chic Parisien': ['Salto', 'Tacuarembo'],
        'L&G': [],
        'La Molienda': ['Sarandi', 'Ejido', 'Rondeau Cocina', '18 de Julio', 'Rondeau Oficina', 'Uruguay'],
        'La Molienda Colonia': [],
        'Lactosan': [],
        'Logitech': [],
        'Mayorista el As': [],
        'Microlab': [],
        'Mundo Mac': ['Punta Shopping'],
        'Nedabal': [],
        'Nutriem Latam': [],
        'Obra GSS': [],
        'Plaza Correo': [],
        'Porto vanila': ['Planta elaboradora'],
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
    const availableClients = Object.keys(CLIENT_SECTOR_MAP).sort();
    const getSectorsForClient = (client: string): string[] => CLIENT_SECTOR_MAP[client] || [];

    useEffect(() => {
        if (currentUser?.id) {
            fetchAttendance();
            fetchFilters();
        }
    }, [currentUser, filterDate, filterLocation, filterRubro, filterSector]);

    const fetchFilters = async () => {
        try {
            const roleRes = await fetch('/api/config/roles');
            if (roleRes.ok) setRoles(await roleRes.json());
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchAttendance = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/attendance?requesterId=${currentUser.id}&requesterRole=${currentUser.role}&startDate=${filterDate}&endDate=${filterDate}&location=${encodeURIComponent(filterLocation)}&rubro=${encodeURIComponent(filterRubro)}&sector=${encodeURIComponent(filterSector)}`);
            if (res.ok) {
                const data = await res.json();
                setAttendance(data);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async () => {
        if (attendance.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        try {
            const Excel = (await import('exceljs')).default;
            const workbook = new Excel.Workbook();
            const worksheet = workbook.addWorksheet('Asistencia');

            // Columns optimized for Pivot Tables (Flat structure)
            worksheet.columns = [
                { header: 'Funcionario', key: 'userName', width: 25 },
                { header: 'Departamento', key: 'department', width: 20 },
                { header: 'Cliente', key: 'location', width: 20 },
                { header: 'Sector', key: 'sector', width: 20 },
                { header: 'Fecha', key: 'date', width: 15 },
                { header: 'Hora Ingreso', key: 'checkIn', width: 15 },
                { header: 'Hora Salida', key: 'checkOut', width: 15 },
                { header: 'Total Horas', key: 'totalHours', width: 15 },
                { header: 'Hora Tarea', key: 'taskTime', width: 15 },
                { header: 'Descripción Tarea', key: 'taskDesc', width: 40 }
            ];

            // Header styling
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };

            // Default styling for all headers (GSS Blue)
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF29416B' }
                };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // CUSTOM COLORS FOR METRICS
            // 1. Hora Ingreso (Col 6) -> Green
            const checkInCell = headerRow.getCell(6);
            checkInCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };

            // 2. Hora Salida (Col 7) -> Red
            const checkOutCell = headerRow.getCell(7);
            checkOutCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };

            // 3. Total Horas (Col 8) -> Yellow (with dark text for visibility)
            const totalHoursCell = headerRow.getCell(8);
            totalHoursCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            totalHoursCell.font = { bold: true, color: { argb: 'FF000000' } };

            // Data rows
            attendance.forEach(day => {
                if (day.tasks.length === 0) {
                    worksheet.addRow({
                        userName: day.userName,
                        department: day.rubro || day.department,
                        location: day.location || '-',
                        sector: day.sector || '-',
                        date: day.date,
                        checkIn: day.checkIn,
                        checkOut: day.checkOut,
                        totalHours: day.totalHours,
                        taskTime: '--',
                        taskDesc: '(Sin tareas registradas)'
                    });
                } else {
                    day.tasks.forEach(t => {
                        worksheet.addRow({
                            userName: day.userName,
                            department: day.rubro || day.department,
                            location: day.location || '-',
                            sector: day.sector || '-',
                            date: day.date,
                            checkIn: day.checkIn,
                            checkOut: day.checkOut,
                            totalHours: day.totalHours,
                            taskTime: t.time,
                            taskDesc: t.description
                        });
                    });
                }
            });

            // Center all columns for better presentation
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.alignment = { vertical: 'middle', horizontal: rowNumber === 1 ? 'center' : 'left' };
                    if (rowNumber > 1) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                });
            });

            // Auto-filters
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: 10 }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Asistencia_${filterDate}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error al generar el Excel');
        }
    };

    const toggleRow = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor') {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Acceso denegado</div>;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '1rem'
            }}>
                <Header title="Reporte de Asistencia" />

                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                    {/* FILTERS */}
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Calendar size={20} color="var(--accent-color)" />
                            <label style={{ fontWeight: 600 }}>Fecha:</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Filter size={20} color="var(--accent-color)" />
                            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cliente:</label>
                            <select
                                value={filterLocation}
                                onChange={(e) => {
                                    setFilterLocation(e.target.value);
                                    setFilterSector('');
                                }}
                                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                            >
                                <option value="">Todos los Clientes</option>
                                {availableClients.map(cl => (
                                    <option key={cl} value={cl}>{cl}</option>
                                ))}
                            </select>
                        </div>

                        {filterLocation && getSectorsForClient(filterLocation).length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sector:</label>
                                <select
                                    value={filterSector}
                                    onChange={(e) => setFilterSector(e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                                >
                                    <option value="">Todos los Sectores</option>
                                    {getSectorsForClient(filterLocation).map((sec: string) => (
                                        <option key={sec} value={sec}>{sec}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                                value={filterRubro}
                                onChange={(e) => setFilterRubro(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                            >
                                <option value="">Todos los Rubros</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.name}>{role.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={exportToExcel}
                                className="btn"
                                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                            >
                                <Download size={18} />
                                Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando datos...</div>
                        ) : attendance.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <p>No se encontró actividad para esta fecha.</p>
                                {currentUser?.role === 'supervisor' && (
                                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                        Nota: Solo verás la actividad de los funcionarios asignados a tu supervisión.
                                        <br />
                                        <span style={{ fontSize: '0.7rem', color: '#999' }}>Debug: ID {currentUser?.id} ({currentUser?.role}) | Fecha: {filterDate}</span>
                                    </p>
                                )}
                                {currentUser?.role === 'admin' && (
                                    <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.5rem' }}>Debug: ID {currentUser?.id} (admin) | Fecha: {filterDate}</p>
                                )}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '1rem' }}>Funcionario</th>
                                            <th style={{ padding: '1rem' }}>Departamento</th>
                                            <th style={{ padding: '1rem' }}>Lugar</th>
                                            <th style={{ padding: '1rem' }}>Sector</th>
                                            <th style={{ padding: '1rem' }}><LogIn size={14} style={{ marginRight: '0.4rem' }} /> Ingreso</th>
                                            <th style={{ padding: '1rem' }}><LogOut size={14} style={{ marginRight: '0.4rem' }} /> Salida</th>
                                            <th style={{ padding: '1rem' }}><Clock size={14} style={{ marginRight: '0.4rem' }} /> Total</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Tareas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.map((day) => {
                                            const rowId = `${day.userId}_${day.date}`;
                                            const isExpanded = expandedRow === rowId;

                                            return (
                                                <React.Fragment key={rowId}>
                                                    <tr style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => toggleRow(rowId)}>
                                                        <td style={{ padding: '1rem', fontWeight: 500 }}>{day.userName}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#f3f4f6', borderRadius: '12px', color: '#374151' }}>
                                                                {day.rubro || day.department}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{day.location || '-'}</td>
                                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{day.sector || '-'}</td>
                                                        <td style={{ padding: '1rem', color: '#16a34a', fontWeight: 600 }}>{day.checkIn || '--:--'}</td>
                                                        <td style={{ padding: '1rem', color: '#dc2626', fontWeight: 600 }}>{day.checkOut || '--:--'}</td>
                                                        <td style={{ padding: '1rem', fontWeight: 700 }}>{day.totalHours} hs</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: '0 auto' }}>
                                                                {day.tasks.length} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr style={{ backgroundColor: '#f9fafb' }}>
                                                            <td colSpan={8} style={{ padding: '1.5rem' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '1.5rem' }}>
                                                                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle de Actividades</h4>
                                                                    {day.tasks.length === 0 ? (
                                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>No hay tareas registradas.</p>
                                                                    ) : (
                                                                        day.tasks.map((t, i) => (
                                                                            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap', paddingTop: '0.1rem' }}>{t.time}</span>
                                                                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827' }}>{t.description}</p>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
