'use client'; 

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, FileText, Plus, Save,
    Trash2, PenTool, CheckCircle2,
    ChevronDown, ChevronUp, Printer, LogOut,
} from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import SignaturePad from '@/app/components/SignaturePad';

interface Funcionario {
    id: number;
    nombre: string;
    cedula: string;
    email: string;
    cliente?: string;
}

interface AsistenciaRow {
    id?: number;
    puesto?: string;
    funcionario_id: number | null;
    nombre: string;
    cedula: string;
    cliente: string;
    entrada1: string;
    salida1: string;
    entrada2: string;
    salida2: string;
    firma: string | null;
    isSaved?: boolean;
}

interface SeccionesAsistencia {
    [key: string]: AsistenciaRow[];
}

const TURNOS = ['6 A 14', '14 A 22', '22 A 06'];
const SECCIONES = ['6 A 14', '12 A 20', '14 A 22', '15 A 23', '22 A 06', 'HEMOTERAPIA', 'ADICIONALES'];

const SECTORES_POR_CLIENTE: Record<string, string[]> = {
    'CASMU': ['Asilo', 'Pisos Vip', 'Torre 1', 'Torre 2', 'Roperia', 'Policlinico'],
};

function getSectoresForCliente(cliente: string): string[] {
    const key = Object.keys(SECTORES_POR_CLIENTE).find(
        k => k.toLowerCase() === cliente.toLowerCase()
    );
    return key ? SECTORES_POR_CLIENTE[key] : [];
}

interface PuestoConfig { nombre: string; cantidad: number; }
interface TurnoConfig { puestos: PuestoConfig[]; }

const PLANILLA_CONFIG: Record<string, Record<string, TurnoConfig>> = {
    'Asilo': {
        '6 A 14': {
            puestos: [
                { nombre: 'ENCARGADO', cantidad: 1 },
                { nombre: 'ASILO', cantidad: 5 },
                { nombre: 'VIDRIERO', cantidad: 1 },
                { nombre: 'MOVILES', cantidad: 1 },
                { nombre: 'LOCAL 8', cantidad: 1 },
                { nombre: 'CONTAC CENTER', cantidad: 1 },
                { nombre: 'ALMACENES', cantidad: 1 },
                { nombre: 'DESPENSA', cantidad: 1 },
                { nombre: 'MEDICAMENTOS', cantidad: 1 },
            ]
        },
        '14 A 22': {
            puestos: [
                { nombre: 'ENCARGADO', cantidad: 1 },
                { nombre: 'ASILO', cantidad: 4 },
                { nombre: 'CONTAC CENTER', cantidad: 1 },
                { nombre: 'LOCAL 8', cantidad: 1 },
                { nombre: 'MOVILES', cantidad: 1 },
            ]
        }
    },
    'Roperia': {
        '6 A 14':  { puestos: [] },
        '12 A 20': { puestos: [] },
        '15 A 23': { puestos: [] },
    },
    'Torre 2': {
        '6 A 14': {
            puestos: [
                { nombre: 'ENCARGADO/A',        cantidad: 1 },
                { nombre: 'URG-GINE',           cantidad: 1 },
                { nombre: 'URG-PEDIATRICA',     cantidad: 1 },
                { nombre: 'ADICIONAL SERVICIO', cantidad: 1 },
                { nombre: '1B',                 cantidad: 1 },
                { nombre: '2B',                 cantidad: 1 },
                { nombre: '2C',                 cantidad: 1 },
                { nombre: '3C',                 cantidad: 1 },
                { nombre: '5º MATTER',          cantidad: 1 },
                { nombre: 'PLANTA',             cantidad: 1 },
                { nombre: 'ABREU',              cantidad: 1 },
                { nombre: 'C.MEDICO',           cantidad: 1 },
                { nombre: 'PEON',               cantidad: 3 },
                { nombre: 'SOE',                cantidad: 1 },
                { nombre: 'COMPACTADORA',       cantidad: 1 },
                { nombre: 'VIDRIERO',           cantidad: 1 },
            ]
        },
        '14 A 22': {
            puestos: [
                { nombre: 'ENCARGADO/A',    cantidad: 1 },
                { nombre: 'URG-GINE',       cantidad: 1 },
                { nombre: 'URG-PEDIATRICA', cantidad: 1 },
                { nombre: '1B',             cantidad: 1 },
                { nombre: '2B',             cantidad: 1 },
                { nombre: '2C',             cantidad: 1 },
                { nombre: '3C',             cantidad: 1 },
                { nombre: '5º MATTER',      cantidad: 1 },
                { nombre: 'ABREU',          cantidad: 1 },
                { nombre: 'PLANTA',         cantidad: 1 },
                { nombre: 'PEON',           cantidad: 2 },
                { nombre: 'SOE',            cantidad: 1 },
                { nombre: 'COMPACTADORA',   cantidad: 1 },
            ]
        },
        '22 A 06': {
            puestos: [
                { nombre: 'ENCARGADO/A',    cantidad: 1 },
                { nombre: 'URG-GINE',       cantidad: 1 },
                { nombre: 'URG-PEDIATRICA', cantidad: 1 },
                { nombre: '1B',             cantidad: 1 },
                { nombre: '2B',             cantidad: 1 },
                { nombre: '2C',             cantidad: 1 },
                { nombre: '3C',             cantidad: 1 },
                { nombre: '5º MATTER',      cantidad: 1 },
                { nombre: 'PEON',           cantidad: 1 },
                { nombre: 'COMPACTADORA',   cantidad: 1 },
            ]
        }
    },
    'Policlinico': {
        '6 A 14': {
            puestos: [
                { nombre: 'ENC',      cantidad: 1 },
                { nombre: '2DO',      cantidad: 1 },
                { nombre: 'P BAJA',   cantidad: 1 },
                { nombre: 'FISIATRIA',cantidad: 1 },
                { nombre: 'OFTA',     cantidad: 1 },
                { nombre: 'UROLOGIA', cantidad: 1 },
                { nombre: 'LABORAT',  cantidad: 1 },
                { nombre: 'PEON',     cantidad: 2 },
                { nombre: 'VIDRIERO', cantidad: 1 },
            ]
        },
        '14 A 22': {
            puestos: [
                { nombre: 'ENC',      cantidad: 1 },
                { nombre: '2DO',      cantidad: 1 },
                { nombre: 'P BAJA',   cantidad: 1 },
                { nombre: 'FISIATRIA',cantidad: 1 },
                { nombre: 'QUIRURG',  cantidad: 1 },
                { nombre: 'NEFRO',    cantidad: 1 },
                { nombre: 'OFTA',     cantidad: 1 },
                { nombre: 'LABORAT',  cantidad: 1 },
                { nombre: 'PEON',     cantidad: 2 },
            ]
        },
        '22 A 06': {
            puestos: [
                { nombre: '1',       cantidad: 1 },
                { nombre: '2',       cantidad: 1 },
                { nombre: '3',       cantidad: 1 },
                { nombre: 'MÓVILES', cantidad: 1 },
                { nombre: 'RETÉN',   cantidad: 1 },
            ]
        },
        'HEMOTERAPIA': {
            puestos: [
                { nombre: 'HEMOTERAPIA',    cantidad: 2 },
                { nombre: 'TOMOGRAFO',      cantidad: 2 },
                { nombre: 'ENDOSCOPIA',     cantidad: 2 },
                { nombre: 'QUIRURGICA',     cantidad: 1 },
                { nombre: 'PISCINA',        cantidad: 2 },
                { nombre: 'ECONOMATO 1727', cantidad: 1 },
                { nombre: 'C. DE MAMAS',    cantidad: 3 },
                { nombre: 'COMPACTADORA',   cantidad: 1 },
            ]
        }
    },
    'Pisos Vip': {
        '6 A 14': {
            puestos: [
                { nombre: 'ENC-6 A 14',    cantidad: 1 },
                { nombre: 'AUXILIAR 6º',   cantidad: 2 },
                { nombre: 'LIMPIADORA 6º', cantidad: 1 },
                { nombre: 'AUXILIAR 5º',   cantidad: 1 },
                { nombre: 'LIMPIADORA 5º', cantidad: 1 },
                { nombre: 'AUXILIAR 4º',   cantidad: 1 },
                { nombre: 'LIMPIADORA 4º', cantidad: 1 },
            ]
        },
        '14 A 22': {
            puestos: [
                { nombre: 'ENC-14 A 22',   cantidad: 1 },
                { nombre: 'AUXILIAR 6º',   cantidad: 2 },
                { nombre: 'LIMPIADORA 6º', cantidad: 1 },
                { nombre: 'AUXILIAR 5º',   cantidad: 1 },
                { nombre: 'LIMPIADORA 5º', cantidad: 1 },
                { nombre: 'AUXILIAR 4º',   cantidad: 1 },
                { nombre: 'LIMPIADORA 4º', cantidad: 1 },
            ]
        },
        '22 A 06': {
            puestos: [
                { nombre: 'ENC-22 A 06',   cantidad: 1 },
                { nombre: 'LIMPIADORA 6º', cantidad: 1 },
                { nombre: 'AUXILIAR 5º',   cantidad: 1 },
                { nombre: 'AUXILIAR 4º',   cantidad: 1 },
            ]
        }
    },
    'Torre 1': {
        '6 A 14': {
            puestos: [
                { nombre: 'ENCARGADO/A',     cantidad: 1 },
                { nombre: 'URGENCIA',        cantidad: 4 },
                { nombre: 'URGENCIA 7 A 15', cantidad: 1 },
                { nombre: 'AUXILIAR',        cantidad: 2 },
                { nombre: '3º AUXILIAR',     cantidad: 2 },
                { nombre: '2D',              cantidad: 2 },
                { nombre: '1D',              cantidad: 2 },
                { nombre: 'PEON',            cantidad: 2 },
                { nombre: 'VIDRIERO',        cantidad: 1 },
            ]
        },
        '14 A 22': {
            puestos: [
                { nombre: 'ENCARGADO/A',      cantidad: 1 },
                { nombre: 'URGENCIA',         cantidad: 4 },
                { nombre: 'URGENCIA 14 A 18', cantidad: 1 },
                { nombre: 'URGENCIA 18 A 22', cantidad: 1 },
                { nombre: 'AUXILIAR',         cantidad: 2 },
                { nombre: '3º AUXILIAR',      cantidad: 2 },
                { nombre: '2D',               cantidad: 2 },
                { nombre: '1D',               cantidad: 2 },
                { nombre: 'PEON',             cantidad: 2 },
            ]
        },
        '22 A 06': {
            puestos: [
                { nombre: 'ENCARGADO/A',          cantidad: 1 },
                { nombre: 'URGENCIA',             cantidad: 4 },
                { nombre: 'AUXILIAR',             cantidad: 1 },
                { nombre: 'AUXILIAR AISLAMIENTO', cantidad: 1 },
                { nombre: '3º AUXILIAR',          cantidad: 1 },
                { nombre: '2D',                   cantidad: 1 },
                { nombre: '1D',                   cantidad: 1 },
                { nombre: 'PEON',                 cantidad: 1 },
            ]
        }
    }
};

function getPlanillaConfig(sector: string, turno: string): TurnoConfig | null {
    const key = Object.keys(PLANILLA_CONFIG).find(
        k => k.toLowerCase() === sector.toLowerCase()
    );
    if (!key) return null;
    return PLANILLA_CONFIG[key][turno] ?? null;
}

function getTurnosForSector(sector: string): string[] {
    const key = Object.keys(PLANILLA_CONFIG).find(
        k => k.toLowerCase() === sector.toLowerCase()
    );
    if (!key) return TURNOS;
    return Object.keys(PLANILLA_CONFIG[key]);
}

export default function InformesOperativosPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();

    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('');
    const [sectorSeleccionado, setSectorSeleccionado] = useState<string>('');
    const [turnoSeleccionado, setTurnoSeleccionado] = useState<string>('');
    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [clientes, setClientes] = useState<string[]>([]);
    const [asistencia, setAsistencia] = useState<SeccionesAsistencia>(() => Object.fromEntries(SECCIONES.map(s => [s, []])));
    const [fetching, setFetching] = useState(false);
    const [saving, setSaving] = useState<string | null>(null); // section-index key
    const [showSignature, setShowSignature] = useState<{ section: string, index: number } | null>(null);
    const [expanded, setExpanded] = useState<string[]>(SECCIONES);
    const [fromHistory, setFromHistory] = useState(false);

    const sheetRef = useRef<HTMLDivElement>(null);

    // Initial load & URL params
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const f = params.get('fecha');
            if (f) setFecha(f);
            if (params.get('from') === 'history') setFromHistory(true);
        }
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchClientes = useCallback(async () => {
        try {
            const res = await fetch('/api/config/locations', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const names = data.map((l: any) => l.name);
                setClientes(names.sort());
            }
        } catch (e) {
            console.error('Error fetching official clients:', e);
        }
    }, [getAuthHeaders]);

    const fetchFuncionarios = useCallback(async () => {
        try {
            const res = await fetch('/api/limpieza/usuarios', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const activeFuncionarios = data.filter((f: any) => f.activo !== 0);
                setFuncionarios(activeFuncionarios);
            }
        } catch (e) {
            console.error('Error fetching workers:', e);
        }
    }, [getAuthHeaders]);

    const fetchAsistencia = useCallback(async (date: string, client: string, sector: string, turno: string) => {
        setFetching(true);
        try {
            const clientQuery = client ? `&cliente=${encodeURIComponent(client)}` : '';
            const sectorQuery = sector ? `&sector=${encodeURIComponent(sector)}` : '';
            const res = await fetch(`/api/limpieza/asistencia?fecha=${date}${clientQuery}${sectorQuery}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const newAsistencia: SeccionesAsistencia = Object.fromEntries(SECCIONES.map(s => [s, []]));

                // Build structured rows for the turno section if a planilla config exists
                const config = getPlanillaConfig(sector, turno);
                if (config && turno && config.puestos.length > 0) {
                    const dbRowsForTurno = data.filter((r: any) => r.seccion === turno);
                    const structuredRows: AsistenciaRow[] = [];
                    for (const puestoConf of config.puestos) {
                        const dbForPuesto = dbRowsForTurno.filter((r: any) => r.puesto === puestoConf.nombre);
                        for (let i = 0; i < puestoConf.cantidad; i++) {
                            structuredRows.push(dbForPuesto[i]
                                ? { ...dbForPuesto[i], isSaved: true }
                                : { puesto: puestoConf.nombre, funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false }
                            );
                        }
                    }
                    newAsistencia[turno] = structuredRows;

                    // ADICIONALES: dynamic rows from DB + one empty
                    const adicionales = data.filter((r: any) => r.seccion === 'ADICIONALES').map((r: any) => ({ ...r, isSaved: true }));
                    newAsistencia['ADICIONALES'] = adicionales.length > 0 ? adicionales : [{ puesto: '', funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false }];
                } else {
                    // No config: fill all sections from DB, ensure at least one empty row each
                    data.forEach((row: any) => {
                        if (newAsistencia[row.seccion]) {
                            newAsistencia[row.seccion].push({ ...row, isSaved: true });
                        }
                    });
                    SECCIONES.forEach(sec => {
                        if (newAsistencia[sec].length === 0) {
                            newAsistencia[sec].push({ puesto: '', funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false });
                        }
                    });
                }

                setAsistencia(newAsistencia);
            }
        } catch (e) {
            console.error('Error fetching attendance:', e);
        } finally {
            setFetching(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (isAuthenticated && currentUser) {
            fetchClientes();
            fetchFuncionarios();
        }
    }, [isAuthenticated, currentUser, fetchClientes, fetchFuncionarios]);

    useEffect(() => {
        if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'limpieza') && clienteSeleccionado && sectorSeleccionado && turnoSeleccionado) {
            fetchAsistencia(fecha, clienteSeleccionado, sectorSeleccionado, turnoSeleccionado);
        }
    }, [isAuthenticated, currentUser, fecha, clienteSeleccionado, sectorSeleccionado, turnoSeleccionado, fetchAsistencia]);

    // Sections to render: selected turno + Adicionales
    const seccionesActivas = turnoSeleccionado ? [turnoSeleccionado, 'ADICIONALES'] : SECCIONES;

    const createEmptyRow = (puesto?: string): AsistenciaRow => ({
        puesto: puesto ?? '',
        funcionario_id: null,
        nombre: '',
        cedula: '',
        cliente: clienteSeleccionado,
        entrada1: '',
        salida1: '',
        entrada2: '',
        salida2: '',
        firma: null,
        isSaved: false
    });

    const addRow = (section: string) => {
        setAsistencia(prev => ({
            ...prev,
            [section]: [...prev[section], createEmptyRow()]
        }));
    };

    const removeRow = async (section: string, index: number) => {
        const row = asistencia[section][index];
        const isAdicionales = section === 'ADICIONALES';

        // Delete from DB if the row has been saved
        if (row.id) {
            try {
                await fetch(`/api/limpieza/asistencia?id=${row.id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
            } catch (e) {
                console.error('Error deleting row:', e);
            }
        }

        if (isAdicionales) {
            // Remove the row entirely
            setAsistencia(prev => ({
                ...prev,
                [section]: prev[section].filter((_, i) => i !== index)
            }));
        } else {
            // Structured row: keep the slot but reset it (preserve puesto)
            const puesto = row.puesto;
            setAsistencia(prev => {
                const newRows = [...prev[section]];
                newRows[index] = { puesto, funcionario_id: null, nombre: '', cedula: '', cliente: clienteSeleccionado, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false };
                return { ...prev, [section]: newRows };
            });
        }
    };

    const updateRow = (section: string, index: number, updates: Partial<AsistenciaRow>) => {
        setAsistencia(prev => {
            const newRows = [...prev[section]];
            newRows[index] = { ...newRows[index], ...updates };
            return {
                ...prev,
                [section]: newRows
            };
        });
    };

    const handleWorkerSelect = (section: string, index: number, workerIdStr: string) => {
        const workerId = parseInt(workerIdStr);
        const worker = funcionarios.find(f => f.id === workerId);
        
        if (worker) {
            const updatedRow = {
                ...asistencia[section][index],
                funcionario_id: worker.id,
                nombre: worker.nombre,
                cedula: worker.cedula || '',
                cliente: worker.cliente || clienteSeleccionado || '',
                firma: null
            };
            updateRow(section, index, updatedRow);
            saveRowWithData(section, index, updatedRow); // Auto-save on select
        } else {
            const updatedRow = {
                ...asistencia[section][index],
                funcionario_id: null,
                nombre: '',
                cedula: '',
                cliente: clienteSeleccionado !== 'Todos' ? clienteSeleccionado : '',
                firma: null
            };
            updateRow(section, index, updatedRow);
            // We don't necessarily save a null worker unless it had an ID
            if (asistencia[section][index].id) {
                saveRowWithData(section, index, updatedRow);
            }
        }
    };

    const saveRowWithData = async (section: string, index: number, rowOverride?: AsistenciaRow) => {
        const row = rowOverride || asistencia[section][index];
        if (!row.funcionario_id) return;

        setSaving(`${section}-${index}`);
        try {
            const res = await fetch('/api/limpieza/asistencia', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...row,
                    fecha,
                    seccion: section,
                    cliente: row.cliente || clienteSeleccionado,
                    sector: sectorSeleccionado,
                    puesto: row.puesto ?? null
                })
            });

            if (res.ok) {
                const data = await res.json();
                updateRow(section, index, { id: data.id, isSaved: true });
            }
        } catch (e) {
            console.error('Error saving row:', e);
        } finally {
            setSaving(null);
        }
    };

    const saveRow = (section: string, index: number) => saveRowWithData(section, index);

    const toggleSection = (section: string) => {
        setExpanded(prev => 
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    const handlePrint = () => {
        const originalTitle = document.title;
        const clientName = clienteSeleccionado || 'General';
        const sectorName = sectorSeleccionado ? `_${sectorSeleccionado.replace(/\s+/g, '_')}` : '';
        const turnoName = turnoSeleccionado ? `_Turno_${turnoSeleccionado.replace(/\s+/g, '_')}` : '';
        document.title = `Reporte_Operacional_${fecha}_${clientName.replace(/\s+/g, '_')}${sectorName}${turnoName}`;
        
        window.print();
        
        // Restore title after a brief delay
        setTimeout(() => {
            document.title = originalTitle;
        }, 500);
    };

    if (loading || !currentUser) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7fa', display: 'flex', flexDirection: 'column' }}>
            {/* Header hidden on print */}
            <header className="no-print" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 50
            }}>
                <Link 
                    href={fromHistory ? "/operaciones-limpieza/historial" : "/operaciones-limpieza"} 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={15} /> {fromHistory ? 'Volver al Historial' : 'Operaciones Limpieza'}
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} className="mobile-hide" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }} className="mobile-hide">{currentUser.name}</span>
                    <button 
                        onClick={() => { logout(); router.push('/login'); }} 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                {/* Actions Row - no-print */}
                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#1d3461', color: 'white', padding: '0.6rem', borderRadius: '10px' }}>
                            <FileText size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: 0 }}>Reporte Operativo</h1>
                            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>Planilla de asistencia y novedades</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        {/* Cliente */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Cliente</span>
                            <select
                                value={clienteSeleccionado}
                                onChange={e => { setClienteSeleccionado(e.target.value); setSectorSeleccionado(''); setTurnoSeleccionado(''); }}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #1d3461', fontSize: '0.875rem', backgroundColor: 'white', color: '#111827', cursor: 'pointer', fontWeight: 600, width: '100%' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Sector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Sector</span>
                            <select
                                value={sectorSeleccionado}
                                onChange={e => { setSectorSeleccionado(e.target.value); setTurnoSeleccionado(''); }}
                                disabled={!clienteSeleccionado}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #1d3461', fontSize: '0.875rem', backgroundColor: clienteSeleccionado ? 'white' : '#f1f5f9', color: '#111827', cursor: clienteSeleccionado ? 'pointer' : 'not-allowed', fontWeight: 600, width: '100%' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {getSectoresForCliente(clienteSeleccionado).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Turno */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Turno</span>
                            <select
                                value={turnoSeleccionado}
                                onChange={e => setTurnoSeleccionado(e.target.value)}
                                disabled={!sectorSeleccionado}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #1d3461', fontSize: '0.875rem', backgroundColor: sectorSeleccionado ? 'white' : '#f1f5f9', color: '#111827', cursor: sectorSeleccionado ? 'pointer' : 'not-allowed', fontWeight: 600, width: '100%' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {getTurnosForSector(sectorSeleccionado).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Fecha */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Fecha</span>
                            <input
                                type="date"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', backgroundColor: 'white', color: '#111827', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        <button
                            onClick={handlePrint}
                            disabled={!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 650, color: (!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado) ? '#94a3b8' : '#111827', cursor: (!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado) ? 'not-allowed' : 'pointer', minHeight: '38px', width: '100%', boxSizing: 'border-box' }}
                        >
                            <Printer size={16} /> <span>Imprimir PDF</span>
                        </button>
                    </div>
                </div>

                {/* The Virtual Sheet - Printable Area */}
                <div id="printable-sheet" ref={sheetRef} className="card mobile-no-padding" style={{ padding: '2rem 1.5rem', minHeight: '1000px', backgroundColor: 'white', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
                    {/* Sheet Header - shown on print */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '240px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="GSS" style={{ height: '44px' }} />
                            <div style={{ flex: 1 }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1d3461', lineHeight: '1.2' }} className="report-title">Reporte Operacional</h2>
                                {clienteSeleccionado && (
                                    <p style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 700, margin: '0.1rem 0 0 0' }}>
                                        {clienteSeleccionado}{sectorSeleccionado ? ` — ${sectorSeleccionado}` : ''}{turnoSeleccionado ? ` | Turno ${turnoSeleccionado}` : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div style={{ border: '2px solid #000', padding: '0.5rem 1rem', borderRadius: '4px', textAlign: 'center', flexShrink: 0, minWidth: '120px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '0.15rem', textTransform: 'uppercase' }}>Fecha del Reporte</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#111827' }}>{fecha.split('-').reverse().join('/')}</div>
                        </div>
                    </div>

                    {!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado ? (
                        <div style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8' }}>
                            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Seleccioná cliente, sector y turno para ver la planilla</p>
                            <p style={{ fontSize: '0.85rem' }}>
                                {!clienteSeleccionado ? '← Elegí un cliente' : !sectorSeleccionado ? '← Ahora el sector' : '← Ahora el turno'}
                            </p>
                        </div>
                    ) : fetching ? (
                        <div style={{ padding: '5rem', textAlign: 'center', color: '#64748b' }}>Cargando datos del día...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {seccionesActivas.map(seccion => {
                                                const isAdicionales = seccion === 'ADICIONALES';
                                const sectionConfig = !isAdicionales ? getPlanillaConfig(sectorSeleccionado, seccion) : null;
                                const showPuestoCol = !!sectionConfig && sectionConfig.puestos.length > 0;

                                const getTimeOptions = (sec: string) => {
                                    const times = [''];
                                    if (sec === '6 A 14') {
                                        for (let h = 5; h <= 15; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else if (sec === '12 A 20') {
                                        for (let h = 11; h <= 21; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else if (sec === '14 A 22') {
                                        for (let h = 13; h <= 23; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else if (sec === '15 A 23') {
                                        for (let h = 14; h <= 24; h++) { const hh = (h % 24).toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else if (sec === 'HEMOTERAPIA') {
                                        for (let h = 5; h <= 23; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else if (sec === '22 A 06') {
                                        for (let h = 21; h <= 23; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                        for (let h = 0; h <= 7; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    } else {
                                        for (let h = 5; h <= 23; h++) { const hh = h.toString().padStart(2, '0'); times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`); }
                                    }
                                    return times;
                                };
                                const timeOptions = getTimeOptions(seccion);

                                return (
                                <div key={seccion} style={{ marginBottom: '1rem' }}>
                                    <div
                                        onClick={() => toggleSection(seccion)}
                                        className="no-print"
                                        style={{
                                            backgroundColor: '#f8fafc', padding: '0.75rem 1rem',
                                            borderRadius: '8px', border: '1px solid #e2e8f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer', marginBottom: '0.5rem'
                                        }}
                                    >
                                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>SECCIÓN: {seccion}</h3>
                                        {expanded.includes(seccion) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>

                                    {/* Print-only section title */}
                                    <div className="print-only" style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #000', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#1d3461' }}>{seccion}</h3>
                                    </div>

                                    {(expanded.includes(seccion) || !isAdicionales) && (
                                        <div className="scroll-container">
                                            <table style={{ width: '100%', minWidth: showPuestoCol ? '880px' : '800px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#fff', borderBottom: '2px solid #000' }}>
                                                        {showPuestoCol && <th style={{ width: '110px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Puesto</th>}
                                                        <th style={{ width: '110px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Cédula</th>
                                                        <th style={{ width: '200px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Nombre y Apellido</th>
                                                        <th style={{ width: '65px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Ent.</th>
                                                        <th style={{ width: '65px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Sal.</th>
                                                        <th style={{ width: '65px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Ent.</th>
                                                        <th style={{ width: '65px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Sal.</th>
                                                        <th style={{ width: '140px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Firma</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {asistencia[seccion].map((row, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                            {showPuestoCol && (
                                                                <td style={{ padding: '0.4rem' }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase' }}>{row.puesto}</span>
                                                                </td>
                                                            )}
                                                            <td style={{ padding: '0.4rem' }}>
                                                                <input
                                                                    readOnly
                                                                    value={row.cedula}
                                                                    placeholder=""
                                                                    style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 500, outline: 'none' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '0.4rem' }}>
                                                                <select
                                                                    className="no-print"
                                                                    value={row.funcionario_id || ''}
                                                                    onChange={e => handleWorkerSelect(seccion, idx, e.target.value)}
                                                                    style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: '#1d3461', cursor: 'pointer' }}
                                                                >
                                                                    <option value="">Seleccione...</option>
                                                                    {funcionarios
                                                                        .filter(f => clienteSeleccionado === 'Todos' || f.cliente === clienteSeleccionado)
                                                                        .map(f => (
                                                                            <option key={f.id} value={f.id}>{f.nombre}</option>
                                                                        ))
                                                                    }
                                                                </select>
                                                                <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{row.nombre || '..........................................'}</span>
                                                            </td>
                                                            {(['entrada1', 'salida1', 'entrada2', 'salida2'] as const).map(field => (
                                                                <td key={field} style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                    <select
                                                                        className="no-print"
                                                                        value={row[field] || ''}
                                                                        onChange={e => {
                                                                            updateRow(seccion, idx, { [field]: e.target.value });
                                                                            saveRowWithData(seccion, idx, { ...asistencia[seccion][idx], [field]: e.target.value });
                                                                        }}
                                                                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '0.8rem', outline: 'none', fontWeight: 700, appearance: 'none', cursor: 'pointer' }}
                                                                    >
                                                                        {timeOptions.map(t => (
                                                                            <option key={t} value={t}>{t || '--:--'}</option>
                                                                        ))}
                                                                    </select>
                                                                    <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                                                        {row[field] || '--:--'}
                                                                    </span>
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: '0.4rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                                    {row.firma ? (
                                                                        <img
                                                                            src={row.firma}
                                                                            alt="Signature"
                                                                            onClick={() => { if (!row.isSaved) setShowSignature({ section: seccion, index: idx }); }}
                                                                            style={{ maxHeight: '35px', cursor: row.isSaved ? 'default' : 'pointer' }}
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            className="no-print"
                                                                            onClick={() => setShowSignature({ section: seccion, index: idx })}
                                                                            disabled={!row.funcionario_id}
                                                                            style={{ padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem' }}
                                                                        >
                                                                            <PenTool size={12} /> Firmar
                                                                        </button>
                                                                    )}
                                                                    <div className="no-print" style={{ display: 'flex', gap: '0.2rem' }}>
                                                                        {!row.isSaved && row.funcionario_id && (
                                                                            <button onClick={() => saveRow(seccion, idx)} disabled={saving === `${seccion}-${idx}`} style={{ background: 'none', border: 'none', color: '#1d3461', cursor: 'pointer' }} title="Guardar fila">
                                                                                <Save size={16} />
                                                                            </button>
                                                                        )}
                                                                        {row.isSaved && (
                                                                            <button onClick={() => saveRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#22c55e' }} title="Actualizar">
                                                                                <CheckCircle2 size={16} />
                                                                            </button>
                                                                        )}
                                                                        {(isAdicionales || row.funcionario_id) && (
                                                                            <button onClick={() => removeRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title={isAdicionales ? 'Eliminar fila' : 'Limpiar registro'}>
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {isAdicionales && (
                                                <button
                                                    className="no-print"
                                                    onClick={() => addRow(seccion)}
                                                    style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'transparent', border: 'none', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '0.3rem' }}
                                                >
                                                    <Plus size={14} /> Agregar funcionario
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {showSignature && clienteSeleccionado && sectorSeleccionado && turnoSeleccionado && (
                <SignaturePad 
                    title={`Firma de ${asistencia[showSignature.section][showSignature.index].nombre}`}
                    onCancel={() => setShowSignature(null)}
                    onSave={async (sig) => {
                        const { section, index } = showSignature;
                        // Update state
                        updateRow(section, index, { firma: sig });
                        setShowSignature(null);
                        
                        // Auto-save the row including the new signature
                        // We use a small delay or closure because updateRow is async state
                        const currentRow = { ...asistencia[section][index], firma: sig };
                        await saveRowWithData(section, index, currentRow);
                    }}
                />
            )}

            {/* Fixed logout removed from here, now in header */}

            <style jsx global>{`
                @media print {
                    @page {
                        margin: 1cm;
                        size: portrait;
                    }
                    body {
                        background-color: white !important;
                        overflow: visible !important;
                    }
                    .table-container {
                        overflow: visible !important;
                    }
                    * {
                        -ms-overflow-style: none; /* IE/Edge */
                        scrollbar-width: none; /* Firefox */
                    }
                    *::-webkit-scrollbar {
                        display: none; /* Chrome/Safari */
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    #printable-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                    }
                }
                .print-only {
                    display: none;
                }
                @media (max-width: 768px) {
                    .report-title {
                        font-size: 1rem !important;
                    }
                    #printable-sheet {
                        padding: 1.25rem 1rem !important;
                    }
                }
            `}</style>
        </div>
    );
}
