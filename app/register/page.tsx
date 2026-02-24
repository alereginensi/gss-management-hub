"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, UserPlus, Mail, Lock, Building, Check } from 'lucide-react';
import { RUBROS } from '../context/TicketContext';


export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        department: 'Mantenimiento',
        rubro: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<any[]>([]);
    const router = useRouter();

    useState(() => {
        fetchRoles();
    });

    async function fetchRoles() {
        try {
            const res = await fetch('/api/config/roles');
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.role !== 'user' && formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }

        try {
            // Validate email existence with API
            const validationResponse = await fetch('/api/validate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });

            const validationData = await validationResponse.json();

            if (!validationData.valid) {
                setError('Por favor escribe una dirección de email válida');
                setLoading(false);
                return;
            }

            // Show warning if using fallback validation
            if (validationData.fallback) {
                console.warn('Using fallback email validation:', validationData.message);
            }

            // Proceed with registration
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/login?registered=true');
            } else {
                setError(data.error || 'Error al registrar usuario');
            }
        } catch (err) {
            console.error('Registration error:', err);
            setError('Error de conexión. Por favor intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-color)',
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                        <ShieldCheck size={48} color="var(--accent-color)" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Crear Cuenta</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Regístrate en GSS Ticket Portal
                    </p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem',
                        border: '1px solid #fecaca'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Nombre Completo</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                                placeholder="Tu Nombre Completo"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Correo Electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                                placeholder="tu@email.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Tipo de Usuario</label>
                        <div style={{ position: 'relative' }}>
                            <select
                                required
                                value={formData.role}
                                onChange={(e) => {
                                    const newRole = e.target.value;
                                    setFormData({ ...formData, role: newRole, rubro: '' });
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    appearance: 'none',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="user">Solicitante</option>
                                <option value="supervisor">Supervisor (Bitácoras)</option>
                                <option value="funcionario">Funcionario</option>
                            </select>
                        </div>
                    </div>

                    {(formData.role === 'funcionario' || formData.role === 'supervisor') && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                {formData.role === 'supervisor' ? 'Categorías a Supervisar' : 'Rubro / Área (múltiple)'}
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.5rem',
                                padding: '1rem',
                                backgroundColor: 'var(--surface-color)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border-color)'
                            }}>
                                {RUBROS.map(r => {
                                    const selectedRubros = formData.rubro ? formData.rubro.split(',').map(s => s.trim()) : [];
                                    const isSelected = selectedRubros.includes(r);

                                    return (
                                        <label key={r} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.875rem',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            borderRadius: '4px',
                                            backgroundColor: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                                            color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                                            transition: 'all 0.2s'
                                        }}>
                                            <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        let newRubros;
                                                        if (e.target.checked) {
                                                            newRubros = [...selectedRubros, r];
                                                        } else {
                                                            newRubros = selectedRubros.filter(item => item !== r);
                                                        }
                                                        setFormData({ ...formData, rubro: newRubros.join(', ') });
                                                    }}
                                                    style={{ cursor: 'pointer', margin: 0 }}
                                                />
                                            </div>
                                            {r}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {formData.role !== 'user' && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="password"
                                        required={formData.role !== 'user'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem',
                                            boxSizing: 'border-box'
                                        }}
                                        placeholder="Crear contraseña"
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Confirmar Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="password"
                                        required={formData.role !== 'user'}
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem',
                                            boxSizing: 'border-box'
                                        }}
                                        placeholder="Repetir contraseña"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem', marginTop: '0.5rem' }}
                    >
                        {loading ? 'Enviando Solicitud...' : 'Solicitar Acceso'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>¿Ya tienes cuenta? </span>
                    <Link href="/login" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Inicia sesión</Link>
                </div>
            </div>
        </div>
    );
}
