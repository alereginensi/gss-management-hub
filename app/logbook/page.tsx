'use client';

import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
    BookOpen,
    Plus,
    Download,
    Layout,
    X,
    Calendar,
    User,
    MapPin,
    FileText,
    Building2,
    CheckCircle2,
    Trash2
} from 'lucide-react';

interface Column {
    id: number;
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
    options: string[];
}

interface LogEntry {
    id: number;
    title: string;
    date: string;
    sector: string;
    supervisor: string;
    location: string;
    report: string;
    staff_member: string;
    uniform: string;
    extra_data: Record<string, any>;
}

// Fixed option lists
const SECTORS = ['Sector 1', 'Sector 2', 'Sector 3', 'Administración', 'Taller', 'Patio'];
const SUPERVISORS = ['Supervisor 1', 'Supervisor 2', 'Supervisor 3'];
const LOCATIONS = ['Planta 1', 'Planta 2', 'Sótano', 'Oficina Central', 'Almacén'];
const UNIFORMS = ['Completo', 'Parcial', 'Sin Uniforme', 'Otro'];

export default function LogbookPage() {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [columns, setColumns] = useState<Column[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showReportModal, setShowReportModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);

    // Form States
    const [newReport, setNewReport] = useState<Partial<LogEntry>>({
        title: '',
        date: new Date().toISOString().split('T')[0],
        sector: SECTORS[0],
        supervisor: SUPERVISORS[0],
        location: LOCATIONS[0],
        report: '',
        staff_member: '',
        uniform: UNIFORMS[0],
        extra_data: {}
    });

    const [newColumn, setNewColumn] = useState<Partial<Column>>({
        label: '',
        type: 'text',
        options: []
    });
    const [optionText, setOptionText] = useState('');

    // Inline Add State
    const [inlineData, setInlineData] = useState<Partial<LogEntry>>({
        title: '',
        date: new Date().toISOString().split('T')[0],
        sector: SECTORS[0],
        supervisor: SUPERVISORS[0],
        location: LOCATIONS[0],
        report: '',
        staff_member: '',
        uniform: UNIFORMS[0],
        extra_data: {}
    });

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/logbook');
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries);
                setColumns(data.columns);
                setSelectedIds(new Set()); // Reset selection on new data
            }
        } catch (error) {
            console.error('Error fetching logbook:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateReport = async (e: React.FormEvent | null, data: Partial<LogEntry>) => {
        if (e) e.preventDefault();
        try {
            const res = await fetch('/api/logbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                setShowReportModal(false);
                fetchData();
                const resetData = {
                    title: '',
                    date: new Date().toISOString().split('T')[0],
                    sector: SECTORS[0],
                    supervisor: SUPERVISORS[0],
                    location: LOCATIONS[0],
                    report: '',
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    extra_data: {}
                };
                setNewReport(resetData);
                setInlineData(resetData);
            }
        } catch (error) {
            console.error('Error creating report:', error);
        }
    };

    const handleCreateColumn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/logbook/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newColumn,
                    name: newColumn.label?.toLowerCase().replace(/\s+/g, '_')
                })
            });
            if (res.ok) {
                setShowColumnModal(false);
                fetchData();
                setNewColumn({ label: '', type: 'text', options: [] });
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (error) {
            console.error('Error creating column:', error);
        }
    };

    const handleDeleteColumn = async (name: string, label: string) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar la columna "${label}"?`)) return;

        try {
            const res = await fetch(`/api/logbook/columns?name=${name}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error deleting column:', error);
        }
    };

    const handleManage = async (action: 'clear_entries' | 'reset_all') => {
        const msg = action === 'clear_entries'
            ? '¿Estás seguro de que quieres borrar todos los datos de la tabla?'
            : '¿Estás seguro de que quieres borrar TODO (datos y columnas) y crear una nueva lista?';

        if (!confirm(msg)) return;

        try {
            const res = await fetch(`/api/logbook/manage?action=${action}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error managing logbook:', error);
        }
    };

    const toggleSelection = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === entries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.map(e => e.id)));
        }
    };

    const exportToExcel = async () => {
        const entriesToExport = selectedIds.size > 0
            ? entries.filter(e => selectedIds.has(e.id))
            : entries;

        if (entriesToExport.length === 0) {
            alert('Por favor selecciona al menos un reporte para exportar.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bitácora GSS');

        // Style constants
        const blueFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }; // Light Blue/Gray for ID
        const yellowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow for Title
        const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } }; // Green for Others

        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FF000000' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Define columns
        const excelCols = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Título', key: 'title', width: 30 },
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Sector', key: 'sector', width: 20 },
            { header: 'Supervisor', key: 'supervisor', width: 20 },
            { header: 'Lugar', key: 'location', width: 20 },
            { header: 'Uniforme', key: 'uniform', width: 20 },
            { header: 'Reporte', key: 'report', width: 50 },
            { header: 'Funcionario', key: 'staff_member', width: 20 },
        ];

        columns.forEach(col => {
            excelCols.push({ header: col.label, key: col.name, width: 20 });
        });

        worksheet.columns = excelCols;

        // Apply header styles and colors
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell, colNumber) => {
            cell.style = headerStyle;
            if (colNumber === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } }; // ID (Blueish)
            else if (colNumber === 2) cell.fill = yellowFill; // Título (Yellow)
            else cell.fill = greenFill; // Others (Green)
        });

        // Add data
        entriesToExport.forEach(entry => {
            const rowData: any = {
                id: entry.id,
                title: entry.title,
                date: entry.date,
                sector: entry.sector,
                supervisor: entry.supervisor,
                location: entry.location,
                uniform: entry.uniform,
                report: entry.report,
                staff_member: entry.staff_member,
                ...entry.extra_data
            };
            const row = worksheet.addRow(rowData);
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'top', wrapText: true };
            });
        });

        // Generate and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bitacora_GSS_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: '260px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <Header title="Bitácora - Supervisores" />
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleManage('clear_entries')} className="btn" style={{ fontSize: '0.8rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>Borrar Tabla</button>
                        <button onClick={() => handleManage('reset_all')} className="btn" style={{ fontSize: '0.8rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>Crear Nueva (Reset)</button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleManage('clear_entries')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
                            Vaciar Datos
                        </button>
                        <button onClick={() => handleManage('reset_all')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 'bold' }}>
                            Reiniciar TODO
                        </button>
                    </div>
                    <div style={{ flex: 1 }}></div>
                    <button onClick={exportToExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                        <Download size={18} />
                        Exportar Excel
                    </button>
                    <button onClick={() => setShowColumnModal(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)' }}>
                        <Layout size={18} />
                        Agregar columna
                    </button>
                    <button onClick={() => setShowReportModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} />
                        Nuevo Registro
                    </button>
                </div>

                <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={entries.length > 0 && selectedIds.size === entries.length}
                                        onChange={toggleAll}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Título</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Fecha</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Sector</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Supervisor</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Lugar</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Uniforme</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Reporte</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Funcionario</th>
                                {columns.map(col => (
                                    <th key={col.id} style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {col.label}
                                            <button
                                                onClick={() => handleDeleteColumn(col.name, col.label)}
                                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ef4444', opacity: 0.5, transition: 'opacity 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                                title="Eliminar columna"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                <th style={{ padding: '1rem' }}></th>
                            </tr>
                            {/* --- INLINE QUICK ADD ROW --- */}
                            <tr style={{ borderBottom: '2px solid var(--accent-color)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                                <td style={{ padding: '0.5rem' }}></td>
                                <td style={{ padding: '0.5rem' }}><input placeholder="Nuevo reporte..." value={inlineData.title} onChange={e => setInlineData({ ...inlineData, title: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                <td style={{ padding: '0.5rem' }}><input type="date" value={inlineData.date} onChange={e => setInlineData({ ...inlineData, date: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.sector} onChange={e => setInlineData({ ...inlineData, sector: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.supervisor} onChange={e => setInlineData({ ...inlineData, supervisor: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SUPERVISORS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.location} onChange={e => setInlineData({ ...inlineData, location: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.uniform} onChange={e => setInlineData({ ...inlineData, uniform: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}><input placeholder="Reporte..." value={inlineData.report} onChange={e => setInlineData({ ...inlineData, report: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                <td style={{ padding: '0.5rem' }}><input placeholder="Funcionario" value={inlineData.staff_member} onChange={e => setInlineData({ ...inlineData, staff_member: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                {columns.map(col => (
                                    <td key={col.id} style={{ padding: '0.5rem' }}>
                                        {col.type === 'select' ? (
                                            <select className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} onChange={e => setInlineData({ ...inlineData, extra_data: { ...inlineData.extra_data, [col.name]: e.target.value } })}>
                                                <option value="">...</option>
                                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input type={col.type} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} onChange={e => setInlineData({ ...inlineData, extra_data: { ...inlineData.extra_data, [col.name]: e.target.value } })} />
                                        )}
                                    </td>
                                ))}
                                <td style={{ padding: '0.5rem' }}>
                                    <button onClick={() => handleCreateReport(null as any, inlineData)} className="btn btn-primary" style={{ padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Plus size={16} />
                                    </button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={10 + columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <BookOpen size={48} opacity={0.2} />
                                            <p>Empieza a llenar tu Bitácora directamente arriba o usa el botón Nuevo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                entries.map(entry => (
                                    <tr key={entry.id} style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        fontSize: '0.9rem',
                                        backgroundColor: selectedIds.has(entry.id) ? 'rgba(59, 130, 246, 0.03)' : 'transparent'
                                    }}>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(entry.id)}
                                                onChange={() => toggleSelection(entry.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{entry.title}</td>
                                        <td style={{ padding: '1rem' }}>{entry.date}</td>
                                        <td style={{ padding: '1rem' }}>{entry.sector}</td>
                                        <td style={{ padding: '1rem' }}>{entry.supervisor}</td>
                                        <td style={{ padding: '1rem' }}>{entry.location}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444', border: '1px solid currentColor' }}>
                                                {entry.uniform}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', verticalAlign: 'top', whiteSpace: 'normal', lineBreak: 'anywhere', minWidth: '250px' }}>{entry.report}</td>
                                        <td style={{ padding: '1rem' }}>{entry.staff_member}</td>
                                        {columns.map(col => (
                                            <td key={col.id} style={{ padding: '1rem' }}>{entry.extra_data[col.name] || '-'}</td>
                                        ))}
                                        <td style={{ padding: '1rem' }}></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modal: Nuevo Reporte */}
                {showReportModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Nuevo Registro de Bitácora</h3>
                                <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <form onSubmit={(e) => handleCreateReport(e, newReport as LogEntry)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Título</label>
                                    <input required value={newReport.title} onChange={e => setNewReport({ ...newReport, title: e.target.value })} className="input" placeholder="Ej: Reporte Diario Mantenimiento" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Fecha</label>
                                        <input type="date" required value={newReport.date} onChange={e => setNewReport({ ...newReport, date: e.target.value })} className="input" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Sector</label>
                                        <select value={newReport.sector} onChange={e => setNewReport({ ...newReport, sector: e.target.value })} className="input" required>
                                            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Supervisor</label>
                                        <select value={newReport.supervisor} onChange={e => setNewReport({ ...newReport, supervisor: e.target.value })} className="input" required>
                                            {SUPERVISORS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Lugar</label>
                                        <select value={newReport.location} onChange={e => setNewReport({ ...newReport, location: e.target.value })} className="input" required>
                                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Uniforme</label>
                                        <select value={newReport.uniform} onChange={e => setNewReport({ ...newReport, uniform: e.target.value })} className="input" required>
                                            {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Funcionario / Personal</label>
                                        <input required value={newReport.staff_member} onChange={e => setNewReport({ ...newReport, staff_member: e.target.value })} className="input" />
                                    </div>
                                </div>

                                {/* Dynamic Fields */}
                                {columns.map(col => (
                                    <div key={col.id}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{col.label}</label>
                                        {col.type === 'select' ? (
                                            <select className="input" onChange={e => setNewReport({ ...newReport, extra_data: { ...newReport.extra_data, [col.name]: e.target.value } })}>
                                                <option value="">Seleccionar...</option>
                                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type={col.type}
                                                className="input"
                                                onChange={e => setNewReport({ ...newReport, extra_data: { ...newReport.extra_data, [col.name]: e.target.value } })}
                                            />
                                        )}
                                    </div>
                                ))}

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Reporte Detallado</label>
                                    <textarea required rows={4} value={newReport.report} onChange={e => setNewReport({ ...newReport, report: e.target.value })} className="input" style={{ resize: 'none' }}></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Guardar Registro</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Nueva Columna */}
                {showColumnModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="card" style={{ width: '400px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Agregar Columna</h3>
                                <button onClick={() => setShowColumnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nombre de la Columna</label>
                                    <input required value={newColumn.label} onChange={e => setNewColumn({ ...newColumn, label: e.target.value })} className="input" placeholder="Ej: Temperatura" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Tipo de Dato</label>
                                    <select className="input" value={newColumn.type} onChange={e => setNewColumn({ ...newColumn, type: e.target.value as any })}>
                                        <option value="text">Texto</option>
                                        <option value="number">Número</option>
                                        <option value="date">Fecha</option>
                                        <option value="select">Selección (Menú)</option>
                                    </select>
                                </div>

                                {newColumn.type === 'select' && (
                                    <div style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Opciones del Menú</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input value={optionText} onChange={e => setOptionText(e.target.value)} className="input" style={{ flex: 1 }} placeholder="Nueva opción..." />
                                            <button type="button" onClick={() => { if (optionText) { setNewColumn({ ...newColumn, options: [...(newColumn.options || []), optionText] }); setOptionText(''); } }} className="btn">Add</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {newColumn.options?.map(opt => (
                                                <span key={opt} style={{ backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>{opt}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Crear Columna</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
