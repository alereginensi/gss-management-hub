'use client';

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Sun, Moon, User as UserIcon, Mail, Zap } from 'lucide-react';
import { useTicketContext, DEPARTMENTS } from '../context/TicketContext';

export default function Settings() {
    const { theme, setTheme, currentUser, systemSettings, updateSystemSettings } = useTicketContext();

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title="Configuración" />

                <div style={{ maxWidth: '800px' }}>


                    {/* User Information */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Información del Usuario</h2>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: 'white'
                            }}>
                                {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'U'}
                            </div>
                            <div>
                                <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                    {currentUser.name}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {currentUser.department} • {currentUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                    Departamento
                                </label>
                                <div style={{ fontSize: '0.875rem' }}>
                                    {currentUser.department}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                    Rol
                                </label>
                                <div style={{ fontSize: '0.875rem' }}>
                                    {currentUser.role === 'admin' ? 'Administrador' : 'Usuario'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin Settings - System Config */}
                    {currentUser.role === 'admin' && (
                        <div className="card">
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Configuración del Sistema</h2>

                            {/* Power Automate Integration */}
                            <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#3b82f6' }}>
                                    <Zap size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                    Power Automate Webhook URL (Recomendado)
                                </label>
                                <input
                                    type="text"
                                    defaultValue={systemSettings.power_automate_url || ''}
                                    onBlur={(e) => updateSystemSettings({ power_automate_url: e.target.value })}
                                    placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem'
                                    }}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Si se configura, todas las notificaciones se enviarán a través de Microsoft 365 Power Automate.
                                </p>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--accent-color)' }}>
                                    <Mail size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                    Email Global de Notificaciones (Fallback)
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        defaultValue={systemSettings.notification_emails || systemSettings.notification_email}
                                        onBlur={(e) => updateSystemSettings({ notification_emails: e.target.value })}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem 0.8rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                        placeholder="admin@empresa.com"
                                    />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Se usará si el departamento no tiene mails configurados específicos.
                                </p>
                            </div>

                            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', opacity: 0.8 }}>Notificaciones por Departamento</h3>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {DEPARTMENTS.map(dept => {
                                        const deptKey = `notification_emails_${dept}`.replace(/\s+/g, '_');
                                        return (
                                            <div key={dept}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                                                    {dept}
                                                </label>
                                                <input
                                                    type="text"
                                                    defaultValue={systemSettings[deptKey] || ''}
                                                    onBlur={(e) => updateSystemSettings({ [deptKey]: e.target.value })}
                                                    placeholder="mail1@gss.com, mail2@gss.com"
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: 'var(--radius)',
                                                        border: '1px solid var(--border-color)',
                                                        backgroundColor: 'var(--surface-color)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '0.8rem'
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => alert('Configuración guardada')}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
