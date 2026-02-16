'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export const DEPARTMENTS = [
    'Mantenimiento',
    'Limpieza',
    'IT',
    'Seguridad',
    'RRHH',
    'Administración',
    'Logística'
];

export const TICKET_SUPERVISORS = [
    'Victor Ruilopez (Limpieza)',
    'Silvia Betancourt (Limpieza)',
    'Mebyl Crossa (Limpieza)',
    'Santiago Medina (Limpieza)',
    'Martin Batista (Seguridad / Limpieza)',
    'Pedro Silva (Seguridad)',
    'Juan Cigaran (Seguridad / Limpieza)',
    'Nahim Gomez (Seguridad / Limpieza)',
    'Jorge Arqueta (Seguridad)',
    'Rodrigo Correa (Seguridad Electrónica)',
    'Santiago Peñalva (Seguridad Electrónica)',
    'Valeria Godoy (Tercerizados)',
    'Lorena Sotelo (Limpieza)',
    'Lourdes Casal (Limpieza)',
    'Carla Da Luz (Limpieza)',
    'Romina Turturiello (Seguridad)',
    'Christian del Puerto (Seguridad)',
    'María Álvarez (Seguridad)'
];

export interface Ticket {
    id: string;
    subject: string;
    description?: string;
    department?: string;
    priority: 'Alta' | 'Media' | 'Baja';
    status: 'Nuevo' | 'En Progreso' | 'Resuelto';
    date: string;
    priorityColor: string;
    statusColor: string;
    requester?: string;
    requesterEmail?: string;
    affectedWorker?: string;
    supervisor?: string;
    createdAt?: Date;
    startedAt?: Date;
    resolvedAt?: Date;
}

export interface Activity {
    id: string;
    ticketId: string;
    user: string;
    message: string;
    timestamp: Date;
}

export interface Notification {
    id: string;
    ticketId: string;
    ticketSubject: string;
    message: string;
    timestamp: Date;
    read: boolean;
    statusColor?: string;
}

export interface User {
    id: number;
    name: string;
    email?: string;
    department: string;
    role: 'user' | 'admin' | 'supervisor' | 'funcionario';
    rubro?: string;
    approved?: boolean;
}

interface TicketContextType {
    tickets: Ticket[];
    addTicket: (ticket: Omit<Ticket, 'id' | 'date' | 'priorityColor' | 'statusColor'>) => void;
    updateTicketStatus: (ticketId: string, newStatus: 'Nuevo' | 'En Progreso' | 'Resuelto') => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filter: 'Todos' | 'Abiertos' | 'Cerrados';
    setFilter: (filter: 'Todos' | 'Abiertos' | 'Cerrados') => void;
    activities: Activity[];
    addActivity: (ticketId: string, user: string, message: string) => void;
    getActivitiesByTicket: (ticketId: string) => Activity[];
    notifications: Notification[];
    addNotification: (ticketId: string, ticketSubject: string, message: string) => void;
    markNotificationRead: (notificationId: string) => void;
    clearAllNotifications: () => void;
    unreadCount: number;
    getAverageResolutionTime: () => string;
    currentUser: User;
    setCurrentUser: (user: User) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
    systemSettings: Record<string, string>;
    updateSystemSettings: (settings: Record<string, string>) => Promise<void>;
    requestAccess: (email: string, name: string, department: string) => Promise<{ success: boolean; error?: string }>;
    approveUser: (email: string) => Promise<boolean>;
    rejectUser: (email: string) => Promise<boolean>;
    deleteUser: (email: string) => Promise<boolean>;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    pendingUsers: User[];
    fetchAllUsers: () => Promise<void>;
    loading: boolean;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

const initialTickets: Ticket[] = [
    { id: '1024', subject: 'Fallo en Aire Acondicionado Piso 3', description: 'El aire acondicionado del piso 3 no está trabajando', department: 'Mantenimiento', priority: 'Alta', status: 'Nuevo', date: '10/02/2026', priorityColor: 'var(--priority-high)', statusColor: 'var(--status-new)', requester: 'Juan Pérez', requesterEmail: 'juan@gss.com' },
    { id: '1023', subject: 'Solicitud de Limpieza Sala Reuniones', description: 'Se requiere limpieza profunda de la sala de reuniones', department: 'Limpieza', priority: 'Media', status: 'En Progreso', date: '09/02/2026', priorityColor: 'var(--priority-medium)', statusColor: 'var(--status-progress)', requester: 'Ana Gómez', requesterEmail: 'ana@gss.com' },
    { id: '1022', subject: 'Cambio de Toner Impresora RRHH', description: 'La impresora de RRHH necesita cambio de toner', department: 'IT', priority: 'Baja', status: 'Resuelto', date: '07/02/2026', priorityColor: 'var(--priority-low)', statusColor: 'var(--status-resolved)', requester: 'Carlos Ruiz', requesterEmail: 'carlos@gss.com' },
    { id: '1020', subject: 'Solicitud monitor adicional', description: 'Necesito un monitor adicional para mi estación de trabajo', department: 'IT', priority: 'Baja', status: 'Resuelto', date: '08/02/2026', priorityColor: 'var(--priority-low)', statusColor: 'var(--status-resolved)', requester: 'María López', requesterEmail: 'maria@gss.com' },
];

const initialActivities: Activity[] = [
    { id: '1', ticketId: '1024', user: 'Soporte IT (Carlos)', message: 'Recibido. Estamos enviando un técnico de mantenimiento para revisar la unidad exterior.', timestamp: new Date(Date.now() - 5 * 60 * 1000) },
    { id: '2', ticketId: '1024', user: 'Demo User', message: 'Gracias, quedo atento.', timestamp: new Date(Date.now() - 2 * 60 * 1000) },
];

export function TicketProvider({ children }: { children: ReactNode }) {
    const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'Todos' | 'Abiertos' | 'Cerrados'>('Todos');
    const [activities, setActivities] = useState<Activity[]>(initialActivities);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [currentUser, setCurrentUser] = useState<User>({
        id: 0,
        name: 'Demo User',
        department: 'Mantenimiento',
        role: 'user'
    });
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
        notification_emails: 'admin@gss-facility.com'
    });
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Restore session on mount
    React.useEffect(() => {
        const restoreSession = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setIsAuthenticated(true);
                        setCurrentUser(data.user);
                    }
                } else {
                    // If cookie is invalid/expired, ensure we are logged out locally
                    logout();
                }
            } catch (e) {
                console.error("Error restoring session", e);
            } finally {
                setLoading(false);
            }
            fetchSettings();
        };

        restoreSession();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSystemSettings(data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const updateSystemSettings = async (newSettings: Record<string, string>) => {
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            if (res.ok) {
                setSystemSettings(prev => ({ ...prev, ...newSettings }));
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setPendingUsers(data.filter((u: any) => u.approved === 0));
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const requestAccess = async (email: string, name: string, department: string) => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, department, isApprovalRequest: true })
            });
            return await res.json();
        } catch (error) {
            return { success: false, error: 'Error de conexión' };
        }
    };

    const approveUser = async (email: string) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'approve' })
            });
            if (res.ok) {
                fetchAllUsers();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const rejectUser = async (email: string) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'reject' })
            });
            if (res.ok) {
                fetchAllUsers();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error rejecting user:', error);
            return false;
        }
    };

    const login = (userData: User) => {
        setIsAuthenticated(true);
        setCurrentUser(userData);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setCurrentUser({ id: 0, name: '', department: '', role: 'user' });
    };

    const addTicket = (ticketData: Omit<Ticket, 'id' | 'date' | 'priorityColor' | 'statusColor'>) => {
        const newId = (Math.max(...tickets.map(t => parseInt(t.id))) + 1).toString();
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const priorityColors = {
            'Alta': 'var(--priority-high)',
            'Media': 'var(--priority-medium)',
            'Baja': 'var(--priority-low)'
        };

        const statusColors = {
            'Nuevo': 'var(--status-new)',
            'En Progreso': 'var(--status-progress)',
            'Resuelto': 'var(--status-resolved)'
        };

        const newTicket: Ticket = {
            ...ticketData,
            id: newId,
            date: dateStr,
            priorityColor: priorityColors[ticketData.priority],
            statusColor: statusColors[ticketData.status],
            requester: ticketData.requester || currentUser.name || 'Anónimo',
            requesterEmail: ticketData.requesterEmail || currentUser.email,
            affectedWorker: ticketData.affectedWorker,
            supervisor: ticketData.supervisor,
            createdAt: now
        };

        setTickets(prev => [newTicket, ...prev]);

        // Save to Database
        fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTicket)
        }).catch(err => console.error('Error saving ticket:', err));

        // Add In-App Notification
        addNotification(newId, newTicket.subject, `Ticket creado exitosamente: ${newTicket.subject}`);

        // Trigger real email notification via API
        // Determine recipient emails: priority to department-specific setting, then global fallback
        const deptEmailKey = `notification_emails_${newTicket.department}`.replace(/\s+/g, '_');
        const emailString = systemSettings[deptEmailKey] || systemSettings.notification_emails || systemSettings.notification_email || '';

        const emailList = emailString
            .split(',')
            .map(e => e.trim())
            .filter(e => e.length > 0);

        if (emailList.length > 0) {
            const emailBody = `
Se ha registrado una nueva solicitud en el portal:

- Colaborador: ${newTicket.requester}
${newTicket.affectedWorker ? `- Funcionario Afectado: ${newTicket.affectedWorker}` : ''}
- Email: ${currentUser.email}
- Sector/Departamento: ${newTicket.department}
- Asunto: ${newTicket.subject}
- Descripción: ${newTicket.description}
- Prioridad: ${newTicket.priority}
- Fecha/Hora: ${newTicket.date}

Por favor, ingrese al portal administrativo para gestionar esta solicitud.`.trim();

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailList,
                    subject: `[NUEVO TICKET] ${newTicket.subject}`,
                    body: emailBody,
                    ticketData: {
                        id: newTicket.id,
                        requester: newTicket.requester,
                        requesterEmail: currentUser.email,
                        affectedWorker: newTicket.affectedWorker,
                        department: newTicket.department,
                        subject: newTicket.subject,
                        description: newTicket.description,
                        priority: newTicket.priority,
                        date: newTicket.date
                    }
                })
            }).catch(err => console.error('Error triggering notification:', err));
        }
    };

    const addActivity = (ticketId: string, user: string, message: string) => {
        const newActivity: Activity = {
            id: Date.now().toString(),
            ticketId,
            user,
            message,
            timestamp: new Date()
        };

        setActivities(prev => [...prev, newActivity]);

        // Create notification for ticket owner (if not the current user)
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket && user !== 'Demo User') {
            addNotification(ticketId, ticket.subject, `${user} comentó: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
        }
    };

    const getActivitiesByTicket = (ticketId: string): Activity[] => {
        return activities.filter(a => a.ticketId === ticketId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    const addNotification = (ticketId: string, ticketSubject: string, message: string) => {
        const newNotification: Notification = {
            id: Date.now().toString(),
            ticketId,
            ticketSubject,
            message,
            timestamp: new Date(),
            read: false
        };

        setNotifications(prev => [newNotification, ...prev]);
    };

    const markNotificationRead = (notificationId: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        ));
    };

    const clearAllNotifications = () => {
        setNotifications([]);
    };

    const updateTicketStatus = (ticketId: string, newStatus: 'Nuevo' | 'En Progreso' | 'Resuelto') => {
        setTickets(prev => prev.map(ticket => {
            if (ticket.id !== ticketId) return ticket;

            const now = new Date();
            const updates: Partial<Ticket> = { status: newStatus };

            // Update status color
            const statusColors = {
                'Nuevo': 'var(--status-new)',
                'En Progreso': 'var(--status-progress)',
                'Resuelto': 'var(--status-resolved)'
            };
            updates.statusColor = statusColors[newStatus];

            // Track timestamps
            if (newStatus === 'En Progreso' && !ticket.startedAt) {
                updates.startedAt = now;
            } else if (newStatus === 'Resuelto' && !ticket.resolvedAt) {
                updates.resolvedAt = now;
            }

            return { ...ticket, ...updates };
        }));

        // Add activity log
        addActivity(ticketId, 'Sistema', `Estado cambiado a: ${newStatus}`);

        // Send notification with status color
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
            const statusColors = {
                'Nuevo': 'var(--status-new)',
                'En Progreso': 'var(--status-progress)',
                'Resuelto': 'var(--status-resolved)'
            };
            const notification: Notification = {
                id: Date.now().toString(),
                ticketId,
                ticketSubject: ticket.subject,
                message: `El estado cambió a: ${newStatus}`,
                timestamp: new Date(),
                read: false,
                statusColor: statusColors[newStatus]
            };
            setNotifications(prev => [notification, ...prev]);

            // Send email notification when ticket is resolved
            if (newStatus === 'Resuelto') {
                const resolvedBy = currentUser.name;
                const resolvedByEmail = currentUser.email || '';
                const requesterEmail = ticket.requesterEmail || '';
                const requesterName = ticket.requester || 'Usuario';

                // Prepare email recipients: ticket creator and admin who resolved it
                const recipients = [];
                if (requesterEmail) recipients.push(requesterEmail);
                if (resolvedByEmail && resolvedByEmail !== requesterEmail) recipients.push(resolvedByEmail);

                if (recipients.length > 0) {
                    const emailBody = `
El ticket ha sido marcado como RESUELTO:

- Ticket ID: ${ticket.id}
- Asunto: ${ticket.subject}
- Descripción: ${ticket.description || 'N/A'}
- Departamento: ${ticket.department}
- Prioridad: ${ticket.priority}
- Solicitante: ${requesterName} (${requesterEmail})
- Resuelto por: ${resolvedBy} (${resolvedByEmail})
- Fecha de creación: ${ticket.date}
- Fecha de resolución: ${new Date().toLocaleString('es-AR')}

Gracias por utilizar el sistema de tickets GSS.`.trim();

                    fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: recipients,
                            subject: `[TICKET RESUELTO] ${ticket.subject}`,
                            body: emailBody,
                            ticketData: {
                                id: ticket.id,
                                requester: requesterName,
                                requesterEmail: requesterEmail,
                                department: ticket.department,
                                subject: ticket.subject,
                                description: ticket.description,
                                priority: ticket.priority,
                                status: 'Resuelto',
                                resolvedBy: resolvedBy,
                                resolvedByEmail: resolvedByEmail,
                                date: ticket.date,
                                resolvedDate: new Date().toLocaleString('es-AR')
                            }
                        })
                    }).catch(err => console.error('Error sending resolution notification:', err));
                }
            }
        }
    };

    const getAverageResolutionTime = (): string => {
        const resolvedTicketsWithTime = tickets.filter(t =>
            t.status === 'Resuelto' && t.startedAt && t.resolvedAt
        );

        if (resolvedTicketsWithTime.length === 0) {
            return 'N/A';
        }

        const totalMinutes = resolvedTicketsWithTime.reduce((sum, ticket) => {
            const start = ticket.startedAt!.getTime();
            const end = ticket.resolvedAt!.getTime();
            const minutes = Math.floor((end - start) / (1000 * 60));
            return sum + minutes;
        }, 0);

        const avgMinutes = Math.floor(totalMinutes / resolvedTicketsWithTime.length);

        // Format the time
        if (avgMinutes < 60) {
            return `${avgMinutes}m`;
        } else if (avgMinutes < 1440) { // Less than 24 hours
            const hours = Math.floor(avgMinutes / 60);
            const mins = avgMinutes % 60;
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        } else {
            const days = Math.floor(avgMinutes / 1440);
            const hours = Math.floor((avgMinutes % 1440) / 60);
            return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
        }
    };

    const deleteUser = async (email: string) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'delete' })
            });
            if (res.ok) {
                fetchAllUsers();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting user:', error);
            return false;
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <TicketContext.Provider value={{
            tickets,
            addTicket,
            updateTicketStatus,
            searchQuery,
            setSearchQuery,
            filter,
            setFilter,
            activities,
            addActivity,
            getActivitiesByTicket,
            notifications,
            addNotification,
            markNotificationRead,
            clearAllNotifications,
            unreadCount,
            getAverageResolutionTime,
            currentUser,
            setCurrentUser,
            theme,
            setTheme,
            isAuthenticated,
            login,
            logout,
            systemSettings,
            updateSystemSettings,
            requestAccess,
            approveUser,
            rejectUser,
            deleteUser,
            isSidebarOpen,
            toggleSidebar,
            pendingUsers,
            fetchAllUsers,
            loading
        }}>
            {children}
        </TicketContext.Provider>
    );
}

export function useTicketContext() {
    const context = useContext(TicketContext);
    if (context === undefined) {
        throw new Error('useTicketContext must be used within a TicketProvider');
    }
    return context;
}
