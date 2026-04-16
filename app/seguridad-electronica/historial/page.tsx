'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, X, LogOut } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import type * as ExcelJS from 'exceljs';

interface SecurityRecord {
    id: number;
    type: string;
    report_datetime: string | null;
    end_datetime: string | null;
    client: string | null;
    branch: string | null;
    supervisor: string | null;
    technician: string | null;
    record_type: string | null;
    security_event: string | null;
    mobile_intervention: string | null;
    affected_system: string | null;
    record_detail: string | null;
    event_classification: string | null;
    public_force: number;
    complaint_number: string | null;
    created_by: string | null;
    created_at: string;
}

function formatDate(dt: string | null): string {
    if (!dt) return '—';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString('es-UY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DetailModal({ record, tipo, onClose }: { record: SecurityRecord; tipo: string; onClose: () => void }) {
    const isMantenimiento = tipo === 'mantenimiento';

    const Field = ({ label, value }: { label: string; value: string | null | undefined }) =>
        value ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{value}</span>
            </div>
        ) : null;

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Modal header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--surface-color)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                            {isMantenimiento ? 'Mantenimiento Correctivo/Preventivo' : 'Registro de Monitoreo'}
                        </h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(record.report_datetime || record.created_at)}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Modal body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {isMantenimiento ? (
                        <>
                            <Field label="Fecha y Hora de Entrada" value={formatDate(record.report_datetime)} />
                            <Field label="Cliente" value={record.client} />
                            <Field label="Sucursal - Dirección" value={record.branch} />
                            <Field label="Tipo de Plan" value={record.record_type} />
                            <Field label="Plan Correctivo - Equipos Intervenidos" value={record.affected_system} />
                            <Field label="Plan Preventivo - Equipos Previstos" value={record.security_event} />
                            <Field label="Descripción de acciones" value={record.record_detail} />
                            <Field label="Técnico Responsable" value={record.technician} />
                            <Field label="Observaciones" value={record.event_classification} />
                            <Field label="Fecha y Hora de Salida" value={formatDate(record.end_datetime)} />
                        </>
                    ) : (
                        <>
                            <Field label="Fecha y Hora del Reporte" value={formatDate(record.report_datetime)} />
                            <Field label="Cliente" value={record.client} />
                            <Field label="Sucursal - Dirección" value={record.branch} />
                            <Field label="Supervisor" value={record.supervisor} />
                            <Field label="Técnico" value={record.technician} />
                            <Field label="Tipo de Registro" value={record.record_type} />
                            <Field label="Evento de Seguridad" value={record.security_event} />
                            <Field label="Intervención Móvil" value={record.mobile_intervention} />
                            <Field label="Sistema Afectado" value={record.affected_system} />
                            <Field label="Detalle del Registro" value={record.record_detail} />
                            <Field label="Clasificación de Evento" value={record.event_classification} />
                            {record.public_force ? <Field label="N° de Denuncia" value={record.complaint_number || 'Sí'} /> : null}
                            <Field label="Fecha y Hora Final" value={formatDate(record.end_datetime)} />
                        </>
                    )}
                    <Field label="Registrado por" value={record.created_by} />
                </div>
            </div>
        </div>
    );
}

function HistorialContent() {
    const { getAuthHeaders, isAuthenticated, logout } = useTicketContext();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tipo = searchParams?.get('tipo') || 'monitoreo';

    const [records, setRecords] = useState<SecurityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SecurityRecord | null>(null);

    const { currentUser } = useTicketContext();

    useEffect(() => {
        if (isAuthenticated === false) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'tecnico')) router.push('/');
    }, [isAuthenticated, currentUser, router]);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/seguridad-electronica?type=${tipo}`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(data => setRecords(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [tipo]);

    const handleExport = async () => {
        const Excel = (await import('exceljs')).default;
        const workbook = new Excel.Workbook();
        const sheet = workbook.addWorksheet(tipo === 'mantenimiento' ? 'Mantenimiento' : 'Monitoreo');

        const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF29416B' } };
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            fill: headerFill,
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };
        const cellStyle: Partial<ExcelJS.Style> = {
            alignment: { vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        const cols = tipo === 'mantenimiento' ? [
            { header: 'Fecha y Hora de Entrada', key: 'report_datetime', width: 22 },
            { header: 'Cliente',                 key: 'client',          width: 25 },
            { header: 'Sucursal / Dirección',    key: 'branch',          width: 28 },
            { header: 'Tipo de Plan',            key: 'record_type',     width: 22 },
            { header: 'Plan Correctivo - Equipos Intervenidos', key: 'affected_system', width: 35 },
            { header: 'Plan Preventivo - Equipos Previstos',    key: 'security_event',  width: 35 },
            { header: 'Descripción de acciones', key: 'record_detail',   width: 40 },
            { header: 'Técnico Responsable',     key: 'technician',      width: 25 },
            { header: 'Observaciones',           key: 'event_classification', width: 35 },
            { header: 'Fecha y Hora de Salida',  key: 'end_datetime',    width: 22 },
        ] : [
            { header: 'Fecha y Hora del Reporte', key: 'report_datetime',      width: 22 },
            { header: 'Cliente',                  key: 'client',               width: 25 },
            { header: 'Sucursal / Dirección',     key: 'branch',               width: 28 },
            { header: 'Supervisor',               key: 'supervisor',           width: 22 },
            { header: 'Técnico',                  key: 'technician',           width: 22 },
            { header: 'Tipo de Registro',         key: 'record_type',          width: 20 },
            { header: 'Evento de Seguridad',      key: 'security_event',       width: 28 },
            { header: 'Intervención Móvil',       key: 'mobile_intervention',  width: 22 },
            { header: 'Sistema Afectado',         key: 'affected_system',      width: 25 },
            { header: 'Detalle del Registro',     key: 'record_detail',        width: 40 },
            { header: 'Clasificación de Evento',  key: 'event_classification', width: 25 },
            { header: 'Fuerza Pública',           key: 'public_force',         width: 15 },
            { header: 'N° de Denuncia',           key: 'complaint_number',     width: 18 },
            { header: 'Fecha y Hora Final',       key: 'end_datetime',         width: 22 },
        ];

        sheet.columns = cols as any;

        // Style header row
        sheet.getRow(1).height = 32;
        sheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });

        // Add data rows
        records.forEach(r => {
            const row: Record<string, any> = {};
            cols.forEach(col => {
                const val = (r as any)[col.key];
                if (col.key === 'report_datetime' || col.key === 'end_datetime') {
                    row[col.key] = val ? formatDate(val) : '';
                } else if (col.key === 'public_force') {
                    row[col.key] = val ? 'Sí' : 'No';
                } else {
                    row[col.key] = val ?? '';
                }
            });
            const dataRow = sheet.addRow(row);
            dataRow.height = 18;
            dataRow.eachCell(cell => { cell.style = cellStyle; });
        });

        // Freeze header
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buf = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: `historial_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`
        });
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/seguridad-electronica" style={{ position: 'absolute', left: '1.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                    <ArrowLeft size={15} /> Inicio
                </Link>
                <div style={{ textAlign: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="GSS" style={{ height: '32px', display: 'block', margin: '0 auto 0.25rem' }} />
                    <h1 style={{ color: 'var(--primary-color)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                        Historial {tipo === 'monitoreo' ? 'Monitoreo' : 'Mantenimiento'}
                    </h1>
                </div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', marginLeft: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Tabs + Export */}
                <div style={{ width: '100%', maxWidth: '560px', padding: '1rem 1.5rem 0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {(['monitoreo', 'mantenimiento'] as const).map(t => (
                        <button key={t} onClick={() => router.push(`/seguridad-electronica/historial?tipo=${t}`)} className="btn"
                            style={{ backgroundColor: tipo === t ? 'var(--primary-color)' : 'var(--surface-color)', color: tipo === t ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            {t === 'monitoreo' ? 'Monitoreo' : 'Mantenimiento'}
                        </button>
                    ))}
                    <button onClick={handleExport} className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
                        Exportar CSV
                    </button>
                </div>

                {/* List */}
                <div style={{ width: '100%', maxWidth: '560px', padding: '1rem 1.5rem' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Cargando...</p>
                    ) : records.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No hay registros de {tipo}.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {records.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelected(r)}
                                    style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--surface-color)', transition: 'background-color 0.15s' }}
                                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                    onMouseOut={e => (e.currentTarget.style.backgroundColor = 'var(--surface-color)')}
                                >
                                    {/* Left accent */}
                                    <div style={{ width: '4px', backgroundColor: 'var(--primary-color)', flexShrink: 0, borderRadius: '2px 0 0 2px' }} />
                                    <div style={{ padding: '0.85rem 1rem', flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, marginBottom: '0.2rem' }}>
                                            {formatDate(r.report_datetime || r.created_at)}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {tipo === 'mantenimiento' ? (r.record_type || '—') : (r.security_event || r.record_type || '—')}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                                            {r.client || '—'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Volver button */}
                <div style={{ padding: '0.5rem 1.5rem 2rem' }}>
                    <Link href="/seguridad-electronica">
                        <button className="btn btn-secondary" style={{ minWidth: '120px' }}>Volver</button>
                    </Link>
                </div>
            </main>

            {selected && <DetailModal record={selected} tipo={tipo} onClose={() => setSelected(null)} />}

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}

export default function HistorialPage() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)' }}>Cargando...</div>}>
            <HistorialContent />
        </Suspense>
    );
}
