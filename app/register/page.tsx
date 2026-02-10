"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, UserPlus, Mail, Lock, Building } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        department: 'Mantenimiento'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
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
            setError('Error de conexión');
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Correo Electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                                placeholder="tu@email.com"
                            />
                            <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        </div>
                    </div>

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
