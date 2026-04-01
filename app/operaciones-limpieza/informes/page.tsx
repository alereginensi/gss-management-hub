'use client'; 

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    ArrowLeft, FileText, Plus, Save, Download, 
    Trash2, User, Clock, PenTool, CheckCircle2,
    Calendar, ChevronDown, ChevronUp, Printer, LogOut,
    Building2
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

const SECCIONES = ['6 A 14', '14 A 22', 'ADICIONALES'];

export default function InformesOperativosPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();

    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('Todos');
    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [clientes, setClientes] = useState<string[]>([]);
    const [asistencia, setAsistencia] = useState<SeccionesAsistencia>({
        '6 A 14': [],
        '14 A 22': [],
        'ADICIONALES': []
    });
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

    const fetchAsistencia = useCallback(async (date: string, client: string) => {
        setFetching(true);
        try {
            const clientQuery = client !== 'Todos' ? `&cliente=${encodeURIComponent(client)}` : '';
            const res = await fetch(`/api/limpieza/asistencia?fecha=${date}${clientQuery}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const newAsistencia: SeccionesAsistencia = {
                    '6 A 14': [],
                    '14 A 22': [],
                    'ADICIONALES': []
                };
                
                data.forEach((row: any) => {
                    if (newAsistencia[row.seccion]) {
                        newAsistencia[row.seccion].push({
                            ...row,
                            isSaved: true
                        });
                    }
                });

                // Ensure at least one empty row if none exists
                SECCIONES.forEach(sec => {
                    if (newAsistencia[sec].length === 0) {
                        newAsistencia[sec].push(createEmptyRow());
                    }
                });

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
        if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'limpieza')) {
            fetchAsistencia(fecha, clienteSeleccionado);
        }
    }, [isAuthenticated, currentUser, fecha, clienteSeleccionado, fetchAsistencia]);

    const createEmptyRow = (): AsistenciaRow => ({
        funcionario_id: null,
        nombre: '',
        cedula: '',
        cliente: clienteSeleccionado !== 'Todos' ? clienteSeleccionado : '',
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

    const removeRow = (section: string, index: number) => {
        setAsistencia(prev => ({
            ...prev,
            [section]: prev[section].filter((_, i) => i !== index)
        }));
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
                    cliente: row.cliente || clienteSeleccionado
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
        const clientName = clienteSeleccionado === 'Todos' ? 'General' : clienteSeleccionado;
        // Set document title temporarily to influence the PDF filename
        document.title = `Reporte_Operacional_${fecha}_${clientName.replace(/\s+/g, '_')}`;
        
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        {/* Cliente Filter */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1d3461', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Cliente</span>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <select
                                    value={clienteSeleccionado}
                                    onChange={e => setClienteSeleccionado(e.target.value)}
                                    style={{
                                        padding: '0.55rem 0.75rem', borderRadius: '8px',
                                        border: '2px solid #1d3461', fontSize: '0.875rem',
                                        backgroundColor: 'white', color: '#111827', cursor: 'pointer',
                                        fontWeight: 600, width: '100%'
                                    }}
                                >
                                    <option value="Todos">-- Seleccionar Cliente --</option>
                                    {clientes.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Fecha Filter */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginLeft: '0.2rem' }}>Fecha</span>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                    type="date" 
                                    value={fecha} 
                                    onChange={e => setFecha(e.target.value)}
                                    style={{
                                        padding: '0.55rem 0.75rem', borderRadius: '8px',
                                        border: '1px solid #d1d5db', fontSize: '0.875rem',
                                        backgroundColor: 'white', color: '#111827', cursor: 'pointer', width: '100%', boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handlePrint}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                padding: '0.55rem 1rem', backgroundColor: '#fff',
                                border: '1px solid #d1d5db', borderRadius: '8px',
                                fontSize: '0.875rem', fontWeight: 650, color: '#111827', cursor: 'pointer',
                                minHeight: '38px', transition: 'all 0.2s', width: '100%', boxSizing: 'border-box'
                            }}
                        >
                            <Printer size={16} /> <span className="mobile-only-flex">Descargar PDF</span><span className="mobile-hide">Imprimir PDF</span>
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
                                {clienteSeleccionado !== 'Todos' && (
                                    <p style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 700, margin: '0.1rem 0 0 0' }}>CLIENTE: {clienteSeleccionado}</p>
                                )}
                            </div>
                        </div>
                        <div style={{ border: '2px solid #000', padding: '0.5rem 1rem', borderRadius: '4px', textAlign: 'center', flexShrink: 0, minWidth: '120px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '0.15rem', textTransform: 'uppercase' }}>Fecha del Reporte</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#111827' }}>{fecha.split('-').reverse().join('/')}</div>
                        </div>
                    </div>

                    {fetching ? (
                        <div style={{ padding: '5rem', textAlign: 'center', color: '#64748b' }}>Cargando datos del día...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {SECCIONES.map(seccion => (
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

                                    {(expanded.includes(seccion) || seccion !== 'ADICIONALES') && (
                                        <div className="scroll-container">
                                            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#fff', borderBottom: '2px solid #000' }}>
                                                        <th style={{ width: '120px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Cédula</th>
                                                        <th style={{ width: '220px', padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Nombre y Apellido</th>
                                                        <th style={{ width: '70px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Ent.</th>
                                                        <th style={{ width: '70px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Sal.</th>
                                                        <th style={{ width: '70px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Ent.</th>
                                                        <th style={{ width: '70px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Sal.</th>
                                                        <th style={{ width: '140px', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Firma</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {asistencia[seccion].map((row, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
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
                                                                {/* Shown on print instead of select */}
                                                                <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{row.nombre || '..........................................'}</span>
                                                            </td>
                                                            {['entrada1', 'salida1', 'entrada2', 'salida2'].map(field => {
                                                                // Generate time options based on section
                                                                const getTimeOptions = (sec: string) => {
                                                                    const times = [''];
                                                                    let start = 6, end = 22;
                                                                    
                                                                    if (sec === '6 A 14') { start = 5; end = 15; }
                                                                    else if (sec === '14 A 22') { start = 13; end = 23; }
                                                                    else if (sec === 'ADICIONALES') { start = 6; end = 22; }

                                                                    for (let h = start; h <= end; h++) {
                                                                        const hh = h.toString().padStart(2, '0');
                                                                        times.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`);
                                                                    }
                                                                    return times;
                                                                };

                                                                const options = getTimeOptions(seccion);

                                                                return (
                                                                    <td key={field} style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                        <select 
                                                                            className="no-print"
                                                                            value={row[field as keyof AsistenciaRow] as string || ''} 
                                                                            onChange={e => {
                                                                                updateRow(seccion, idx, { [field]: e.target.value });
                                                                                // Auto-save on change for selects
                                                                                const updatedRow = { ...asistencia[seccion][idx], [field]: e.target.value };
                                                                                saveRowWithData(seccion, idx, updatedRow);
                                                                            }}
                                                                            style={{ 
                                                                                width: '100%', border: 'none', background: 'transparent', 
                                                                                textAlign: 'center', fontSize: '0.8rem', outline: 'none',
                                                                                fontWeight: 700, appearance: 'none', cursor: 'pointer'
                                                                            }} 
                                                                        >
                                                                            {options.map(t => (
                                                                                <option key={t} value={t}>{t || '--:--'}</option>
                                                                            ))}
                                                                        </select>
                                                                        {/* Shown on print */}
                                                                        <span className="print-only" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                                                            {row[field as keyof AsistenciaRow] as string || '--:--'}
                                                                        </span>
                                                                    </td>
                                                                );
                                                            })}
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
                                                                            style={{
                                                                                padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', 
                                                                                backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer',
                                                                                color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem'
                                                                            }}
                                                                        >
                                                                            <PenTool size={12} /> Firmar
                                                                        </button>
                                                                    )}
                                                                    
                                                                    <div className="no-print" style={{ display: 'flex', gap: '0.2rem' }}>
                                                                        {!row.isSaved && row.funcionario_id && (
                                                                            <button 
                                                                                onClick={() => saveRow(seccion, idx)}
                                                                                disabled={saving === `${seccion}-${idx}`}
                                                                                style={{ 
                                                                                    background: 'none', border: 'none', color: '#1d3461', cursor: 'pointer' 
                                                                                }}
                                                                                title="Guardar fila"
                                                                            >
                                                                                <Save size={16} />
                                                                            </button>
                                                                        )}
                                                                        {row.isSaved && (
                                                                            <button onClick={() => saveRow(seccion, idx)} style={{ background: 'none', border: 'none', color: '#22c55e' }} title="Actualizar">
                                                                                <CheckCircle2 size={16} />
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            onClick={() => removeRow(seccion, idx)}
                                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button 
                                                className="no-print"
                                                onClick={() => addRow(seccion)}
                                                style={{ 
                                                    marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                    backgroundColor: 'transparent', border: 'none', color: '#64748b',
                                                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '0.3rem'
                                                }}
                                            >
                                                <Plus size={14} /> Agregar funcionario
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showSignature && (
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
