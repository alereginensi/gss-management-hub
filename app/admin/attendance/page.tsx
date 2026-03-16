'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useTicketContext } from '../../context/TicketContext';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { Calendar, Clock, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';

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

import { CLIENT_SECTOR_MAP, getAvailableClients, getSectorsForClient } from '../../config/clients';

export default function AttendancePage() {
    const { currentUser, isSidebarOpen, isMobile } = useTicketContext();
    const [attendance, setAttendance] = useState<Workday[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterLocation, setFilterLocation] = useState('');
    const [filterRubro, setFilterRubro] = useState('');
    const [filterSector, setFilterSector] = useState('');
    const [roles, setRoles] = useState<any[]>([]);

    const availableClients = getAvailableClients();

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
            // Total Horas (Col 6) -> Yellow (with dark text for visibility)
            const totalHoursCell = headerRow.getCell(6);
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
                to: { row: 1, column: 8 }
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

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'supervisor' && currentUser?.role !== 'jefe') {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Acceso denegado</div>;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '0.5rem' : '1rem'
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
                                            <th style={{ padding: '1rem' }}>Cliente</th>
                                            <th style={{ padding: '1rem' }}>Sector</th>
                                            <th style={{ padding: '1rem' }}><Clock size={14} style={{ marginRight: '0.4rem' }} /> Total Horas</th>
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
                                                        <td style={{ padding: '1rem', fontWeight: 700 }}>{day.totalHours} hs</td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: '0 auto' }}>
                                                                {day.tasks.length} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr style={{ backgroundColor: '#f9fafb' }}>
                                                            <td colSpan={6} style={{ padding: '1.5rem' }}>
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
