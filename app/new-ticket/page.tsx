"use client";

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { UploadCloud, CheckCircle, X, Users, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTicketContext, DEPARTMENTS } from '../context/TicketContext';
import { useRouter } from 'next/navigation';

interface TeamTask {
    userId: number;
    userName: string;
    task: string;
}

export default function NewTicket() {
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { addTicket, currentUser, isSidebarOpen, allUsers, fetchAllUsers, isMobile } = useTicketContext();
    const router = useRouter();

    // Team ticket state
    const [teamMode, setTeamMode] = useState(false);
    const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
    const [myTask, setMyTask] = useState('');

    // Multi-department selection
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        name: (currentUser?.id ?? 0) > 0 ? currentUser?.name : '',
        email: currentUser?.email || '',
        subject: '',
        description: '',
        priority: 'Media' as 'Alta' | 'Media' | 'Baja',
        affectedWorker: '',
        supervisor: '',
        location: '',
        sector: ''
    });
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if ((currentUser?.id ?? 0) > 0) {
            setFormData(prev => ({ ...prev, name: currentUser?.name || '' }));
        }
        if (currentUser?.email) {
            setFormData(prev => ({ ...prev, email: currentUser?.email || '' }));
        }
        // No pre-selection — user must choose explicitly
        if (currentUser?.role === 'supervisor' && currentUser?.name) {
            setFormData(prev => ({ ...prev, supervisor: currentUser.name }));
        }
        // Load all users for collaborator picker & team ticket builder
        const role = currentUser?.role;
        if (role === 'admin' || role === 'jefe' || role === 'supervisor') {
            fetchAllUsers();
        }
    }, [currentUser]);

    const toggleDept = (dept: string) => {
        setSelectedDepts(prev =>
            prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
        );
    };

    const addTeamMember = () => {
        setTeamTasks(prev => [...prev, { userId: 0, userName: '', task: '' }]);
    };

    const removeTeamMember = (idx: number) => {
        setTeamTasks(prev => prev.filter((_, i) => i !== idx));
    };

    const updateTeamMember = (idx: number, field: keyof TeamTask, value: string | number) => {
        setTeamTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    };

    const collaboratorUsers = allUsers.filter(u => {
        const r = u.role?.toLowerCase();
        return r === 'supervisor' || r === 'admin' || r === 'jefe';
    });

    const teamMemberUsers = collaboratorUsers.filter(u => u.id !== currentUser?.id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (!formData.name || !formData.email || selectedDepts.length === 0) {
            alert('Por favor completa todos los campos obligatorios (Nombre, Email, Departamento).');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Por favor ingresa un email válido.');
            return;
        }

        setSubmitting(true);

        try {
            const validationResponse = await fetch('/api/validate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            const validationData = await validationResponse.json();
            if (!validationData.valid) {
                alert('Por favor escribe una dirección de email válida');
                setSubmitting(false);
                return;
            }
        } catch (error) {
            console.error('Email validation error:', error);
        }

        if (currentUser && !currentUser.email) {
            currentUser.email = formData.email;
        }

        let attachmentUrls: string[] = [];
        if (files.length > 0) {
            const token = localStorage.getItem('authToken');
            for (const file of files) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);
                try {
                    const uploadRes = await fetch('/api/tickets/upload', {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: uploadFormData
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        attachmentUrls.push(uploadData.url);
                    } else {
                        const errText = await uploadRes.text();
                        console.error(`File upload failed (${uploadRes.status}):`, errText);
                        alert(`Error al subir "${file.name}": ${uploadRes.status} ${uploadRes.statusText}`);
                        setSubmitting(false);
                        return;
                    }
                } catch (error) {
                    console.error('Error uploading file:', error);
                    alert(`Error de red al subir "${file.name}". Revisá tu conexión.`);
                    setSubmitting(false);
                    return;
                }
            }
        }

        let finalAttachmentUrl = '';
        if (attachmentUrls.length > 0) {
            finalAttachmentUrl = JSON.stringify(attachmentUrls);
        }

        if (teamMode) {
            if (!myTask.trim()) {
                alert('Por favor ingresá tu tarea en el ticket de equipo.');
                setSubmitting(false);
                return;
            }
            const invalidMember = teamTasks.find(t => !t.userId || !t.task.trim());
            if (invalidMember) {
                alert('Por favor completá el colaborador y la tarea de cada integrante del equipo.');
                setSubmitting(false);
                return;
            }
        }

        const finalTeamTasks = teamMode && currentUser ? [
            { userId: currentUser.id, userName: currentUser.name, task: myTask },
            ...teamTasks
        ] : [];

        const departmentStr = selectedDepts.join(',');

        try {
            await addTicket({
                subject: formData.subject,
                description: formData.description,
                department: departmentStr,
                priority: formData.priority,
                status: 'Nuevo',
                requester: formData.name,
                requesterEmail: formData.email,
                affectedWorker: formData.affectedWorker,
                supervisor: formData.supervisor,
                attachmentUrl: finalAttachmentUrl,
                isTeamTicket: teamMode,
                teamTasks: finalTeamTasks
            } as any);
        } catch (error) {
            console.error('Error creating ticket:', error);
            alert('Error al crear el ticket. Intentá de nuevo.');
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
        setSubmitted(true);

        setTimeout(() => {
            router.push('/tickets');
        }, 2000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
        e.target.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const canPickCollaborator = currentUser?.role === 'admin' || currentUser?.role === 'jefe';
    const canUseTeamMode = currentUser?.role === 'admin' || currentUser?.role === 'jefe' || currentUser?.role === 'supervisor';

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title="Nuevo Ticket" />

                <div style={{ maxWidth: '800px' }}>
                    {submitted ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ color: 'var(--status-resolved)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                                <CheckCircle size={64} />
                            </div>
                            <h2 style={{ marginBottom: '0.5rem' }}>¡Ticket Creado Exitosamente!</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Tu solicitud ha sido registrada y notificada al equipo de soporte.</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Redirigiendo a Mis Tickets...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="card">
                            {/* Team ticket toggle */}
                            {canUseTeamMode && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: teamMode ? 'rgba(59,130,246,0.07)' : 'var(--bg-color)', borderRadius: 'var(--radius)', border: `1px solid ${teamMode ? 'var(--accent-color)' : 'var(--border-color)'}`, transition: 'all 0.2s' }}>
                                    <Users size={20} color={teamMode ? 'var(--accent-color)' : 'var(--text-secondary)'} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ticket de Equipo</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Asignás tareas individuales a colaboradores, el ticket se resuelve cuando todos completan su tarea</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTeamMode(v => !v)}
                                        style={{
                                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                            backgroundColor: teamMode ? 'var(--accent-color)' : 'var(--border-color)',
                                            position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute', top: '3px', left: teamMode ? '23px' : '3px',
                                            width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                                            transition: 'left 0.2s', display: 'block'
                                        }} />
                                    </button>
                                </div>
                            )}

                            {/* Team member builder */}
                            {teamMode && canUseTeamMode && (
                                <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo de Trabajo</label>

                                    {/* Creator's own task */}
                                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-color)' }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', flexShrink: 0 }}>
                                            {currentUser?.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(vos)</span>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Tu tarea en este ticket..."
                                            value={myTask}
                                            onChange={e => setMyTask(e.target.value)}
                                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.875rem', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Team members */}
                                    {teamTasks.map((member, idx) => (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', position: 'relative' }}>
                                            <button type="button" onClick={() => removeTeamMember(idx)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', display: 'flex', alignItems: 'center' }}>
                                                <X size={15} />
                                            </button>
                                            <select
                                                value={member.userId || ''}
                                                onChange={e => {
                                                    const u = teamMemberUsers.find(u => u.id === Number(e.target.value));
                                                    if (u) updateTeamMember(idx, 'userId', u.id);
                                                    if (u) updateTeamMember(idx, 'userName', u.name);
                                                }}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                            >
                                                <option value="">Seleccionar colaborador...</option>
                                                {teamMemberUsers
                                                    .filter(u => u.id === member.userId || !teamTasks.some((t, ti) => ti !== idx && t.userId === u.id))
                                                    .map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                                }
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="Tarea asignada..."
                                                value={member.task}
                                                onChange={e => updateTeamMember(idx, 'task', e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={addTeamMember}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.875rem', alignSelf: 'flex-start' }}
                                    >
                                        <UserPlus size={16} /> Agregar colaborador
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                {/* Collaborator picker */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Colaborador</label>
                                    {canPickCollaborator ? (
                                        <select
                                            name="supervisor"
                                            value={formData.supervisor}
                                            onChange={handleInputChange}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: 'var(--radius)',
                                                border: '1px solid var(--border-color)',
                                                fontSize: '1rem',
                                                backgroundColor: 'var(--surface-color)',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            <option value="">Seleccionar Colaborador...</option>
                                            {collaboratorUsers.map(sup => (
                                                <option key={sup.id} value={sup.name}>{sup.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="supervisor"
                                            value={formData.supervisor}
                                            readOnly
                                            placeholder="Auto-asignado"
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: 'var(--radius)',
                                                border: '1px solid var(--border-color)',
                                                fontSize: '1rem',
                                                backgroundColor: 'var(--background-color)',
                                                color: 'var(--text-primary)',
                                                opacity: 0.8,
                                                cursor: 'not-allowed'
                                            }}
                                        />
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        readOnly
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '1rem',
                                            backgroundColor: 'var(--background-color)',
                                            color: 'var(--text-primary)',
                                            opacity: 0.8,
                                            cursor: 'not-allowed'
                                        }}
                                    />
                                </div>

                                {currentUser?.role !== 'supervisor' && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Tu nombre y apellido"
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: 'var(--radius)',
                                                border: '1px solid var(--border-color)',
                                                fontSize: '1rem',
                                                backgroundColor: 'var(--surface-color)',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                )}

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Asunto</label>
                                    <input
                                        type="text"
                                        name="subject"
                                        required
                                        value={formData.subject}
                                        onChange={handleInputChange}
                                        placeholder="Resumen breve del problema"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '1rem',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Funcionario Afectado (Opcional)</label>
                                    <input
                                        type="text"
                                        name="affectedWorker"
                                        value={formData.affectedWorker}
                                        onChange={handleInputChange}
                                        placeholder="Nombre del funcionario (si es diferente al solicitante)"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '1rem',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Descripción Detallada</label>
                                    <textarea
                                        name="description"
                                        required
                                        rows={5}
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Describe los detalles, ubicación y cualquier información relevante..."
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '1rem',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>

                                {/* Multi-department checkboxes */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500 }}>
                                        Departamento(s) *
                                        {selectedDepts.length === 0 ? (
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--status-rejected)', fontWeight: 400 }}>
                                                Seleccioná al menos un departamento
                                            </span>
                                        ) : (
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                {selectedDepts.length} seleccionado{selectedDepts.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                                        gap: '0.5rem'
                                    }}>
                                        {DEPARTMENTS.map(dept => {
                                            const selected = selectedDepts.includes(dept);
                                            return (
                                                <button
                                                    key={dept}
                                                    type="button"
                                                    onClick={() => toggleDept(dept)}
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: 'var(--radius)',
                                                        border: `1px solid ${selected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                                        backgroundColor: selected ? 'rgba(59,130,246,0.1)' : 'var(--surface-color)',
                                                        color: selected ? 'var(--accent-color)' : 'var(--text-primary)',
                                                        fontSize: '0.85rem',
                                                        fontWeight: selected ? 600 : 400,
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {selected ? '✓ ' : ''}{dept}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Prioridad</label>
                                    <select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleInputChange}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '1rem',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <option value="Media">Media (Default)</option>
                                        <option value="Alta">Alta</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Adjuntos</label>
                                    <div
                                        onClick={() => document.getElementById('file-upload')?.click()}
                                        style={{
                                            border: '2px dashed var(--border-color)',
                                            borderRadius: 'var(--radius)',
                                            padding: '2rem',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            backgroundColor: 'var(--bg-color)',
                                            transition: 'border-color 0.2s',
                                            marginBottom: files.length > 0 ? '1rem' : '0'
                                        }}>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            multiple
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        <UploadCloud size={32} color={files.length > 0 ? 'var(--accent-color)' : 'var(--text-secondary)'} style={{ marginBottom: '0.5rem' }} />
                                        <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                                            Haz clic para adjuntar imágenes o documentos
                                        </p>
                                    </div>

                                    {files.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                {files.length} {files.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}:
                                            </p>
                                            {files.map((f, index) => (
                                                <div key={index} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.5rem 0.75rem',
                                                    backgroundColor: 'var(--surface-color)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius)'
                                                }}>
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {f.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveFile(index);
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--status-rejected)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '0.25rem'
                                                        }}
                                                        title="Eliminar archivo"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => router.push('/')}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Enviando...' : 'Enviar Ticket'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
