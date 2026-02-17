"use client";

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { UploadCloud, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTicketContext, DEPARTMENTS } from '../context/TicketContext';
import { useRouter } from 'next/navigation';

export default function NewTicket() {
    const [submitted, setSubmitted] = useState(false);
    const { addTicket, currentUser, isSidebarOpen, allUsers } = useTicketContext();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: currentUser.id > 0 ? currentUser.name : '',
        email: currentUser.email || '',
        subject: '',
        description: '',
        department: currentUser.department || '',
        priority: 'Media' as 'Alta' | 'Media' | 'Baja',
        affectedWorker: '',
        supervisor: '',
        location: '',
        sector: ''
    });
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if (currentUser.id > 0) {
            setFormData(prev => ({ ...prev, name: currentUser.name }));
        }
        if (currentUser.email) {
            setFormData(prev => ({ ...prev, email: currentUser.email || '' }));
        }
        if (currentUser.department && currentUser.department !== 'Sin Asignar') {
            setFormData(prev => ({ ...prev, department: currentUser.department }));
        }
        if (currentUser.role === 'supervisor' && currentUser.name) {
            setFormData(prev => ({ ...prev, supervisor: currentUser.name }));
        }
    }, [currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.email || !formData.department) {
            alert('Por favor completa todos los campos obligatorios (Nombre, Email, Departamento).');
            return;
        }

        // Validate email format first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Por favor ingresa un email válido.');
            return;
        }

        // Validate email existence with API
        try {
            const validationResponse = await fetch('/api/validate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });

            const validationData = await validationResponse.json();

            if (!validationData.valid) {
                alert('Por favor escribe una dirección de email válida');
                return;
            }

            // Show warning if using fallback validation
            if (validationData.fallback) {
                console.warn('Using fallback email validation:', validationData.message);
            }
        } catch (error) {
            console.error('Email validation error:', error);
            // Continue with ticket creation even if validation fails
            console.warn('Email validation failed, proceeding with basic validation');
        }

        // Update current user email if not set
        if (!currentUser.email) {
            currentUser.email = formData.email;
        }

        // Add ticket to global state
        // Add ticket to global state
        addTicket({
            subject: formData.subject,
            description: formData.description,
            department: formData.department,
            priority: formData.priority,
            status: 'Nuevo',
            requester: formData.name,
            requesterEmail: formData.email,
            affectedWorker: formData.affectedWorker
        });

        setSubmitted(true);

        // Redirect to tickets page after 2 seconds
        setTimeout(() => {
            router.push('/tickets');
        }, 2000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem',
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Supervisor</label>
                                    {currentUser.role === 'admin' ? (
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
                                            <option value="">Seleccionar Supervisor...</option>
                                            {allUsers
                                                .filter(u => u.role === 'supervisor' || u.role === 'admin')
                                                .map(sup => (
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

                                {currentUser.role !== 'supervisor' && (
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

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Departamento</label>
                                    <select
                                        name="department"
                                        required
                                        value={formData.department}
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
                                        <option value="">Seleccionar...</option>
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
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
                                            transition: 'border-color 0.2s'
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
                                            {files.length > 0 ? `${files.length} archivos seleccionados` : 'Haz clic para adjuntar imágenes o documentos'}
                                        </p>
                                        {files.length > 0 && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {files.map(f => f.name).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => router.push('/')}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Enviar Ticket</button>
                            </div>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
