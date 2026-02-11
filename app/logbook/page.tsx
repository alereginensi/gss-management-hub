'use client';

import React, { useState, useEffect } from 'react';
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
    ClipboardList,
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
    date: string;
    sector: string;
    supervisor: string;
    location: string;
    report: string;
    staff_member: string;
    uniform: string;
    supervised_by: string;
    extra_data: Record<string, any>;
}

interface ReportItem {
    location: string;
    staff_member: string;
    uniform: string;
    report: string;
    extra_data: Record<string, any>;
}

// Fixed option lists
const SUPERVISO_OPTIONS = ['GSS', 'Cliente', 'Otro'];
const SUPERVISORS = ['Supervisor A', 'Supervisor B', 'Supervisor C'];
const SECTOR_MAPPING: Record<string, string[]> = {
    'Sector Norte': ['Puerta 1', 'Puerta 2', 'Estacionamiento A'],
    'Sector Sur': ['Recepción', 'Muelle de Carga', 'Depósito 3'],
    'Administración': ['Oficina 101', 'Sala de Juntas', 'Archivo'],
    'Taller': ['Zona A', 'Zona B', 'Pañol'],
    'Patio': ['Perímetro', 'Garita', 'Entrada Principal']
};
const SECTORS = Object.keys(SECTOR_MAPPING);
const UNIFORMS = ['Completo', 'Parcial', 'Sin Uniforme', 'Otro'];

export default function LogbookPage() {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [columns, setColumns] = useState<Column[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showReportModal, setShowReportModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);

    // Form States
    const [newReportHeader, setNewReportHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        sector: SECTORS[0],
        supervisor: SUPERVISORS[0],
        supervised_by: SUPERVISO_OPTIONS[0],
    });

    const [reportItems, setReportItems] = useState<ReportItem[]>([
        {
            location: SECTOR_MAPPING[SECTORS[0]][0],
            staff_member: '',
            uniform: UNIFORMS[0],
            report: '',
            extra_data: {}
        }
    ]);

    const [newColumn, setNewColumn] = useState<Partial<Column>>({
        label: '',
        type: 'text',
        options: []
    });
    const [optionText, setOptionText] = useState('');

    // Inline Add State
    const [inlineData, setInlineData] = useState<Partial<LogEntry>>({
        date: new Date().toISOString().split('T')[0],
        sector: SECTORS[0],
        supervisor: SUPERVISORS[0],
        supervised_by: SUPERVISO_OPTIONS[0],
        location: SECTOR_MAPPING[SECTORS[0]][0],
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

    const handleCreateReport = async (e: React.FormEvent | null, data: any) => {
        if (e) e.preventDefault();

        let payload;
        if (Array.isArray(data)) {
            // Batch report from modal
            payload = data.map(item => ({
                ...newReportHeader,
                ...item
            }));
        } else {
            // Single report from inline add
            payload = [data];
        }

        try {
            const res = await fetch('/api/logbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowReportModal(false);
                fetchData();

                // Reset states
                const defaultSector = SECTORS[0];
                setNewReportHeader({
                    date: new Date().toISOString().split('T')[0],
                    sector: defaultSector,
                    supervisor: SUPERVISORS[0],
                    supervised_by: SUPERVISO_OPTIONS[0],
                });
                setReportItems([{
                    location: SECTOR_MAPPING[defaultSector][0],
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    report: '',
                    extra_data: {}
                }]);

                // For inline add, preserve the current sector selection
                const currentSector = Array.isArray(data) ? defaultSector : data.sector;
                setInlineData({
                    date: new Date().toISOString().split('T')[0],
                    sector: currentSector,
                    supervisor: SUPERVISORS[0],
                    supervised_by: SUPERVISO_OPTIONS[0],
                    location: SECTOR_MAPPING[currentSector][0],
                    report: '',
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    extra_data: {}
                });
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

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Debes seleccionar una o más filas para eliminar');
            return;
        }

        const count = selectedIds.size;
        const msg = count === 1
            ? '¿Estás seguro de que quieres eliminar esta fila?'
            : `¿Estás seguro de que quieres eliminar ${count} filas?`;

        if (!confirm(msg)) return;

        try {
            const idsArray = Array.from(selectedIds);
            const res = await fetch('/api/logbook/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsArray })
            });

            if (res.ok) {
                setSelectedIds(new Set());
                fetchData();
            } else {
                alert('Error al eliminar las filas seleccionadas');
            }
        } catch (error) {
            console.error('Error deleting selected rows:', error);
            alert('Error al eliminar las filas seleccionadas');
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

        // Sort entries by sector first, then by date (newest first)
        const sortedEntries = [...entriesToExport].sort((a, b) => {
            if (a.sector !== b.sector) {
                return a.sector.localeCompare(b.sector);
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bitácora GSS');

        const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
        const sectorHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

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

        const sectorHeaderStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 12, color: { argb: 'FF000000' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            fill: sectorHeaderFill,
            border: {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const excelCols = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Superviso', key: 'supervised_by', width: 15 },
            { header: 'Supervisor', key: 'supervisor', width: 20 },
            { header: 'Sector', key: 'sector', width: 20 },
            { header: 'Lugar', key: 'location', width: 20 },
            { header: 'Funcionario', key: 'staff_member', width: 20 },
            { header: 'Uniforme', key: 'uniform', width: 15 },
            { header: 'Reporte', key: 'report', width: 50 },
        ];

        columns.forEach(col => {
            excelCols.push({ header: col.label, key: col.name, width: 20 });
        });

        worksheet.columns = excelCols;

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell, colNumber) => {
            cell.style = headerStyle;
            if (colNumber === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } };
            else cell.fill = greenFill;
        });

        let currentSector = '';
        const sectorColors = [
            { argb: 'FFE3F2FD' },  // Light Blue
            { argb: 'FFE8F5E9' },  // Light Green
            { argb: 'FFFFF3E0' },  // Light Orange
            { argb: 'FFF3E5F5' },  // Light Purple
            { argb: 'FFFCE4EC' }   // Light Pink
        ];
        const sectorColorMap: Record<string, { argb: string }> = {};
        let colorIndex = 0;

        sortedEntries.forEach((entry, index) => {
            const isNewSector = entry.sector !== currentSector;

            if (isNewSector) {
                currentSector = entry.sector;

                // Assign color to sector if not already assigned
                if (!sectorColorMap[entry.sector]) {
                    sectorColorMap[entry.sector] = sectorColors[colorIndex % sectorColors.length];
                    colorIndex++;
                }

                // Add sector header row
                const sectorHeaderRow = worksheet.addRow([`SECTOR: ${entry.sector}`]);
                sectorHeaderRow.height = 25;
                sectorHeaderRow.eachCell((cell, colNumber) => {
                    if (colNumber === 1) {
                        cell.style = sectorHeaderStyle;
                    }
                });
                worksheet.mergeCells(sectorHeaderRow.number, 1, sectorHeaderRow.number, excelCols.length);
            }

            const rowData: any = {
                id: entry.id,
                date: entry.date,
                supervised_by: entry.supervised_by,
                supervisor: entry.supervisor,
                sector: entry.sector,
                location: entry.location,
                staff_member: entry.staff_member,
                uniform: entry.uniform,
                report: entry.report,
                ...entry.extra_data
            };
            const row = worksheet.addRow(rowData);

            // Apply sector color to the row
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: sectorColorMap[entry.sector] };
            });
        });

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
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleDeleteSelected} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
                            Eliminar Fila(s)
                        </button>
                        <button onClick={() => handleManage('clear_entries')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 'bold' }}>
                            Vaciar Todo
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
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Fecha</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Superviso</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Supervisor</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Sector</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Lugar</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Funcionario</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Uniforme</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Reporte</th>
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
                            <tr style={{ borderBottom: '2px solid var(--accent-color)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                                <td style={{ padding: '0.5rem' }}></td>
                                <td style={{ padding: '0.5rem' }}><input type="date" value={inlineData.date} onChange={e => setInlineData({ ...inlineData, date: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.supervised_by} onChange={e => setInlineData({ ...inlineData, supervised_by: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.supervisor} onChange={e => setInlineData({ ...inlineData, supervisor: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SUPERVISORS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select
                                        value={inlineData.sector}
                                        onChange={e => {
                                            const newSector = e.target.value;
                                            setInlineData({
                                                ...inlineData,
                                                sector: newSector,
                                                location: SECTOR_MAPPING[newSector] ? SECTOR_MAPPING[newSector][0] : ''
                                            });
                                        }}
                                        className="input"
                                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    >
                                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.location} onChange={e => setInlineData({ ...inlineData, location: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SECTOR_MAPPING[inlineData.sector || SECTORS[0]]?.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}><input placeholder="Funcionario" value={inlineData.staff_member} onChange={e => setInlineData({ ...inlineData, staff_member: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.uniform} onChange={e => setInlineData({ ...inlineData, uniform: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}><input placeholder="Reporte..." value={inlineData.report} onChange={e => setInlineData({ ...inlineData, report: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} /></td>
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
                                    <button onClick={() => handleCreateReport(null, inlineData)} className="btn btn-primary" style={{ padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                (() => {
                                    // Sort entries by sector first, then by date (newest first)
                                    const sortedEntries = [...entries].sort((a, b) => {
                                        if (a.sector !== b.sector) {
                                            return a.sector.localeCompare(b.sector);
                                        }
                                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                                    });

                                    let currentSector = '';
                                    const sectorColors = [
                                        'rgba(59, 130, 246, 0.02)',  // Blue tint
                                        'rgba(16, 185, 129, 0.02)',  // Green tint
                                        'rgba(245, 158, 11, 0.02)',  // Orange tint
                                        'rgba(139, 92, 246, 0.02)',  // Purple tint
                                        'rgba(236, 72, 153, 0.02)'   // Pink tint
                                    ];
                                    const sectorColorMap: Record<string, string> = {};
                                    let colorIndex = 0;

                                    return sortedEntries.map((entry, index) => {
                                        const isNewSector = entry.sector !== currentSector;

                                        if (isNewSector) {
                                            currentSector = entry.sector;
                                            if (!sectorColorMap[entry.sector]) {
                                                sectorColorMap[entry.sector] = sectorColors[colorIndex % sectorColors.length];
                                                colorIndex++;
                                            }
                                        }

                                        const sectorBgColor = sectorColorMap[entry.sector] || 'transparent';
                                        const rowBgColor = selectedIds.has(entry.id)
                                            ? 'rgba(59, 130, 246, 0.08)'
                                            : sectorBgColor;

                                        return (
                                            <React.Fragment key={entry.id}>
                                                {isNewSector && index > 0 && (
                                                    <tr style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                                                        <td colSpan={10 + columns.length} style={{ padding: 0, borderTop: '2px solid var(--border-color)' }}></td>
                                                    </tr>
                                                )}
                                                <tr style={{
                                                    borderBottom: '1px solid var(--border-color)',
                                                    fontSize: '0.9rem',
                                                    backgroundColor: rowBgColor,
                                                    borderLeft: isNewSector ? `3px solid ${sectorColorMap[entry.sector].replace('0.02', '0.4')}` : 'none'
                                                }}>
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(entry.id)}
                                                            onChange={() => toggleSelection(entry.id)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>{entry.date}</td>
                                                    <td style={{ padding: '1rem' }}>{entry.supervised_by}</td>
                                                    <td style={{ padding: '1rem' }}>{entry.supervisor}</td>
                                                    <td style={{ padding: '1rem', fontWeight: isNewSector ? 600 : 400 }}>{entry.sector}</td>
                                                    <td style={{ padding: '1rem' }}>{entry.location}</td>
                                                    <td style={{ padding: '1rem' }}>{entry.staff_member}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444', border: '1px solid currentColor' }}>
                                                            {entry.uniform}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem', verticalAlign: 'top', whiteSpace: 'normal', lineBreak: 'anywhere', minWidth: '250px' }}>{entry.report}</td>
                                                    {columns.map(col => (
                                                        <td key={col.id} style={{ padding: '1rem' }}>{entry.extra_data[col.name] || '-'}</td>
                                                    ))}
                                                    <td style={{ padding: '1rem' }}></td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modal: Nuevo Reporte */}
                {showReportModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '1000px', maxWidth: '95vw', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                            <button onClick={() => setShowReportModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', opacity: 0.5 }}><X size={24} /></button>

                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <ClipboardList className="accent-text" />
                                Nuevo Reporte por Sector
                            </h2>

                            <form onSubmit={(e) => handleCreateReport(e, reportItems)}>
                                <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos Generales</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Fecha</label>
                                            <input type="date" required value={newReportHeader.date} onChange={e => setNewReportHeader({ ...newReportHeader, date: e.target.value })} className="input" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Superviso</label>
                                            <select value={newReportHeader.supervised_by} onChange={e => setNewReportHeader({ ...newReportHeader, supervised_by: e.target.value })} className="input" required>
                                                {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Supervisor</label>
                                            <select value={newReportHeader.supervisor} onChange={e => setNewReportHeader({ ...newReportHeader, supervisor: e.target.value })} className="input" required>
                                                {SUPERVISORS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Sector</label>
                                            <select
                                                value={newReportHeader.sector}
                                                onChange={e => {
                                                    const newSector = e.target.value;
                                                    setNewReportHeader({
                                                        ...newReportHeader,
                                                        sector: newSector
                                                    });
                                                    setReportItems(reportItems.map(item => ({
                                                        ...item,
                                                        location: SECTOR_MAPPING[newSector][0]
                                                    })));
                                                }}
                                                className="input"
                                                required
                                            >
                                                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ fontSize: '0.9rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lugares y Novedades</h3>
                                        <button
                                            type="button"
                                            onClick={() => setReportItems([...reportItems, { location: SECTOR_MAPPING[newReportHeader.sector][0], staff_member: '', uniform: UNIFORMS[0], report: '', extra_data: {} }])}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        >
                                            <Plus size={14} /> Añadir Lugar
                                        </button>
                                    </div>

                                    {reportItems.map((item, idx) => (
                                        <div key={idx} style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem', position: 'relative', backgroundColor: 'white' }}>
                                            {reportItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setReportItems(reportItems.filter((_, i) => i !== idx))}
                                                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}
                                                    title="Quitar lugar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 150px 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Lugar</label>
                                                    <select
                                                        value={item.location}
                                                        onChange={e => {
                                                            const newItems = [...reportItems];
                                                            newItems[idx].location = e.target.value;
                                                            setReportItems(newItems);
                                                        }}
                                                        className="input"
                                                        required
                                                    >
                                                        {SECTOR_MAPPING[newReportHeader.sector].map(l => <option key={l} value={l}>{l}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Funcionario / Personal</label>
                                                    <input
                                                        required
                                                        value={item.staff_member}
                                                        onChange={e => {
                                                            const newItems = [...reportItems];
                                                            newItems[idx].staff_member = e.target.value;
                                                            setReportItems(newItems);
                                                        }}
                                                        className="input"
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Uniforme</label>
                                                    <select
                                                        value={item.uniform}
                                                        onChange={e => {
                                                            const newItems = [...reportItems];
                                                            newItems[idx].uniform = e.target.value;
                                                            setReportItems(newItems);
                                                        }}
                                                        className="input"
                                                        required
                                                    >
                                                        {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Reporte / Novedad</label>
                                                    <input
                                                        required
                                                        value={item.report}
                                                        onChange={e => {
                                                            const newItems = [...reportItems];
                                                            newItems[idx].report = e.target.value;
                                                            setReportItems(newItems);
                                                        }}
                                                        className="input"
                                                    />
                                                </div>
                                            </div>

                                            {columns.length > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    {columns.map(col => (
                                                        <div key={col.id}>
                                                            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>{col.label}</label>
                                                            {col.type === 'select' ? (
                                                                <select
                                                                    className="input"
                                                                    value={item.extra_data[col.name] || ''}
                                                                    onChange={e => {
                                                                        const newItems = [...reportItems];
                                                                        newItems[idx].extra_data = { ...newItems[idx].extra_data, [col.name]: e.target.value };
                                                                        setReportItems(newItems);
                                                                    }}
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type={col.type}
                                                                    className="input"
                                                                    value={item.extra_data[col.name] || ''}
                                                                    onChange={e => {
                                                                        const newItems = [...reportItems];
                                                                        newItems[idx].extra_data = { ...newItems[idx].extra_data, [col.name]: e.target.value };
                                                                        setReportItems(newItems);
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                    <button type="button" onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Guardar Reporte de Sector</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Nueva Columna */}
                {showColumnModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '400px', maxWidth: '90vw' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Agregar Columna Personalizada</h3>
                                <button onClick={() => setShowColumnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre de la Columna</label>
                                    <input required value={newColumn.label} onChange={e => setNewColumn({ ...newColumn, label: e.target.value })} className="input" placeholder="Ej: Temperatura" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo de Dato</label>
                                    <select className="input" value={newColumn.type} onChange={e => setNewColumn({ ...newColumn, type: e.target.value as any })}>
                                        <option value="text">Texto</option>
                                        <option value="number">Número</option>
                                        <option value="date">Fecha</option>
                                        <option value="select">Selección (Menú)</option>
                                    </select>
                                </div>

                                {newColumn.type === 'select' && (
                                    <div style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Opciones del Menú</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <input value={optionText} onChange={e => setOptionText(e.target.value)} className="input" style={{ flex: 1 }} placeholder="Nueva opción..." />
                                            <button type="button" onClick={() => { if (optionText) { setNewColumn({ ...newColumn, options: [...(newColumn.options || []), optionText] }); setOptionText(''); } }} className="btn btn-secondary">Añadir</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {newColumn.options?.map(opt => (
                                                <span key={opt} style={{ backgroundColor: 'white', padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {opt}
                                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setNewColumn({ ...newColumn, options: newColumn.options?.filter(o => o !== opt) })} />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowColumnModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Columna</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
