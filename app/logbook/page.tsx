'use client';

import React, { useState, useEffect, useMemo } from 'react';
// exceljs imported dynamically to save bundle size
import type * as ExcelJS from 'exceljs';
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
    Trash2,
    Pencil,
    Save
} from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';

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
    incident: string;
    report: string;
    staff_member: string;
    uniform: string;
    supervised_by: string;
    extra_data: Record<string, any>;
}

interface ReportItem {
    sector: string; // Was location
    staff_member: string;
    uniform: string;
    incident: string;
    report: string;
    extra_data: Record<string, any>;
}

const SUPERVISO_OPTIONS = ['Limpieza', 'Seguridad Física', 'Seguridad Electrónica', 'Tercerizados', 'Administrativos'];
const UNIFORMS = ['Completo', 'Parcial', 'Sin Uniforme', 'Otro'];
const INCIDENT_CATEGORIES = [
    'Operativa',
    'Calidad',
    'Incidentes & Seguridad',
    'Recursos Humanos',
    'Materiales, Insumos & Equipos',
    'Infraestructura',
    'Comunicación & Coordinación',
    'Otros'
];

// Clientes y sectores extraídos del CSV (Cliente;Lugar)
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

export default function LogbookPage() {
    const { isSidebarOpen, currentUser } = useTicketContext();
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [columns, setColumns] = useState<Column[]>([]);
    const [loading, setLoading] = useState(true);
    const [funcionarios, setFuncionarios] = useState<string[]>([]);
    const [supervisores, setSupervisores] = useState<{ name: string, rubro: string }[]>([]);

    // Modals
    const [showReportModal, setShowReportModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<LogEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<LogEntry>>({});

    // Helpers using the static CSV-based CLIENT_SECTOR_MAP
    const getSectorsForLocation = (clientName: string): string[] => {
        if (!clientName) return [];
        const sectors = CLIENT_SECTOR_MAP[clientName];
        if (!sectors || sectors.length === 0) return ['Sector Único'];
        return sectors;
    };

    const availableLocations = Object.keys(CLIENT_SECTOR_MAP).sort();

    // Supervisors only see entries they personally supervised
    const visibleEntries = currentUser?.role === 'supervisor'
        ? entries.filter(e => e.supervised_by === currentUser.name)
        : entries;

    // Form States
    const [newReportHeader, setNewReportHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        location: '',
        sector: '',
        supervised_by: SUPERVISO_OPTIONS[0],
        supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
    });

    const [reportItems, setReportItems] = useState<ReportItem[]>([
        {
            sector: '',
            staff_member: '',
            uniform: UNIFORMS[0],
            incident: '',
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
        sector: '',
        location: '',
        supervised_by: SUPERVISO_OPTIONS[0],
        supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
        incident: '',
        report: '',
        staff_member: '',
        uniform: UNIFORMS[0],
        extra_data: {}
    });

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Mobile Check
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const rubroParam = currentUser?.role === 'supervisor' ? `&rubro=${encodeURIComponent(currentUser.rubro || '')}` : '';
            const [res, usersRes, supRes] = await Promise.all([
                fetch('/api/logbook'),
                fetch(`/api/admin/users?role=funcionario${rubroParam}`),
                fetch(`/api/admin/users?role=supervisor`)
            ]);

            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries);
                setColumns(data.columns);
                setSelectedIds(new Set());
            }
            if (usersRes.ok) {
                const users = await usersRes.json();
                setFuncionarios(users.map((u: any) => u.name));
            }
            if (supRes.ok) {
                const sups = await supRes.json();
                setSupervisores(sups.map((u: any) => ({ name: u.name, rubro: u.rubro })));
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

    const handleUpdateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReport) return;

        try {
            const res = await fetch('/api/logbook', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...selectedReport, ...editData, id: selectedReport.id })
            });

            if (res.ok) {
                setIsEditing(false);
                setSelectedReport({ ...selectedReport, ...editData } as LogEntry);
                fetchData();
            } else {
                alert('Error al actualizar el reporte');
            }
        } catch (error) {
            console.error('Error updating report:', error);
            alert('Error al actualizar el reporte');
        }
    };

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
                setNewReportHeader({
                    date: new Date().toISOString().split('T')[0],
                    location: '',
                    sector: '',
                    supervised_by: SUPERVISO_OPTIONS[0],
                    supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
                });
                setReportItems([{
                    sector: '',
                    staff_member: '',
                    uniform: UNIFORMS[0],
                    incident: '',
                    report: '',
                    extra_data: {}
                }]);

                setInlineData({
                    date: new Date().toISOString().split('T')[0],
                    location: '',
                    sector: '',
                    supervised_by: SUPERVISO_OPTIONS[0],
                    supervisor: currentUser?.role === 'supervisor' ? currentUser.name : '',
                    incident: '',
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
            const sectorA = a.sector || '';
            const sectorB = b.sector || '';
            if (sectorA !== sectorB) {
                return sectorA.localeCompare(sectorB);
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        const Excel = (await import('exceljs')).default;
        const workbook = new Excel.Workbook();
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
            { header: 'Tipo de Servicio', key: 'supervised_by', width: 15 }, // changed from Superviso
            { header: 'Responsable', key: 'supervisor', width: 20 }, // changed from Supervisor
            { header: 'Sector', key: 'sector', width: 20 },
            { header: 'Lugar', key: 'location', width: 20 },
            { header: 'Funcionario', key: 'staff_member', width: 20 },
            { header: 'Uniforme', key: 'uniform', width: 15 },
            { header: 'Incidencia', key: 'incident', width: 25 },
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
                incident: entry.incident,
                report: entry.report,
                ...entry.extra_data
            };
            const row = worksheet.addRow(rowData);

            // Apply sector color to the row
            row.eachCell(cell => {
                cell.border = {
                    top: { style: isNewSector ? 'medium' : 'thin' },
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

    // Prepare data for rendering (Sort and Color) - Optimized with useMemo
    const sortedEntries = useMemo(() => {
        return [...visibleEntries].sort((a, b) => {
            const sectorA = a.sector || '';
            const sectorB = b.sector || '';
            if (sectorA !== sectorB) {
                return sectorA.localeCompare(sectorB);
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [visibleEntries]);

    const sectorColorMap = useMemo(() => {
        const colors = [
            'rgba(59, 130, 246, 0.02)',  // Blue tint
            'rgba(16, 185, 129, 0.02)',  // Green tint
            'rgba(245, 158, 11, 0.02)',  // Orange tint
            'rgba(139, 92, 246, 0.02)',  // Purple tint
            'rgba(236, 72, 153, 0.02)'   // Pink tint
        ];
        const map: Record<string, string> = {};
        let colorIndex = 0;

        sortedEntries.forEach(entry => {
            if (!map[entry.sector]) {
                map[entry.sector] = colors[colorIndex % colors.length];
                colorIndex++;
            }
        });
        return map;
    }, [sortedEntries]);

    const updateReportItem = (index: number, field: keyof ReportItem, value: any) => {
        const newItems = [...reportItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setReportItems(newItems);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem'
            }}>
                <Header
                    title="Bitácora - Supervisores"
                    actions={
                        isMobile ? (
                            <button onClick={exportToExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                <Download size={16} />
                                <span>Exportar</span>
                            </button>
                        ) : undefined
                    }
                />

                <div className="desktop-toolbar">
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={handleDeleteSelected} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            Eliminar Fila(s)
                        </button>
                        <button onClick={() => handleManage('clear_entries')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            Vaciar Todo
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={exportToExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <Download size={18} />
                            Exportar Excel
                        </button>
                        <button onClick={() => setShowReportModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={18} />
                            Nuevo Reporte
                        </button>
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="card desktop-view" style={{ padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={visibleEntries.length > 0 && selectedIds.size === visibleEntries.length}
                                        onChange={toggleAll}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Fecha</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Tipo de Servicio</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Responsable</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Cliente</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Sector</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Funcionario</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Uniforme</th>
                                <th style={{ padding: '1rem', fontSize: '0.85rem' }}>Incidencia</th>
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
                                <td style={{ padding: '0.5rem' }}>
                                    <input type="date" value={inlineData.date} onChange={e => setInlineData({ ...inlineData, date: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.supervised_by} onChange={e => setInlineData({ ...inlineData, supervised_by: e.target.value, supervisor: '' })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {currentUser?.role === 'supervisor' ? (
                                        <input type="text" readOnly value={currentUser.name} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }} />
                                    ) : (
                                        <select
                                            value={inlineData.supervisor || ''}
                                            onChange={e => setInlineData({ ...inlineData, supervisor: e.target.value })}
                                            className="input"
                                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                        >
                                            <option value="">Seleccionar Responsable</option>
                                            {supervisores
                                                .filter(s => {
                                                    if (!inlineData.supervised_by || inlineData.supervised_by === 'Administrativos') return true;
                                                    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                                                    const target = normalize(inlineData.supervised_by);
                                                    const userRubros = s.rubro?.split(',').map(r => normalize(r.trim())) || [];
                                                    return userRubros.includes(target);
                                                })
                                                .map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                        </select>
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select
                                        value={inlineData.location}
                                        onChange={e => {
                                            const newLoc = e.target.value;
                                            const sectors = getSectorsForLocation(newLoc);
                                            setInlineData({
                                                ...inlineData,
                                                location: newLoc,
                                                sector: sectors[0] || ''
                                            });
                                        }}
                                        className="input"
                                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    >
                                        <option value="">Seleccionar Cliente</option>
                                        {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {(() => {
                                        const sectors = getSectorsForLocation(inlineData.location || '');
                                        return sectors.length === 1 && sectors[0] === 'Sector Único' ? (
                                            <input
                                                type="text"
                                                readOnly
                                                value="Sector Único"
                                                className="input"
                                                style={{ padding: '0.4rem', fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                                            />
                                        ) : (
                                            <select
                                                value={inlineData.sector}
                                                onChange={e => setInlineData({ ...inlineData, sector: e.target.value })}
                                                className="input"
                                                style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Seleccionar Sector</option>
                                                {sectors.map((s: string) => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Nombre del funcionario"
                                        value={inlineData.staff_member}
                                        onChange={e => setInlineData({ ...inlineData, staff_member: e.target.value })}
                                        className="input"
                                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select value={inlineData.uniform} onChange={e => setInlineData({ ...inlineData, uniform: e.target.value })} className="input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                                        {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <select
                                        value={inlineData.incident}
                                        onChange={e => setInlineData({ ...inlineData, incident: e.target.value })}
                                        className="input"
                                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {INCIDENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <textarea
                                        placeholder="Reporte..."
                                        value={inlineData.report}
                                        onChange={e => setInlineData({ ...inlineData, report: e.target.value })}
                                        className="input"
                                        rows={2}
                                        style={{ padding: '0.4rem', fontSize: '0.85rem', resize: 'vertical', minHeight: '60px' }}
                                    />
                                </td>
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
                                    <button
                                        onClick={() => {
                                            if (!inlineData.location || !inlineData.staff_member || !inlineData.report?.trim()) {
                                                alert('Completa al menos: Cliente, Funcionario y Reporte');
                                                return;
                                            }
                                            handleCreateReport(null, inlineData);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                    >
                                        Agregar
                                    </button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={11 + columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <BookOpen size={48} opacity={0.2} />
                                            <p>Empieza a llenar tu Bitácora directamente arriba o usa el botón Nuevo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedEntries.map((entry, index) => {
                                    const isNewSector = index === 0 || entry.sector !== sortedEntries[index - 1].sector;
                                    const sectorBgColor = sectorColorMap[entry.sector] || 'transparent';
                                    const rowBgColor = selectedIds.has(entry.id)
                                        ? 'rgba(59, 130, 246, 0.08)'
                                        : sectorBgColor;

                                    return (
                                        <React.Fragment key={entry.id}>
                                            {isNewSector && index > 0 && (
                                                <tr style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                                                    <td colSpan={11 + columns.length} style={{ padding: 0, borderTop: '2px solid var(--border-color)' }}></td>
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
                                                <td style={{ padding: '1rem' }}>{entry.supervisor || '-'}</td>
                                                <td style={{ padding: '1rem' }}>{entry.location}</td>
                                                <td style={{ padding: '1rem', fontWeight: isNewSector ? 600 : 400 }}>{entry.sector}</td>
                                                <td style={{ padding: '1rem' }}>{entry.staff_member}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444', border: '1px solid currentColor' }}>
                                                        {entry.uniform}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{entry.incident}</td>
                                                <td style={{ padding: '1rem', verticalAlign: 'top', whiteSpace: 'normal', lineBreak: 'anywhere', minWidth: '250px' }}>{entry.report}</td>
                                                {columns.map(col => (
                                                    <td key={col.id} style={{ padding: '1rem' }}>{entry.extra_data[col.name] || '-'}</td>
                                                ))}
                                                <td style={{ padding: '1rem' }}></td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View (Compact) */}
                <div className="mobile-view">
                    {visibleEntries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            <BookOpen size={48} opacity={0.2} />
                            <p style={{ marginTop: '1rem' }}>No hay registros. Usa el botón + para agregar uno.</p>
                        </div>
                    ) : (
                        sortedEntries.map((entry) => (
                            <div key={entry.id} className="logbook-card" style={{
                                borderLeft: `4px solid ${sectorColorMap[entry.sector]?.replace('0.02', '0.6') || 'var(--border-color)'}`,
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                backgroundColor: 'var(--surface-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {entry.date} • {entry.sector}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {entry.location}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '20px',
                                        backgroundColor: entry.uniform === 'Completo' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: entry.uniform === 'Completo' ? '#22c55e' : '#ef4444',
                                        fontWeight: 600,
                                        border: '1px solid currentColor'
                                    }}>
                                        {entry.uniform}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <div>
                                        <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>Responsable</span>
                                        <strong>{entry.supervisor || '-'}</strong>
                                    </div>
                                    <div>
                                        <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>Personal</span>
                                        <strong>{entry.staff_member}</strong>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                                        {entry.incident || 'Sin incidencia'}
                                    </div>
                                    <button
                                        onClick={() => setSelectedReport(entry)}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '8px' }}
                                    >
                                        Ver Detalles
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* FAB for Mobile */}
                <button className="fab mobile-view" onClick={() => setShowReportModal(true)} aria-label="Nuevo Reporte">
                    <Plus size={24} />
                </button>

                {/* Modal: Nuevo Reporte */}
                {
                    showReportModal && (
                        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                            <div className="card modal-responsive" style={{ width: '1000px', maxWidth: '95vw', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
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
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Tipo de Servicio</label>
                                                <select value={newReportHeader.supervised_by} onChange={e => setNewReportHeader({ ...newReportHeader, supervised_by: e.target.value, supervisor: '' })} className="input" required>
                                                    {SUPERVISO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Responsable</label>
                                                {currentUser?.role === 'supervisor' ? (
                                                    <input type="text" readOnly value={currentUser.name} className="input" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }} />
                                                ) : (
                                                    <select
                                                        value={newReportHeader.supervisor || ''}
                                                        onChange={e => setNewReportHeader({ ...newReportHeader, supervisor: e.target.value })}
                                                        className="input"
                                                        required
                                                    >
                                                        <option value="">Seleccionar Responsable</option>
                                                        {supervisores
                                                            .filter(s => {
                                                                if (!newReportHeader.supervised_by || newReportHeader.supervised_by === 'Administrativos') return true;
                                                                const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                                                                const target = normalize(newReportHeader.supervised_by);
                                                                const userRubros = s.rubro?.split(',').map(r => normalize(r.trim())) || [];
                                                                return userRubros.includes(target);
                                                            })
                                                            .map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Cliente</label>
                                                <select
                                                    value={newReportHeader.location}
                                                    onChange={e => {
                                                        const newLoc = e.target.value;
                                                        const sectors = getSectorsForLocation(newLoc);
                                                        setNewReportHeader({
                                                            ...newReportHeader,
                                                            location: newLoc,
                                                            sector: sectors[0] || ''
                                                        });
                                                        const newItems = reportItems.map(item => ({
                                                            ...item,
                                                            sector: sectors[0] || ''
                                                        }));
                                                        setReportItems(newItems);
                                                    }}
                                                    className="input"
                                                    required
                                                >
                                                    <option value="">Seleccionar Cliente</option>
                                                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sectores y Novedades</h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sectors = getSectorsForLocation(newReportHeader.location);
                                                    setReportItems([...reportItems, { sector: sectors[0] || '', staff_member: '', uniform: UNIFORMS[0], incident: '', report: '', extra_data: {} }]);
                                                }}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                            >
                                                <Plus size={14} /> Añadir Lugar
                                            </button>
                                        </div>

                                        {reportItems.map((item, idx) => (
                                            <div key={idx} style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem', position: 'relative', backgroundColor: 'var(--surface-color)' }}>
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

                                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Lugar</label>
                                                        {(() => {
                                                            const sectors = getSectorsForLocation(newReportHeader.location);
                                                            return sectors.length === 1 && sectors[0] === 'Sector Único' ? (
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value="Sector Único"
                                                                    className="input"
                                                                    style={{ width: '100%', padding: '0.6rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                                                                />
                                                            ) : (
                                                                <select
                                                                    required
                                                                    value={item.sector}
                                                                    onChange={e => updateReportItem(idx, 'sector', e.target.value)}
                                                                    className="input"
                                                                    style={{ width: '100%', padding: '0.6rem' }}
                                                                >
                                                                    <option value="">Seleccionar Sector</option>
                                                                    {sectors.map((s: string) => (
                                                                        <option key={s} value={s}>{s}</option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Funcionario / Personal</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="Escribir nombre del funcionario"
                                                            value={item.staff_member}
                                                            onChange={e => updateReportItem(idx, 'staff_member', e.target.value)}
                                                            className="input"
                                                            style={{ width: '100%', padding: '0.6rem' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Uniforme</label>
                                                        <select
                                                            value={item.uniform}
                                                            onChange={e => updateReportItem(idx, 'uniform', e.target.value)}
                                                            className="input"
                                                            required
                                                        >
                                                            {UNIFORMS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Incidencia</label>
                                                        <select
                                                            required
                                                            value={item.incident}
                                                            onChange={e => updateReportItem(idx, 'incident', e.target.value)}
                                                            className="input"
                                                            style={{ width: '100%', padding: '0.6rem' }}
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {INCIDENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                    </div>
                                                    <div style={{ gridColumn: '1 / -1' }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', opacity: 0.6 }}>Reporte / Novedad</label>
                                                        <textarea
                                                            required
                                                            value={item.report}
                                                            onChange={e => updateReportItem(idx, 'report', e.target.value)}
                                                            className="input"
                                                            rows={4}
                                                            style={{ resize: 'vertical', minHeight: isMobile ? '120px' : '90px', lineHeight: '1.5', width: '100%' }}
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
                                                                            const newData = { ...item.extra_data, [col.name]: e.target.value };
                                                                            updateReportItem(idx, 'extra_data', newData);
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
                                                                            const newData = { ...item.extra_data, [col.name]: e.target.value };
                                                                            updateReportItem(idx, 'extra_data', newData);
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
                                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Guardar Reporte</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Modal: Nueva Columna */}
                {showColumnModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Nueva Columna</h3>
                                <button onClick={() => setShowColumnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre</label>
                                    <input value={newColumn.label} onChange={e => setNewColumn({ ...newColumn, label: e.target.value })} className="input" placeholder="Ej: Kilometraje" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo</label>
                                    <select className="input" value={newColumn.type} onChange={e => setNewColumn({ ...newColumn, type: e.target.value as any })}>
                                        <option value="text">Texto</option>
                                        <option value="number">Número</option>
                                        <option value="date">Fecha</option>
                                        <option value="select">Lista Desplegable</option>
                                    </select>
                                </div>
                                {newColumn.type === 'select' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Opciones</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input value={optionText} onChange={e => setOptionText(e.target.value)} className="input" placeholder="Nueva opción..." />
                                            <button type="button" onClick={() => { if (optionText) { setNewColumn({ ...newColumn, options: [...(newColumn.options || []), optionText] }); setOptionText(''); } }} className="btn btn-secondary">Añadir</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {newColumn.options?.map(opt => (
                                                <span key={opt} style={{ padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {opt}
                                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setNewColumn({ ...newColumn, options: newColumn.options?.filter(o => o !== opt) })} />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button onClick={() => setShowColumnModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                    <button onClick={handleCreateColumn} className="btn btn-primary" style={{ flex: 1 }}>Crear</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW/EDIT MODAL */}
                {selectedReport && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Detalles del Reporte</h2>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedReport.date} - {selectedReport.sector}</div>
                                </div>
                                <button onClick={() => setSelectedReport(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}><X size={20} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Cliente</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.location}</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Supervisor</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.supervisor}</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Funcionario</label>
                                    <div style={{ fontWeight: 500 }}>{selectedReport.staff_member || 'No asignado'}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Incidencia</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.incident || '-'}</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Uniforme</label>
                                        <div style={{ fontWeight: 500 }}>{selectedReport.uniform}</div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Reporte / Detalle</label>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                        {selectedReport.report}
                                    </div>
                                </div>

                                {columns.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {columns.map(col => (
                                            <div key={col.id}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>{col.label}</label>
                                                <div style={{ fontWeight: 500 }}>{selectedReport.extra_data[col.name] || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={async () => {
                                        if (confirm('¿Eliminar este reporte permanentemente?')) {
                                            try {
                                                const res = await fetch('/api/logbook/delete', {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ ids: [selectedReport.id] })
                                                });
                                                if (res.ok) {
                                                    setSelectedReport(null);
                                                    fetchData();
                                                } else {
                                                    alert('Error al eliminar');
                                                }
                                            } catch (error) {
                                                console.error('Error deleting report:', error);
                                                alert('Error al eliminar');
                                            }
                                        }
                                    }}
                                    className="btn"
                                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                >
                                    <Trash2 size={18} /> Eliminar
                                </button>
                                <button onClick={() => setSelectedReport(null)} className="btn btn-primary" style={{ flex: 2 }}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
