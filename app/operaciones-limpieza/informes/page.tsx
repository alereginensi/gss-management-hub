'use client'; 

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, FileText, Plus, Save, X,
    Trash2, PenTool, CheckCircle2,
    ChevronDown, ChevronUp, Printer, LogOut,
    Upload, Download, Check, XCircle, Lock,
} from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import SignaturePad from '@/app/components/SignaturePad';
import { FuncionarioSearchSelect } from '@/app/components/limpieza/FuncionarioSearchSelect';

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
    isManual?: boolean;
    planificado?: number;
    asistio?: number | null;
    observaciones?: string;
    categoria?: string;
    import_batch_id?: number;
}

interface SeccionesAsistencia {
    [key: string]: AsistenciaRow[];
}

const TURNOS = ['6 A 14', '14 A 22', '22 A 06'];
const SECCIONES = ['6 A 14', '12 A 20', '14 A 22', '15 A 23', '22 A 06', 'HEMOTERAPIA', 'ADICIONALES'];

interface PuestoConfig { nombre: string; cantidad: number; }
interface TurnoConfig { puestos: PuestoConfig[]; }

// PLANILLA_CONFIG se carga ahora en runtime desde /api/limpieza/planilla-config/full.
// Este mapa se hidrata desde la API al montar el componente.
let PLANILLA_CONFIG: Record<string, Record<string, TurnoConfig>> = {};
let SECTORES_POR_CLIENTE: Record<string, string[]> = {};
function getSectoresForCliente(cliente: string): string[] {
    if (!cliente) return [];
    const key = Object.keys(SECTORES_POR_CLIENTE).find(k => k.toLowerCase() === cliente.toLowerCase());
    return key ? SECTORES_POR_CLIENTE[key] : [];
}
// Mapa descartado (el editor de planillas ahora es fuente de verdad).
const _OLD_PLANILLA_CONFIG_HARDCODED: Record<string, Record<string, TurnoConfig>> = {
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
    },
    'Seguridad': {
        '6 A 14':  { puestos: [] },
        '14 A 22': { puestos: [] },
        '22 A 06': {
            puestos: [
                { nombre: 'Encargado',              cantidad: 1 },
                { nombre: 'Cabina Urgencia',        cantidad: 1 },
                { nombre: 'Recorrida (Medisgroup)', cantidad: 1 },
                { nombre: 'Cabina Abreu',           cantidad: 1 },
                { nombre: 'Sede Administrativa',    cantidad: 1 },
                { nombre: 'Tesorería',              cantidad: 1 },
                { nombre: 'Visita CTI',             cantidad: 1 },
                { nombre: 'Portería Torre 1',       cantidad: 1 },
                { nombre: 'Portería Torre 2',       cantidad: 1 },
                { nombre: 'Local 8',                cantidad: 1 },
                { nombre: 'Policlínico (puerta 8)', cantidad: 1 },
                { nombre: 'Salud Mental',           cantidad: 1 },
                { nombre: 'Alarma Asilo',           cantidad: 1 },
                { nombre: 'Cocina',                 cantidad: 1 },
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
    const [, setConfigVersion] = useState(0);
    const [asistencia, setAsistencia] = useState<SeccionesAsistencia>(() => Object.fromEntries(SECCIONES.map(s => [s, []])));
    const [fetching, setFetching] = useState(false);
    const [saving, setSaving] = useState<string | null>(null); // section-index key
    const [showSignature, setShowSignature] = useState<{ section: string, index: number, pendingAsistio?: 1 | 0 } | null>(null);
    const [expanded, setExpanded] = useState<string[]>(SECCIONES);
    const [fromHistory, setFromHistory] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadCategoria, setUploadCategoria] = useState<'LIMPIADOR' | 'AUXILIAR' | 'VIDRIERO' | 'ENCARGADO' | ''>('');
    // Flujo nuevo: parse → preview → confirmar
    interface ParsedRow {
        lugar_sistema: string;
        lugar_planilla: string;
        turno: string;
        turno_raw: string;
        frecuencia: string;
        cantidad: number;
        funcionario_nombre?: string;
        funcionario_cedula?: string;
        categoria?: string;
        fecha?: string;
    }
    interface ParsedSheet { name: string; rows: ParsedRow[]; missing_headers: string[]; }
    interface PanelStats { panel_total: number; matched: number; discarded: number; discarded_samples: string[]; fechas_detectadas: string[]; }
    const [previewSheets, setPreviewSheets] = useState<ParsedSheet[] | null>(null);
    const [sheetSectorMap, setSheetSectorMap] = useState<Record<string, string>>({});
    const [parsingPreview, setParsingPreview] = useState(false);
    const [importing, setImporting] = useState(false);
    const [panelFile, setPanelFile] = useState<File | null>(null);
    const [panelStats, setPanelStats] = useState<PanelStats | null>(null);
    const [previewMode, setPreviewMode] = useState<'template' | 'crossed'>('template');
    const [exporting, setExporting] = useState<'' | 'excel' | 'versus'>('');

    const isAdmin = currentUser?.role === 'admin';
    const isEncargado = currentUser?.role === 'encargado_limpieza';
    const lockedCliente = isEncargado ? (currentUser?.cliente_asignado || '') : '';
    const lockedSector = isEncargado ? (currentUser?.sector_asignado || '') : '';

    const sheetRef = useRef<HTMLDivElement>(null);

    // Initial load & URL params
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const f = params.get('fecha');
            if (f) setFecha(f);
            if (params.get('from') === 'history') { setFromHistory(true); setReadOnly(true); }
        }
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchClientes = useCallback(async () => {
        try {
            const res = await fetch('/api/limpieza/planilla-config/full', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const names = (data.clientes || []).map((l: any) => l.name);
                setClientes(names.sort());
            }
        } catch (e) {
            console.error('Error fetching planilla-config clientes:', e);
        }
    }, [getAuthHeaders]);

    // Hidrata el mapa PLANILLA_CONFIG y SECTORES_POR_CLIENTE desde la API cuando cambia el cliente
    const fetchPlanillaConfig = useCallback(async (cliente: string) => {
        if (!cliente) return;
        try {
            const res = await fetch(`/api/limpieza/planilla-config/full?cliente=${encodeURIComponent(cliente)}`, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            SECTORES_POR_CLIENTE[cliente] = (data.sectores || []).map((s: any) => s.name);
            for (const s of (data.sectores || [])) {
                PLANILLA_CONFIG[s.name] = {};
                for (const t of (s.turnos || [])) {
                    PLANILLA_CONFIG[s.name][t.turno] = { puestos: t.puestos };
                }
            }
            setConfigVersion(v => v + 1);
        } catch (e) {
            console.error('Error hidratando planilla config:', e);
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
                const dbRowsForTurno = data.filter((r: any) => r.seccion === turno);
                const hasPlanificados = dbRowsForTurno.some((r: any) => r.planificado === 1);

                if (hasPlanificados) {
                    // Flujo Excel: mostrar los planificados tal cual + no-planificados (agregados por encargado)
                    const rows: AsistenciaRow[] = dbRowsForTurno.map((r: any) => ({
                        ...r,
                        isSaved: true,
                        isManual: !r.funcionario_id && !!r.nombre && !r.planificado,
                    }));
                    newAsistencia[turno] = rows;
                    const adicionales = data.filter((r: any) => r.seccion === 'ADICIONALES').map((r: any) => ({ ...r, isSaved: true, isManual: !r.funcionario_id && !!r.nombre }));
                    newAsistencia['ADICIONALES'] = adicionales.length > 0 ? adicionales : [{ puesto: '', funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false }];
                } else if (config && turno && config.puestos.length > 0) {
                    const structuredRows: AsistenciaRow[] = [];
                    for (const puestoConf of config.puestos) {
                        const dbForPuesto = dbRowsForTurno.filter((r: any) => r.puesto === puestoConf.nombre);
                        for (let i = 0; i < puestoConf.cantidad; i++) {
                            structuredRows.push(dbForPuesto[i]
                                ? { ...dbForPuesto[i], isSaved: true, isManual: !dbForPuesto[i].funcionario_id && !!dbForPuesto[i].nombre }
                                : { puesto: puestoConf.nombre, funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false }
                            );
                        }
                    }
                    newAsistencia[turno] = structuredRows;

                    // ADICIONALES: dynamic rows from DB + one empty
                    const adicionales = data.filter((r: any) => r.seccion === 'ADICIONALES').map((r: any) => ({ ...r, isSaved: true, isManual: !r.funcionario_id && !!r.nombre }));
                    newAsistencia['ADICIONALES'] = adicionales.length > 0 ? adicionales : [{ puesto: '', funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false }];
                } else {
                    // No config: fill all sections from DB, ensure at least one empty row each
                    data.forEach((row: any) => {
                        if (newAsistencia[row.seccion]) {
                            newAsistencia[row.seccion].push({ ...row, isSaved: true, isManual: !row.funcionario_id && !!row.nombre });
                        }
                    });
                    SECCIONES.forEach(sec => {
                        if (newAsistencia[sec].length === 0) {
                            newAsistencia[sec].push({ puesto: '', funcionario_id: null, nombre: '', cedula: '', cliente: client, entrada1: '', salida1: '', entrada2: '', salida2: '', firma: null, isSaved: false });
                        }
                    });
                }

                // Auto-rellenar fila del puesto ENCARGADO/A con el usuario actual si es encargado_limpieza
                const u: any = currentUser;
                if (u?.role === 'encargado_limpieza' && u?.name && turno && newAsistencia[turno]) {
                    const rows = newAsistencia[turno];
                    const idx = rows.findIndex(r => /ENCARG/i.test(r.puesto || '') && !r.nombre && !r.funcionario_id && !r.isSaved);
                    if (idx !== -1) {
                        rows[idx] = { ...rows[idx], nombre: u.name, cedula: u.cedula || '', isManual: true };
                    }
                }

                setAsistencia(newAsistencia);
            }
        } catch (e) {
            console.error('Error fetching attendance:', e);
        } finally {
            setFetching(false);
        }
    }, [getAuthHeaders, currentUser]);

    useEffect(() => {
        if (isAuthenticated && currentUser) {
            fetchClientes();
            fetchFuncionarios();
        }
    }, [isAuthenticated, currentUser, fetchClientes, fetchFuncionarios]);

    // Cargar config de planilla al cambiar cliente
    useEffect(() => {
        if (clienteSeleccionado) fetchPlanillaConfig(clienteSeleccionado);
    }, [clienteSeleccionado, fetchPlanillaConfig]);

    // Auto-fill y lock de filtros cuando es encargado_limpieza
    useEffect(() => {
        if (isEncargado && lockedCliente && !clienteSeleccionado) {
            setClienteSeleccionado(lockedCliente);
        }
    }, [isEncargado, lockedCliente, clienteSeleccionado]);
    useEffect(() => {
        if (isEncargado && lockedSector && !sectorSeleccionado && clienteSeleccionado) {
            setSectorSeleccionado(lockedSector);
        }
    }, [isEncargado, lockedSector, sectorSeleccionado, clienteSeleccionado]);

    const handleParsePreview = async () => {
        if (!uploadFile || !clienteSeleccionado) {
            alert('Faltan: cliente y archivo del Panel.');
            return;
        }
        setParsingPreview(true);
        try {
            const fd = new FormData();
            // El archivo principal ahora ES el Panel Mitrabajo
            fd.append('panel', uploadFile);
            fd.append('cliente', clienteSeleccionado);
            const res = await fetch('/api/limpieza/planilla/parse-puestos', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'No se pudo leer el archivo.');
                return;
            }
            setPreviewSheets(data.sheets || []);
            setPanelStats(data.panel_stats || null);
            setPreviewMode(data.mode || 'crossed');
            // Con el mapeo de DB los sectores ya vienen correctos (nombre del sector
            // = name de limpieza_sectores). Auto-mapear hoja=sector.
            const map: Record<string, string> = {};
            for (const sheet of (data.sheets || []) as ParsedSheet[]) {
                map[sheet.name] = sheet.name;
            }
            setSheetSectorMap(map);
        } catch (err: any) {
            alert('Error al leer el Excel: ' + (err?.message || err));
        } finally {
            setParsingPreview(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!previewSheets || !fecha || !clienteSeleccionado) return;
        // Validar que cada hoja con rows tenga sector mapeado
        const unmapped = previewSheets.filter(s => s.rows.length > 0 && !sheetSectorMap[s.name]);
        if (unmapped.length > 0) {
            alert(`Falta asignar sector para las hojas: ${unmapped.map(s => s.name).join(', ')}`);
            return;
        }
        const items: any[] = [];
        for (const sheet of previewSheets) {
            const sector = sheetSectorMap[sheet.name];
            if (!sector) continue;
            for (const row of sheet.rows) {
                items.push({
                    sector,
                    puesto: row.lugar_planilla,
                    turno: row.turno,
                    nombre: row.funcionario_nombre || null,
                    cedula: row.funcionario_cedula || null,
                    categoria: row.categoria || uploadCategoria || null,
                    fecha: row.fecha || null,
                });
            }
        }
        if (!items.length) { alert('No hay filas válidas para importar.'); return; }

        setImporting(true);
        try {
            const res = await fetch('/api/limpieza/planilla/import-puestos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    cliente: clienteSeleccionado,
                    filename: uploadFile?.name || 'planilla.xlsx',
                    items,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Error al importar');
            } else {
                alert(`Importación OK: ${data.created} filas creadas${data.skipped?.length ? ` — ${data.skipped.length} duplicados omitidos` : ''}.`);
                setShowUpload(false);
                setUploadFile(null);
                setUploadCategoria('');
                setPreviewSheets(null);
                setSheetSectorMap({});
                if (clienteSeleccionado && sectorSeleccionado && turnoSeleccionado) {
                    fetchAsistencia(fecha, clienteSeleccionado, sectorSeleccionado, turnoSeleccionado);
                }
            }
        } catch (err: any) {
            alert('Error: ' + (err?.message || err));
        } finally {
            setImporting(false);
        }
    };

    const resetUploadModal = () => {
        setShowUpload(false);
        setUploadFile(null);
        setUploadCategoria('');
        setPreviewSheets(null);
        setSheetSectorMap({});
        setPanelFile(null);
        setPanelStats(null);
        setPreviewMode('template');
    };

    const handleExport = async (type: 'excel' | 'versus') => {
        if (!fecha || !clienteSeleccionado) {
            alert('Seleccioná al menos fecha y cliente.');
            return;
        }
        setExporting(type);
        try {
            const params = new URLSearchParams({ fecha, cliente: clienteSeleccionado });
            if (sectorSeleccionado) params.set('sector', sectorSeleccionado);
            if (turnoSeleccionado) params.set('seccion', turnoSeleccionado);
            const res = await fetch(`/api/limpieza/planilla/export/${type}?${params}`, { headers: getAuthHeaders() });
            if (!res.ok) { alert('Error al exportar'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type === 'versus' ? 'versus' : 'planilla'}_${clienteSeleccionado}_${fecha}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting('');
        }
    };

    const handleAsistioToggle = async (section: string, index: number, value: 1 | 0) => {
        const row = asistencia[section][index];
        if (value === 1 && !row.entrada1) {
            alert('Completá la hora de entrada antes de confirmar la asistencia.');
            return;
        }
        if (value === 1 && !row.firma) {
            // Abrir pad — NO actualizar asistio hasta que se confirme la firma
            setShowSignature({ section, index, pendingAsistio: 1 });
            return;
        }
        updateRow(section, index, { asistio: value });
        await saveRowWithData(section, index, { ...row, asistio: value });
    };

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
        if (!row.funcionario_id && !(row.isManual && row.nombre)) return;

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
            } else {
                let msg = 'Error al guardar la fila';
                try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
                alert(msg);
                if (row.asistio === 1) {
                    updateRow(section, index, { asistio: null });
                }
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
                    <ArrowLeft size={15} /> {fromHistory ? 'Volver al Historial' : 'Operaciones Limpieza/Seguridad'}
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

            <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }} className="informes-main">
                {/* Actions Row - no-print */}
                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: '#1d3461', color: 'white', padding: '0.5rem', borderRadius: '8px', flexShrink: 0 }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>Reporte Operativo</h1>
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Planilla de asistencia y novedades</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        {/* Cliente */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Cliente {isEncargado && <Lock size={10} style={{ verticalAlign: 'middle' }} />}</span>
                            <select
                                value={clienteSeleccionado}
                                onChange={e => { setClienteSeleccionado(e.target.value); setSectorSeleccionado(''); setTurnoSeleccionado(''); }}
                                disabled={isEncargado && !!lockedCliente}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #1d3461', fontSize: '0.875rem', backgroundColor: (isEncargado && lockedCliente) ? '#f1f5f9' : 'white', color: '#111827', cursor: (isEncargado && lockedCliente) ? 'not-allowed' : 'pointer', fontWeight: 600, width: '100%' }}
                            >
                                <option value="">-- Seleccionar --</option>
                                {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Sector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Sector {isEncargado && lockedSector && <Lock size={10} style={{ verticalAlign: 'middle' }} />}</span>
                            <select
                                value={sectorSeleccionado}
                                onChange={e => { setSectorSeleccionado(e.target.value); setTurnoSeleccionado(''); }}
                                disabled={!clienteSeleccionado || (isEncargado && !!lockedSector)}
                                style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #1d3461', fontSize: '0.875rem', backgroundColor: clienteSeleccionado && !(isEncargado && lockedSector) ? 'white' : '#f1f5f9', color: '#111827', cursor: (!clienteSeleccionado || (isEncargado && lockedSector)) ? 'not-allowed' : 'pointer', fontWeight: 600, width: '100%' }}
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

                        {fromHistory && readOnly && (
                            <button
                                onClick={() => setReadOnly(false)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', backgroundColor: '#1d3461', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 650, color: '#fff', cursor: 'pointer', minHeight: '38px', width: '100%', boxSizing: 'border-box' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                <span>Editar</span>
                            </button>
                        )}
                        {fromHistory && !readOnly && (
                            <>
                                <button
                                    onClick={() => { fetchAsistencia(fecha, clienteSeleccionado, sectorSeleccionado, turnoSeleccionado); setReadOnly(true); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 650, color: '#64748b', cursor: 'pointer', minHeight: '38px', width: '100%', boxSizing: 'border-box' }}
                                >
                                    <X size={15} /> <span>Cancelar</span>
                                </button>
                                <button
                                    onClick={() => setReadOnly(true)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', backgroundColor: '#16a34a', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 650, color: '#fff', cursor: 'pointer', minHeight: '38px', width: '100%', boxSizing: 'border-box' }}
                                >
                                    <CheckCircle2 size={15} /> <span>Confirmar</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Botones de acción — grid 2x2 en mobile, fila en desktop */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                        <button
                            onClick={handlePrint}
                            disabled={!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 650, color: (!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado) ? '#94a3b8' : '#111827', cursor: (!clienteSeleccionado || !sectorSeleccionado || !turnoSeleccionado) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                            <Printer size={15} /> PDF
                        </button>
                        <button
                            onClick={() => handleExport('excel')}
                            disabled={!clienteSeleccionado || exporting === 'excel'}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#2e9b3a', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 650, color: '#fff', cursor: clienteSeleccionado ? 'pointer' : 'not-allowed', opacity: (!clienteSeleccionado || exporting === 'excel') ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                            <Download size={15} /> {exporting === 'excel' ? 'Exportando...' : 'Excel'}
                        </button>
                        <button
                            onClick={() => handleExport('versus')}
                            disabled={!clienteSeleccionado || exporting === 'versus'}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#1d3461', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 650, color: '#fff', cursor: clienteSeleccionado ? 'pointer' : 'not-allowed', opacity: (!clienteSeleccionado || exporting === 'versus') ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                            <Download size={15} /> {exporting === 'versus' ? 'Exportando...' : 'Versus'}
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setShowUpload(true)}
                                disabled={!clienteSeleccionado}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#d32e2e', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 650, color: '#fff', cursor: clienteSeleccionado ? 'pointer' : 'not-allowed', opacity: !clienteSeleccionado ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                title="Subir planilla del turno desde Excel (solo admin)"
                            >
                                <Upload size={15} /> Subir planilla
                            </button>
                        )}
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
                                const turnoConfig = isAdicionales ? getPlanillaConfig(sectorSeleccionado, turnoSeleccionado) : null;
                                const adicionalPuestoOpciones = turnoConfig?.puestos.map(p => p.nombre) ?? [];

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

                                    {(expanded.includes(seccion) || !isAdicionales) && (<>

                                        {/* ── MOBILE CARDS ── */}
                                        <div className="mobile-view">
                                            {asistencia[seccion].map((row, idx) => {
                                                const hasWorker = !!(row.funcionario_id || (row.isManual && row.nombre) || row.planificado);
                                                return (
                                                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem', marginBottom: '0.75rem', backgroundColor: row.asistio === 1 ? '#f0fdf4' : row.asistio === 0 ? '#fef2f2' : '#fff' }}>
                                                    {/* Puesto + Asistió */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            {(showPuestoCol || isAdicionales) && (
                                                                isAdicionales ? (
                                                                    adicionalPuestoOpciones.length > 0 ? (
                                                                        <select value={row.puesto || ''} onChange={e => { updateRow(seccion, idx, { puesto: e.target.value }); if (hasWorker) saveRowWithData(seccion, idx, { ...asistencia[seccion][idx], puesto: e.target.value }); }} style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', border: 'none', background: 'transparent', outline: 'none', maxWidth: '100%' }}>
                                                                            <option value="">— Puesto —</option>
                                                                            {adicionalPuestoOpciones.map(p => <option key={p} value={p}>{p}</option>)}
                                                                        </select>
                                                                    ) : (
                                                                        <input value={row.puesto || ''} placeholder="Puesto..." onChange={e => updateRow(seccion, idx, { puesto: e.target.value })} onBlur={e => { if (hasWorker) saveRowWithData(seccion, idx, { ...row, puesto: e.target.value }); }} style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', border: 'none', borderBottom: '1px solid #cbd5e1', background: 'transparent', outline: 'none', width: '100%' }} />
                                                                    )
                                                                ) : (
                                                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase' }}>{row.puesto}</span>
                                                                )
                                                            )}
                                                        </div>
                                                        {/* Asistió toggle */}
                                                        {hasWorker && !readOnly && (
                                                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                                                <button type="button" onClick={() => handleAsistioToggle(seccion, idx, 1)} style={{ padding: '0.3rem 0.6rem', background: row.asistio === 1 ? '#16a34a' : '#f1f5f9', color: row.asistio === 1 ? '#fff' : '#475569', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                    <Check size={13}/> Sí
                                                                </button>
                                                                <button type="button" onClick={() => handleAsistioToggle(seccion, idx, 0)} style={{ padding: '0.3rem 0.6rem', background: row.asistio === 0 ? '#dc2626' : '#f1f5f9', color: row.asistio === 0 ? '#fff' : '#475569', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                    <XCircle size={13}/> No
                                                                </button>
                                                            </div>
                                                        )}
                                                        {hasWorker && readOnly && (
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: row.asistio === 1 ? '#16a34a' : row.asistio === 0 ? '#dc2626' : '#94a3b8' }}>
                                                                {row.asistio === 1 ? '✓ Asistió' : row.asistio === 0 ? '✗ Ausente' : '—'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Funcionario */}
                                                    <div style={{ marginBottom: '0.6rem' }}>
                                                        {row.planificado ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1d3461' }}>{row.nombre}</span>
                                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e40af', background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>PLAN.</span>
                                                                {row.cedula && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>CI {row.cedula}</span>}
                                                            </div>
                                                        ) : row.isManual ? (
                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                <input value={row.nombre} placeholder="Nombre y apellido" onChange={e => updateRow(seccion, idx, { nombre: e.target.value })} onBlur={e => { if (e.target.value) saveRowWithData(seccion, idx, { ...row, nombre: e.target.value }); }} style={{ flex: 1, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #cbd5e1', background: 'transparent', fontSize: '0.88rem', fontWeight: 600, outline: 'none', color: '#1d3461' }} />
                                                                <input value={row.cedula} placeholder="CI" onChange={e => updateRow(seccion, idx, { cedula: e.target.value })} onBlur={e => { if (row.nombre) saveRowWithData(seccion, idx, { ...row, cedula: e.target.value }); }} style={{ width: '90px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #cbd5e1', background: 'transparent', fontSize: '0.85rem', outline: 'none' }} />
                                                            </div>
                                                        ) : readOnly ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1d3461' }}>{row.nombre || '—'}</span>
                                                                {row.cedula && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>CI {row.cedula}</span>}
                                                            </div>
                                                        ) : (
                                                            <FuncionarioSearchSelect funcionarios={funcionarios} value={row.funcionario_id} onChange={(id) => handleWorkerSelect(seccion, idx, id)} cliente={clienteSeleccionado} />
                                                        )}
                                                    </div>

                                                    {/* Horarios: 4 campos en fila */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                                        {(['entrada1','salida1','entrada2','salida2'] as const).map((field, fi) => (
                                                            <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
                                                                <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{['Ent.','Sal.','Ent.2','Sal.2'][fi]}</span>
                                                                {!readOnly ? (
                                                                    <select value={row[field] || ''} onChange={e => { updateRow(seccion, idx, { [field]: e.target.value }); saveRowWithData(seccion, idx, { ...asistencia[seccion][idx], [field]: e.target.value }); }} style={{ fontSize: '0.82rem', fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.2rem 0.25rem', background: '#f8fafc', outline: 'none', width: '72px', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }}>
                                                                        {timeOptions.map(t => <option key={t} value={t}>{t || '--:--'}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{row[field] || '--:--'}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Actions */}
                                                    {!readOnly && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
                                                            {/* Firma */}
                                                            {row.firma ? (
                                                                <img src={row.firma} alt="Firma" onClick={() => { if (!row.isSaved) setShowSignature({ section: seccion, index: idx }); }} style={{ maxHeight: '28px', cursor: row.isSaved ? 'default' : 'pointer' }} />
                                                            ) : (
                                                                <button onClick={() => setShowSignature({ section: seccion, index: idx })} disabled={!hasWorker} style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', opacity: hasWorker ? 1 : 0.4 }}>
                                                                    <PenTool size={13} /> Firmar
                                                                </button>
                                                            )}
                                                            {/* Manual toggle */}
                                                            <button onClick={() => updateRow(seccion, idx, { isManual: !row.isManual, funcionario_id: null, nombre: '', cedula: '', firma: null, isSaved: false })} title={row.isManual ? 'Usar lista' : 'Ingresar manual'} style={{ background: row.isManual ? '#dbeafe' : '#f1f5f9', border: `1px solid ${row.isManual ? '#93c5fd' : '#cbd5e1'}`, borderRadius: '6px', cursor: 'pointer', color: row.isManual ? '#1d3461' : '#475569', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center' }}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                            </button>
                                                            {/* Guardar */}
                                                            {!row.isSaved && hasWorker && (
                                                                <button onClick={() => saveRow(seccion, idx)} disabled={saving === `${seccion}-${idx}`} style={{ background: 'none', border: 'none', color: '#1d3461', cursor: 'pointer', padding: '0.3rem' }} title="Guardar">
                                                                    <Save size={16} />
                                                                </button>
                                                            )}
                                                            {row.isSaved && (
                                                                <button onClick={() => saveRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#22c55e', padding: '0.3rem' }} title="Actualizar">
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                            )}
                                                            {/* Borrar solo en ADICIONALES */}
                                                            {isAdicionales && (
                                                                <button onClick={() => removeRow(seccion, idx)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem' }} title="Eliminar">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                            {isAdicionales && !readOnly && (
                                                <button onClick={() => addRow(seccion)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '0.6rem 1rem', width: '100%', justifyContent: 'center' }}>
                                                    <Plus size={15} /> Agregar funcionario
                                                </button>
                                            )}
                                        </div>

                                        {/* ── DESKTOP TABLE ── */}
                                        <div className="desktop-view scroll-container">
                                            <table style={{ width: '100%', minWidth: (showPuestoCol || isAdicionales) ? '880px' : '800px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#fff', borderBottom: '2px solid #000' }}>
                                                        {(showPuestoCol || isAdicionales) && <th style={{ width: '110px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Puesto</th>}
                                                        <th style={{ width: '110px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Cédula</th>
                                                        <th style={{ width: '200px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Nombre y Apellido</th>
                                                        <th style={{ width: '95px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Asistió</th>
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
                                                            {/* Puesto column */}
                                                            {showPuestoCol && !isAdicionales && (
                                                                <td style={{ padding: '0.4rem' }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase' }}>{row.puesto}</span>
                                                                </td>
                                                            )}
                                                            {isAdicionales && (
                                                                <td style={{ padding: '0.4rem' }}>
                                                                    {adicionalPuestoOpciones.length > 0 ? (
                                                                        <>
                                                                            <select
                                                                                className="no-print"
                                                                                value={row.puesto || ''}
                                                                                onChange={e => { updateRow(seccion, idx, { puesto: e.target.value }); if (row.funcionario_id || (row.isManual && row.nombre)) saveRowWithData(seccion, idx, { ...asistencia[seccion][idx], puesto: e.target.value }); }}
                                                                                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.75rem', fontWeight: 800, outline: 'none', color: '#1d3461', cursor: 'pointer', textTransform: 'uppercase' }}
                                                                            >
                                                                                <option value="">-- Puesto --</option>
                                                                                {adicionalPuestoOpciones.map(p => <option key={p} value={p}>{p}</option>)}
                                                                            </select>
                                                                            <span className="print-only" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase' }}>{row.puesto || ''}</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <input className="no-print" value={row.puesto || ''} placeholder="Puesto..." onChange={e => updateRow(seccion, idx, { puesto: e.target.value })} onBlur={e => { if (row.funcionario_id || (row.isManual && row.nombre)) saveRowWithData(seccion, idx, { ...row, puesto: e.target.value }); }} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.75rem', fontWeight: 800, outline: 'none', color: '#1d3461', textTransform: 'uppercase' }} />
                                                                            <span className="print-only" style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase' }}>{row.puesto || ''}</span>
                                                                        </>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {/* Cédula */}
                                                            <td style={{ padding: '0.4rem' }}>
                                                                {row.isManual ? (
                                                                    <>
                                                                        <input className="no-print" value={row.cedula} placeholder="Cédula" onChange={e => updateRow(seccion, idx, { cedula: e.target.value })} onBlur={e => { const nombre = row.nombre; if (nombre) saveRowWithData(seccion, idx, { ...row, cedula: e.target.value }); }} style={{ width: '100%', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #cbd5e1', background: 'transparent', fontSize: '0.8rem', fontWeight: 500, outline: 'none' }} />
                                                                        <span className="print-only" style={{ fontSize: '0.8rem' }}>{row.cedula}</span>
                                                                    </>
                                                                ) : (
                                                                    <input readOnly value={row.cedula} placeholder="" style={{ width: '100%', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 500, outline: 'none' }} />
                                                                )}
                                                            </td>
                                                            {/* Nombre */}
                                                            <td style={{ padding: '0.4rem' }}>
                                                                {row.planificado ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d3461' }}>{row.nombre}</span>
                                                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e40af', background: '#dbeafe', padding: '0.05rem 0.3rem', borderRadius: '3px', width: 'fit-content', letterSpacing: '0.04em' }}>PLANIFICADO</span>
                                                                    </div>
                                                                ) : row.isManual ? (
                                                                    <>
                                                                        <input className="no-print" value={row.nombre} placeholder="Nombre y apellido" onChange={e => updateRow(seccion, idx, { nombre: e.target.value })} onBlur={e => { const val = e.target.value; if (val) saveRowWithData(seccion, idx, { ...row, nombre: val }); }} style={{ width: '100%', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #cbd5e1', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: '#1d3461' }} />
                                                                        <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{row.nombre || '..........................................'}</span>
                                                                    </>
                                                                ) : readOnly ? (
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d3461' }}>{row.nombre || '..........................................'}</span>
                                                                ) : (
                                                                    <>
                                                                        <div className="no-print" style={{ width: '100%' }}>
                                                                            <FuncionarioSearchSelect
                                                                                funcionarios={funcionarios}
                                                                                value={row.funcionario_id}
                                                                                onChange={(id) => handleWorkerSelect(seccion, idx, id)}
                                                                                cliente={clienteSeleccionado}
                                                                            />
                                                                        </div>
                                                                        <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{row.nombre || '..........................................'}</span>
                                                                    </>
                                                                )}
                                                            </td>
                                                            {/* Asistió toggle */}
                                                            <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                {(row.planificado || row.funcionario_id || (row.isManual && row.nombre)) && !readOnly ? (
                                                                    <div className="no-print" style={{ display: 'inline-flex', gap: '0.3rem' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAsistioToggle(seccion, idx, 1)}
                                                                            style={{ padding: '0.2rem 0.4rem', background: row.asistio === 1 ? '#16a34a' : '#f1f5f9', color: row.asistio === 1 ? '#fff' : '#475569', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                                                            title="Marcar asistió — requerirá firma"
                                                                        >
                                                                            <Check size={11}/> Sí
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAsistioToggle(seccion, idx, 0)}
                                                                            style={{ padding: '0.2rem 0.4rem', background: row.asistio === 0 ? '#dc2626' : '#f1f5f9', color: row.asistio === 0 ? '#fff' : '#475569', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                                                            title="Marcar ausente"
                                                                        >
                                                                            <XCircle size={11}/> No
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                                <span className="print-only" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                                                    {row.asistio === 1 ? 'SÍ' : row.asistio === 0 ? 'NO' : '—'}
                                                                </span>
                                                            </td>
                                                            {(['entrada1', 'salida1', 'entrada2', 'salida2'] as const).map(field => (
                                                                <td key={field} style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                    {!readOnly ? (
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
                                                                    ) : (
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{row[field] || '--:--'}</span>
                                                                    )}
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
                                                                            onClick={() => { if (!readOnly && !row.isSaved) setShowSignature({ section: seccion, index: idx }); }}
                                                                            style={{ maxHeight: '35px', cursor: (readOnly || row.isSaved) ? 'default' : 'pointer' }}
                                                                        />
                                                                    ) : !readOnly ? (
                                                                        <button
                                                                            className="no-print"
                                                                            onClick={() => setShowSignature({ section: seccion, index: idx })}
                                                                            disabled={!row.funcionario_id && !row.isManual}
                                                                            style={{ padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem' }}
                                                                        >
                                                                            <PenTool size={12} /> Firmar
                                                                        </button>
                                                                    ) : null}
                                                                    {!readOnly && <div className="no-print" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                                                        <button
                                                                                onClick={() => updateRow(seccion, idx, { isManual: !row.isManual, funcionario_id: null, nombre: '', cedula: '', firma: null, isSaved: false })}
                                                                                title={row.isManual ? 'Usar lista de funcionarios' : 'Ingresar manualmente'}
                                                                                style={{ background: row.isManual ? '#dbeafe' : '#f1f5f9', border: `1px solid ${row.isManual ? '#93c5fd' : '#cbd5e1'}`, borderRadius: '4px', cursor: 'pointer', color: row.isManual ? '#1d3461' : '#475569', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                                            </button>
                                                                        {!row.isSaved && !!(row.funcionario_id || (row.isManual && row.nombre)) && (
                                                                            <button onClick={() => saveRow(seccion, idx)} disabled={saving === `${seccion}-${idx}`} style={{ background: 'none', border: 'none', color: '#1d3461', cursor: 'pointer' }} title="Guardar fila">
                                                                                <Save size={16} />
                                                                            </button>
                                                                        )}
                                                                        {row.isSaved && (
                                                                            <button onClick={() => saveRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#22c55e' }} title="Actualizar">
                                                                                <CheckCircle2 size={16} />
                                                                            </button>
                                                                        )}
                                                                        {isAdicionales && (
                                                                            <button onClick={() => removeRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Eliminar fila">
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>}
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
                                    </>)}
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
                        const { section, index, pendingAsistio } = showSignature;
                        const extra = pendingAsistio !== undefined ? { asistio: pendingAsistio } : {};
                        updateRow(section, index, { firma: sig, ...extra });
                        setShowSignature(null);
                        const currentRow = { ...asistencia[section][index], firma: sig, ...extra };
                        await saveRowWithData(section, index, currentRow);
                    }}
                />
            )}

            {showUpload && (
                <div className="no-print" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '12px', maxWidth: previewSheets ? '900px' : '520px', width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1d3461', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Upload size={18}/> {previewSheets ? 'Preview de importación' : 'Subir planilla del turno'}
                            </h2>
                            <button onClick={resetUploadModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20}/></button>
                        </div>

                        {!previewSheets ? (
                            // ── Paso 1: elegir archivo ────────────────────────────────────────
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#1d3461' }}>
                                    <strong>Fecha:</strong> {fecha} &nbsp; <strong>Cliente:</strong> {clienteSeleccionado || '—'}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Archivo del Panel de control (Mitrabajo)</label>
                                    <input type="file" accept=".xlsx,.xls" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ width: '100%' }} />
                                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
                                        Excel con columnas <strong>Fecha</strong>, <strong>Local</strong>, <strong>CI</strong>, <strong>Nombre</strong>, <strong>Entrada/Salida planificada</strong>. El sistema cruza cada fila contra el mapeo <strong>Lugar en sistema</strong> configurado en el Editor de Planillas del cliente <strong>{clienteSeleccionado || '—'}</strong>. Los registros de otros locales o sin mapeo <strong>se descartan</strong>.
                                    </p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Categoría por defecto (opcional)</label>
                                    <select value={uploadCategoria} onChange={e => setUploadCategoria(e.target.value as any)} style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.82rem' }}>
                                        <option value="">-- Sin categoría --</option>
                                        <option value="LIMPIADOR">LIMPIADOR</option>
                                        <option value="AUXILIAR">AUXILIAR</option>
                                        <option value="VIDRIERO">VIDRIERO</option>
                                        <option value="ENCARGADO">ENCARGADO</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button onClick={resetUploadModal} style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancelar</button>
                                    <button onClick={handleParsePreview} disabled={parsingPreview || !uploadFile} style={{ padding: '0.55rem 1rem', border: 'none', borderRadius: '8px', background: '#1d3461', color: '#fff', cursor: parsingPreview || !uploadFile ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: parsingPreview || !uploadFile ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {parsingPreview ? 'Analizando...' : 'Ver preview →'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // ── Paso 2: preview con mapeo hoja→sector ─────────────────────────
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#1d3461' }}>
                                    <strong>Cliente:</strong> {clienteSeleccionado || '—'} &nbsp; <strong>Modo:</strong> {previewMode === 'crossed' ? 'Cruzado (plantilla + panel)' : 'Solo plantilla'} &nbsp; <strong>Filas a importar:</strong> {previewSheets.reduce((sum, s) => sum + s.rows.length, 0)}
                                    {previewMode === 'template' && <span> &nbsp; <strong>Fecha:</strong> {fecha}</span>}
                                </div>
                                {panelStats && (
                                    <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#78350f' }}>
                                        <div>
                                            <strong>Panel de control:</strong> {panelStats.panel_total} filas leídas · <span style={{ color: '#15803d', fontWeight: 600 }}>{panelStats.matched} cruzadas</span> · <span style={{ color: '#b91c1c', fontWeight: 600 }}>{panelStats.discarded} descartadas</span>
                                        </div>
                                        {panelStats.fechas_detectadas.length > 0 && (
                                            <div style={{ marginTop: '0.25rem' }}>
                                                <strong>Fechas detectadas:</strong> {panelStats.fechas_detectadas.join(', ')}
                                            </div>
                                        )}
                                        {panelStats.discarded_samples.length > 0 && (
                                            <details style={{ marginTop: '0.3rem' }}>
                                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ejemplos de locales descartados ({panelStats.discarded_samples.length} de {panelStats.discarded})</summary>
                                                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.3rem' }}>
                                                    {panelStats.discarded_samples.map((d, i) => <li key={i}>{d}</li>)}
                                                </ul>
                                            </details>
                                        )}
                                    </div>
                                )}
                                {previewSheets.map(sheet => {
                                    const sectoresDisponibles = getSectoresForCliente(clienteSeleccionado || '');
                                    return (
                                        <div key={sheet.name} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#1d3461', fontSize: '0.88rem' }}>
                                                        Hoja: {sheet.name}
                                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>({sheet.rows.length} fila{sheet.rows.length !== 1 ? 's' : ''})</span>
                                                    </div>
                                                    {sheet.missing_headers.length > 0 && (
                                                        <div style={{ color: '#b91c1c', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                                                            ⚠ No se encontraron columnas requeridas ({sheet.missing_headers.join(', ')})
                                                        </div>
                                                    )}
                                                </div>
                                                {sheet.rows.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <label style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 600 }}>Sector destino:</label>
                                                        <select
                                                            value={sheetSectorMap[sheet.name] || ''}
                                                            onChange={e => setSheetSectorMap(m => ({ ...m, [sheet.name]: e.target.value }))}
                                                            style={{ padding: '0.3rem 0.55rem', borderRadius: '6px', border: `1px solid ${sheetSectorMap[sheet.name] ? '#cbd5e1' : '#fca5a5'}`, fontSize: '0.8rem', minWidth: '160px' }}
                                                        >
                                                            <option value="">-- Elegir --</option>
                                                            {sectoresDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                            {sheet.rows.length > 0 && (() => {
                                                // Agrupar filas por turno dentro de la hoja
                                                const byTurno = new Map<string, ParsedRow[]>();
                                                for (const r of sheet.rows) {
                                                    const t = r.turno || '(sin turno)';
                                                    if (!byTurno.has(t)) byTurno.set(t, []);
                                                    byTurno.get(t)!.push(r);
                                                }
                                                const turnosOrdenados = [...byTurno.keys()].sort();
                                                return (
                                                    <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #f1f5f9', borderRadius: '6px' }}>
                                                        {turnosOrdenados.map(turno => {
                                                            const rowsTurno = byTurno.get(turno)!;
                                                            return (
                                                                <div key={turno} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                    <div style={{ background: '#e0f2fe', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#075985', position: 'sticky', top: 0, borderBottom: '1px solid #bae6fd' }}>
                                                                        Turno {turno} <span style={{ color: '#0369a1', fontWeight: 500, marginLeft: '0.35rem' }}>({rowsTurno.length} {rowsTurno.length === 1 ? 'fila' : 'filas'})</span>
                                                                    </div>
                                                                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                                        <thead style={{ background: '#f8fafc' }}>
                                                                            <tr>
                                                                                <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Puesto</th>
                                                                                <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Funcionario</th>
                                                                                <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Frec.</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {rowsTurno.map((row, idx) => (
                                                                                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                                                    <td style={{ padding: '0.3rem 0.5rem', color: '#1e293b' }}>{row.lugar_planilla}</td>
                                                                                    <td style={{ padding: '0.3rem 0.5rem', color: row.funcionario_nombre ? '#1e293b' : '#94a3b8' }}>
                                                                                        {row.funcionario_nombre || '(vacío)'}
                                                                                        {row.funcionario_cedula && <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>· CI {row.funcionario_cedula}</span>}
                                                                                    </td>
                                                                                    <td style={{ padding: '0.3rem 0.5rem', color: '#64748b' }}>{row.frecuencia || '—'}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    <button onClick={() => { setPreviewSheets(null); setSheetSectorMap({}); }} style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>← Cambiar archivo</button>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={resetUploadModal} style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancelar</button>
                                        <button onClick={handleConfirmImport} disabled={importing} style={{ padding: '0.55rem 1rem', border: 'none', borderRadius: '8px', background: '#16a34a', color: '#fff', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: importing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Upload size={14}/>{importing ? 'Importando...' : 'Confirmar importación'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
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
                    tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .scroll-container {
                        overflow: visible !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .mobile-view {
                        display: none !important;
                    }
                    .desktop-view {
                        display: block !important;
                    }
                    img {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        max-width: 100%;
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
                    .informes-main {
                        padding: 0.75rem !important;
                    }
                }
            `}</style>
        </div>
    );
}
