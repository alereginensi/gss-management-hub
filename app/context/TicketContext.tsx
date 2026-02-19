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
    id: number;
    user_id: number;
    ticket_id?: string;
    message: string;
    type: string;
    read: number;
    created_at: string;
    ticketId?: string; // Legacy support
    ticketSubject?: string; // Legacy support
    timestamp?: Date; // Legacy support
    statusColor?: string; // Legacy support
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
    markNotificationRead: (notificationId: number) => void;
    deleteNotification: (notificationId: number) => void;
    clearAllNotifications: () => void;
    unreadCount: number;
    getAverageResolutionTime: () => string;
    currentUser: User;
    setCurrentUser: (user: User) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    isAuthenticated: boolean;
    login: (user: User, token?: string) => void;
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
    allUsers: User[];
    updateUser: (userId: number, userData: Partial<User> & { password?: string }) => Promise<boolean>;
    transferTicket: (ticketId: string, newSupervisorId: number, transferredBy: number, reason?: string) => Promise<boolean>;
    addCollaborator: (ticketId: string, userId: number, addedBy: number) => Promise<boolean>;
    removeCollaborator: (ticketId: string, userId: number) => Promise<boolean>;
    getTicketCollaborators: (ticketId: string) => Promise<any[]>;
    fetchTickets: () => Promise<void>;
    loadTicketActivities: (ticketId: string) => Promise<void>;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

export function TicketProvider({ children }: { children: ReactNode }) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'Todos' | 'Abiertos' | 'Cerrados'>('Todos');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null); // Updated initial state to null
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
        notification_emails: 'admin@gss-facility.com'
    });
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const router = useRouter(); // Initialize useRouter

    // Helper to get headers with fallback token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('authToken');
        const headers: HeadersInit = {
            'Content-Type': 'application/json' // Default content type for most requests
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    };

    const fetchSettings = async () => {
        try {
            // Settings might be public or protected, add header just in case
            const res = await fetch('/api/settings', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setSystemSettings(data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                // API returns array directly, not { users: [] }
                const pending = data.filter((u: User) => !u.approved);
                const approved = data.filter((u: User) => u.approved);
                setPendingUsers(pending);
                setAllUsers(approved);
                console.log('✅ Users loaded - Approved:', approved.length, 'Pending:', pending.length);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await fetch('/api/tickets', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
                console.log('✅ Tickets loaded:', data.length);
            }
        } catch (error) {
            console.error('Error fetching tickets:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                console.log('✅ Notifications loaded:', data.length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        await Promise.all([
            fetchTickets(),
            fetchNotifications(),
            fetchAllUsers(),
            fetchSettings()
        ]);
        setLoading(false);
    };

    // Restore session on mount
    React.useEffect(() => {
        const restoreSession = async () => {
            try {
                // Try to restore from server (cookie OR header)
                // We send the header if we have one from a previous session
                const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setIsAuthenticated(true);
                        setCurrentUser(data.user);
                        // Fetch data ONLY if authenticated
                        refreshData();
                    }
                } else {
                    // Only logout if we REALLY fail.
                    // But if we have a token in localStorage, maybe we are fine?
                    // No, if the server says 401 even with the token, it's invalid.
                    logout();
                    setLoading(false);
                }
            } catch (e) {
                console.error("Error restoring session", e);
                setLoading(false);
            }
        };

        restoreSession();
    }, []);

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
                // API returns array directly, not { users: [] }
                const pending = data.filter((u: User) => !u.approved);
                const approved = data.filter((u: User) => u.approved);
                setPendingUsers(pending);
                setAllUsers(approved);
                console.log('✅ Users loaded - Approved:', approved.length, 'Pending:', pending.length);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await fetch('/api/tickets');
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
                console.log('✅ Tickets loaded:', data.length);
            }
        } catch (error) {
            console.error('Error fetching tickets:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                console.log('✅ Notifications loaded:', data.length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const loadTicketActivities = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/activities`);
            if (res.ok) {
                const data = await res.json();
                // Merge with existing activities, avoiding duplicates
                setActivities(prev => {
                    const otherActivities = prev.filter(a => a.ticketId !== ticketId);
                    // Standardize dates — ensure timestamp is always a real Date object
                    const newActivities = data.map((a: any) => ({
                        ...a,
                        timestamp: (() => {
                            const d = new Date(a.timestamp);
                            return isNaN(d.getTime()) ? new Date(0) : d;
                        })()
                    }));
                    return [...otherActivities, ...newActivities];
                });
            }
        } catch (error) {
            console.error('Error loading activities:', error);
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
        // Give time for the cookie to be set in the browser jar
        setTimeout(() => refreshData(), 500);
    };

    const logout = () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setCurrentUser({ id: 0, name: '', department: '', role: 'user' });
    };

    const addTicket = (ticketData: Omit<Ticket, 'id' | 'date' | 'priorityColor' | 'statusColor'>) => {
        // Safe ID generation
        const numericIds = tickets
            .map(t => parseInt(t.id))
            .filter(id => !isNaN(id) && isFinite(id));

        const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 99; // Start at 100 if empty
        const newId = (maxId + 1).toString();
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

    const addActivity = async (ticketId: string, user: string, message: string) => {
        try {
            // Optimistic update
            const tempActivity: Activity = {
                id: Date.now().toString(),
                ticketId,
                user,
                message,
                timestamp: new Date()
            };
            setActivities(prev => [...prev, tempActivity]);

            // Save to DB
            const res = await fetch(`/api/tickets/${ticketId}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, type: 'comment' })
            });

            if (!res.ok) {
                console.error('Failed to save activity');
            }

            // Send in-app notification only (no email on comments)
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket && currentUser.id > 0) {
                addNotification(ticketId, ticket.subject, `${user}: ${message.substring(0, 60)}`);
            }
        } catch (error) {
            console.error('Error adding activity:', error);
        }
    };

    // Helper: safely convert any timestamp value to a Date object
    const toDate = (value: any): Date => {
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? new Date(0) : d;
        }
        return new Date(0);
    };

    const getActivitiesByTicket = (ticketId: string): Activity[] => {
        return activities
            .filter(a => a.ticketId === ticketId)
            .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());
    };

    const addNotification = (ticketId: string, ticketSubject: string, message: string, statusColor?: string) => {
        const newNotification: Notification = {
            id: Date.now(),
            user_id: currentUser.id,
            ticket_id: ticketId,
            message,
            type: 'info',
            read: 0,
            created_at: new Date().toISOString(),
            ticketId, // Legacy support
            ticketSubject, // Legacy support
            timestamp: new Date(), // Legacy support
            statusColor // Legacy support
        };
        setNotifications(prev => [newNotification, ...prev]);
    };

    const markNotificationRead = (notificationId: number) => {
        // Persist to DB
        fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId, action: 'mark_read' })
        }).catch(err => console.error('Error marking notification read:', err));

        setNotifications(prev =>
            prev.map(notif =>
                notif.id === notificationId ? { ...notif, read: 1 } : notif
            )
        );
    };

    const deleteNotification = (notificationId: number) => {
        // Delete from DB
        fetch(`/api/notifications?id=${notificationId}`, {
            method: 'DELETE'
        }).catch(err => console.error('Error deleting notification:', err));

        // Optimistic update
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    };

    const clearAllNotifications = () => {
        // Delete all from DB
        fetch('/api/notifications?all=true', { method: 'DELETE' })
            .catch(err => console.error('Error clearing notifications:', err));
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

        // Persist status change to database
        fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        }).catch(err => console.error('Error persisting ticket status to DB:', err));

        // Add activity log with the actual user name
        addActivity(ticketId, currentUser.name || 'Sistema', `Estado cambiado a: ${newStatus}`);

        // Send notification with status color
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
            const statusColors = {
                'Nuevo': 'var(--status-new)',
                'En Progreso': 'var(--status-progress)',
                'Resuelto': 'var(--status-resolved)'
            };
            const notification: Notification = {
                id: Date.now(),
                user_id: currentUser.id,
                ticket_id: ticketId,
                message: `Ticket #${ticketId} - "${ticket.subject}": estado cambiado a ${newStatus} por ${currentUser.name}`,
                type: 'status_change',
                read: 0,
                created_at: new Date().toISOString(),
                ticketId, // Legacy support
                ticketSubject: ticket.subject, // Legacy support
                timestamp: new Date(), // Legacy support
                statusColor: statusColors[newStatus] // Legacy support
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
            const start = new Date(ticket.startedAt!).getTime();
            const end = new Date(ticket.resolvedAt!).getTime();
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

    const updateUser = async (userId: number, userData: Partial<User> & { password?: string }) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (res.ok) {
                await fetchAllUsers();
                return true;
            }
            const error = await res.json();
            console.error('Error updating user:', error);
            return false;
        } catch (error) {
            console.error('Error updating user:', error);
            return false;
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const transferTicket = async (ticketId: string, newSupervisorId: number, transferredBy: number, reason?: string) => {
        try {
            console.log('📡 API Call - Transfer Ticket:', { ticketId, newSupervisorId, transferredBy, reason });
            const res = await fetch(`/api/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newSupervisorId, transferredBy, reason })
            });
            console.log('📡 API Response status:', res.status);
            const data = await res.json();
            console.log('📡 API Response data:', data);
            if (res.ok) {
                // Refresh tickets from database
                await fetchTickets();
                return true;
            }
            console.error('Transfer failed:', data);
            return false;
        } catch (error) {
            console.error('Error transferring ticket:', error);
            return false;
        }
    };

    const addCollaborator = async (ticketId: string, userId: number, addedBy: number) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, addedBy })
            });
            return res.ok;
        } catch (error) {
            console.error('Error adding collaborator:', error);
            return false;
        }
    };

    const removeCollaborator = async (ticketId: string, userId: number) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/collaborators?userId=${userId}`, {
                method: 'DELETE'
            });
            return res.ok;
        } catch (error) {
            console.error('Error removing collaborator:', error);
            return false;
        }
    };

    const getTicketCollaborators = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/collaborators`);
            if (res.ok) {
                return await res.json();
            }
            return [];
        } catch (error) {
            console.error('Error fetching collaborators:', error);
            return [];
        }
    };

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
            deleteNotification,
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
            updateUser,
            isSidebarOpen,
            toggleSidebar,
            pendingUsers,
            fetchAllUsers,
            loading,
            allUsers,
            transferTicket,
            addCollaborator,
            removeCollaborator,
            getTicketCollaborators,
            fetchTickets,
            loadTicketActivities
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
