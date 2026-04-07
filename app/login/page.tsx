"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';

export default function Login() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAdminLogin, setIsAdminLogin] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useTicketContext();

    useEffect(() => {
        if (searchParams && searchParams.get('registered')) {
            setPendingApproval(true);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setPendingApproval(false);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, isAdminLogin })
            });

            console.log('Login Response Status:', res.status);
            const data = await res.json();
            console.log('Login Response Data:', data);

            if (res.ok) {
                login({
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    department: data.user.department,
                    role: data.user.role as any,
                    rubro: data.user.rubro,
                    modules: data.user.modules ?? undefined
                }, data.token);

                router.push('/');
            } else {
                if (res.status === 403) {
                    setPendingApproval(true);
                } else {
                    setError(data.error || 'Credenciales inválidas');
                }
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(`Error de conexión: ${err.message || 'No se pudo contactar con el servidor'}`);
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
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="GSS Logo" style={{ maxWidth: '200px', height: 'auto' }} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Acceso al Portal</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        GSS Facility Services
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', backgroundColor: 'var(--surface-color)', padding: '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setIsAdminLogin(false)}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'calc(var(--radius) - 2px)',
                            border: 'none',
                            backgroundColor: !isAdminLogin ? 'var(--accent-color)' : 'transparent',
                            color: !isAdminLogin ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Soy Solicitante
                    </button>
                    <button
                        onClick={() => setIsAdminLogin(true)}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'calc(var(--radius) - 2px)',
                            border: 'none',
                            backgroundColor: isAdminLogin ? 'var(--accent-color)' : 'transparent',
                            color: isAdminLogin ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Acceso Personal
                    </button>
                </div>

                {pendingApproval && (
                    <div style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#047857',
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem',
                        border: '1px solid #10b981',
                        textAlign: 'center'
                    }}>
                        <strong style={{ color: '#047857' }}>Solicitud Pendiente</strong><br />
                        Tu cuenta está esperando aprobación por un administrador. Te notificaremos cuando esté lista.
                    </div>
                )}

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
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box'
                                }}
                                placeholder="tu@empresa.com"
                            />
                        </div>
                    </div>

                    {isAdminLogin && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required={isAdminLogin}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 3rem 0.75rem 0.75rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        boxSizing: 'border-box'
                                    }}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.875rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.25rem'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem', marginTop: '0.5rem' }}
                    >
                        {loading ? 'Procesando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>¿Aún no tienes acceso? </span>
                    <Link href="/register" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Solicitar ahora</Link>
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={async () => {
                            if ('serviceWorker' in navigator) {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                for (const registration of registrations) {
                                    await registration.unregister();
                                }
                                alert('Cache reiniciado. La página se recargará.');
                                window.location.reload();
                            }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', opacity: 0.7 }}
                    >
                        ¿Problemas? Reiniciar Aplicación
                    </button>
                </div>
            </div>
        </div>
    );
}
