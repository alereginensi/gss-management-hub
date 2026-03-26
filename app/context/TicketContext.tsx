'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export const DEPARTMENTS = [
    'Recursos Humanos',
    'Controller',
    'Administración',
    'Logistica',
    'Operaciones Seguridad',
    'Operaciones Limpieza',
    'Comercial',
    'Dirección',
    'Gestión',
    'IT',
    'Area de Planificacion'
];

export const RUBROS = [
    'Limpieza',
    'Seguridad Física',
    'Seguridad Electrónica',
    'Tercerizados',
    'Administrativos'
];

export const PRIORITY_COLORS = {
    'Alta': 'var(--priority-high)',
    'Media': 'var(--priority-medium)',
    'Baja': 'var(--priority-low)'
};

export const STATUS_COLORS = {
    'Nuevo': 'var(--status-new)',
    'En Progreso': 'var(--status-progress)',
    'Resuelto': 'var(--status-resolved)'
};

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
    collaboratorIds?: number[];
    createdAt?: Date;
    startedAt?: Date;
    resolvedAt?: Date;
    attachmentUrl?: string;
    isTeamTicket?: boolean;
}

export interface Folder {
    id: number;
    name: string;
    ticketCount: number;
    createdAt?: string;
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
    role: 'user' | 'admin' | 'supervisor' | 'funcionario' | 'jefe' | 'tecnico' | 'contador' | 'logistica';
    rubro?: string;
    approved?: boolean;
}

interface TicketContextType {
    tickets: Ticket[];
    addTicket: (ticket: Omit<Ticket, 'id' | 'date' | 'priorityColor' | 'statusColor'>) => Promise<void>;
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
    markAllNotificationsRead: () => void;
    clearAllNotifications: () => void;
    unreadCount: number;
    getAverageResolutionTime: () => string;
    currentUser: User | null;
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
    deleteTicket: (ticketId: string) => Promise<boolean>;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    isMobile: boolean;
    pendingUsers: User[];
    fetchAllUsers: () => Promise<void>;
    loading: boolean;
    allUsers: User[];
    getAuthHeaders: () => HeadersInit;
    updateUser: (userId: number, userData: Partial<User> & { password?: string }) => Promise<boolean>;
    transferTicket: (ticketId: string, newSupervisorId: number, transferredBy: number, reason?: string) => Promise<boolean>;
    addCollaborator: (ticketId: string, userId: number, addedBy: number) => Promise<boolean>;
    removeCollaborator: (ticketId: string, userId: number) => Promise<boolean>;
    getTicketCollaborators: (ticketId: string) => Promise<any[]>;
    fetchTickets: () => Promise<void>;
    loadTicketActivities: (ticketId: string) => Promise<void>;
    folders: Folder[];
    fetchFolders: () => Promise<void>;
    createFolder: (name: string) => Promise<Folder | null>;
    deleteFolder: (folderId: number) => Promise<boolean>;
    renameFolder: (folderId: number, name: string) => Promise<boolean>;
    addTicketToFolder: (ticketId: string, folderId: number) => Promise<boolean>;
    removeTicketFromFolder: (ticketId: string, folderId: number) => Promise<boolean>;
    getTicketFolderId: (ticketId: string) => number | null;
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
    // Ref to track auth state without stale closures in callbacks/timeouts
    const isAuthenticatedRef = React.useRef(false);
    const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
        notification_emails: 'admin@gss-facility.com'
    });
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    // ticket_id -> folder_id mapping for the current user
    const [ticketFolderMap, setTicketFolderMap] = useState<Record<string, number>>({});
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isMobile, setIsMobile] = useState<boolean>(false);

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

    // Initialize useRouter
    // const router = useRouter(); // Already initialized above

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
                // Derived colors if missing (e.g., from DB refresh)
                const sanitizedData = data.map((t: any) => ({
                    ...t,
                    priorityColor: t.priorityColor || (PRIORITY_COLORS as any)[t.priority] || 'var(--priority-medium)',
                    statusColor: t.statusColor || (STATUS_COLORS as any)[t.status] || 'var(--status-new)'
                }));
                setTickets(sanitizedData);
                console.log('✅ Tickets loaded:', sanitizedData.length);
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
                // Ensure proper mapping and legacy support
                const mappedData = data.map((n: any) => ({
                    ...n,
                    ticketId: n.ticketId || n.ticket_id, // ensure camelCase for legacy code
                    timestamp: new Date(n.created_at) // Legacy support for sorting
                }));
                setNotifications(mappedData);
                console.log('✅ Notifications loaded:', mappedData.length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const refreshData = async (userOverride?: User) => {
        // Guard: never call APIs when not authenticated (prevents 401 flood on initial load)
        // Use ref to avoid stale closure issues with setTimeout/async calls
        if (!isAuthenticatedRef.current) return;
        setLoading(true);

        const activeUser = userOverride || currentUser;
        console.log('🔄 TicketContext: Refreshing data for', activeUser?.email, 'Role:', activeUser?.role);

        const promises = [
            fetchTickets(),
            fetchNotifications(),
            fetchSettings()
        ];

        const role = activeUser?.role?.toLowerCase();
        if (role === 'admin' || role === 'supervisor' || role === 'jefe') {
            console.log('👥 TicketContext: Role allows user fetching, calling fetchAllUsers');
            promises.push(fetchAllUsers());
        }

        await Promise.all(promises);
        setLoading(false);
    };

    // Mobile detection and restoration session on mount
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const restoreSession = async () => {
            console.log('🔄 TicketContext: Attempting session restoration...');
            try {
                // CRITICAL: Re-set the auth_token cookie from localStorage on every page load
                // This ensures the cookie is present for all requests even after a full page refresh
                const storedToken = localStorage.getItem('authToken');
                if (storedToken) {
                    console.log('🎫 TicketContext: Found stored token, setting cookie');
                    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toUTCString();
                    document.cookie = `auth_token=${storedToken}; path=/; expires=${expires}; SameSite=Lax`;
                }

                // Try to restore from server (cookie OR header)
                console.log('🔍 TicketContext: Fetching /api/auth/me');
                const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        console.log('✅ TicketContext: Session restored for', data.user.email);
                        setIsAuthenticated(true);
                        isAuthenticatedRef.current = true;
                        setCurrentUser(data.user);
                        // Fetch data ONLY if authenticated
                        // Note: refreshData will internally check roles for sensitive APIs
                        refreshData(data.user);
                    } else {
                        console.log('⚠️ TicketContext: /api/auth/me returned ok but no user');
                        logout();
                    }
                } else if (res.status === 401) {
                    console.log('❌ TicketContext: Session unauthorized (401)');
                    // Only call logout if we actually had a reason to believe we were logged in
                    if (storedToken || isAuthenticatedRef.current) {
                        logout();
                    }
                    setLoading(false);
                } else {
                    console.log('❌ TicketContext: Session restore failed with status', res.status);
                    setLoading(false);
                }
            } catch (e) {
                console.error("❌ TicketContext: Error restoring session", e);
                setLoading(false);
            }
        };

        restoreSession();
        return () => window.removeEventListener('resize', checkMobile);
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



    const loadTicketActivities = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/activities`, { headers: getAuthHeaders() });
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

    const login = (userData: User, token?: string) => {
        // CRITICAL: Save token BEFORE calling refreshData so getAuthHeaders() works
        if (token) {
            localStorage.setItem('authToken', token);
            // Also set as a regular browser cookie so it's sent automatically in ALL requests
            const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toUTCString(); // 2 hours
            document.cookie = `auth_token=${token}; path=/; expires=${expires}; SameSite=Lax`;
        }
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        isAuthenticatedRef.current = true; // Sync ref BEFORE setTimeout fires
        setIsAuthenticated(true);
        setCurrentUser(userData);
        // Give time for cookies to propagate
        setTimeout(() => refreshData(userData), 300);
    };

    const logout = () => {
        console.log('🔐 TicketContext: Logging out, clearing session data');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        // Clear the client-set auth cookie
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        isAuthenticatedRef.current = false;
        setIsAuthenticated(false);
        setCurrentUser(null);
    };

    const addTicket = async (ticketData: Omit<Ticket, 'id' | 'date' | 'priorityColor' | 'statusColor'>): Promise<void> => {
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Build ticket without ID — the server will assign it
        const ticketPayload = {
            ...ticketData,
            date: dateStr,
            priorityColor: PRIORITY_COLORS[ticketData.priority],
            statusColor: STATUS_COLORS[ticketData.status],
            requester: ticketData.requester || currentUser?.name || 'Anónimo',
            requesterEmail: ticketData.requesterEmail || currentUser?.email,
            affectedWorker: ticketData.affectedWorker,
            supervisor: ticketData.supervisor,
            attachmentUrl: (ticketData as any).attachmentUrl,
            createdAt: now,
            collaboratorIds: (ticketData as any).collaboratorIds
        };

        try {
            // Save to Database — server returns the real sequential ID
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(ticketPayload)
            });

            const result = await res.json();
            if (!res.ok) {
                console.error('Error saving ticket:', result);
                return;
            }

            const newId: string = result.id;
            const newTicket: Ticket = { ...ticketPayload, id: newId };

            setTickets(prev => [newTicket, ...prev]);

            // In-App Notification for current user (the admin who created it)
            addNotification(newId, newTicket.subject, `Ticket creado exitosamente: ${newTicket.subject}`);

            // Find supervisor user object early — used in both notification and email
            const supervisorUser = allUsers.find(u => u.name === newTicket.supervisor);

            // In-App Notification for the assigned supervisor
            if (supervisorUser?.id) {
                fetch('/api/notifications', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        action: 'create_for_user',
                        targetUserId: supervisorUser.id,
                        ticketId: newId,
                        ticketSubject: newTicket.subject,
                        message: `Se te asignó un nuevo ticket: "${newTicket.subject}" (creado por ${currentUser?.name || 'Admin'})`,
                        type: 'info'
                    })
                }).catch(err => console.error('Error creating supervisor notification:', err));
            }

            // In-App Notification + Email for all collaborators
            const collaboratorIds = (ticketData as any).collaboratorIds as number[] | undefined;
            if (Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
                for (const collabId of collaboratorIds) {
                    if (collabId === supervisorUser?.id || collabId === currentUser?.id) continue;
                    
                    fetch('/api/notifications', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            action: 'create_for_user',
                            targetUserId: collabId,
                            ticketId: newId,
                            ticketSubject: newTicket.subject,
                            message: `Fuiste agregado como colaborador en el ticket: "${newTicket.subject}" (creado por ${currentUser?.name || 'Admin'})`,
                            type: 'info'
                        })
                    }).catch(err => console.error('Error creating collaborator notification:', err));
                }
            }

            // Legacy support for single affectedWorker (if still used somehow)
            const collaboratorUser = allUsers.find(u => u.name === newTicket.affectedWorker);
            if (collaboratorUser?.id && collaboratorUser.id !== supervisorUser?.id && collaboratorUser.id !== currentUser?.id && !collaboratorIds?.includes(collaboratorUser.id)) {
                fetch('/api/notifications', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        action: 'create_for_user',
                        targetUserId: collaboratorUser.id,
                        ticketId: newId,
                        ticketSubject: newTicket.subject,
                        message: `Fuiste agregado como colaborador en el ticket: "${newTicket.subject}" (creado por ${currentUser?.name || 'Admin'})`,
                        type: 'info'
                    })
                }).catch(err => console.error('Error creating collaborator notification:', err));
            }

            // Team ticket: notify each team member (in-app + email)
            const teamTasks = (ticketData as any).teamTasks as Array<{ userId: number; userName: string; task: string }> | undefined;
            if ((ticketData as any).isTeamTicket && Array.isArray(teamTasks) && teamTasks.length > 0) {
                for (const task of teamTasks) {
                    if (task.userId === currentUser?.id) continue; // jefe already got "created" notification
                    fetch('/api/notifications', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            action: 'create_for_user',
                            targetUserId: task.userId,
                            ticketId: newId,
                            ticketSubject: newTicket.subject,
                            message: `Fuiste asignado a un ticket de equipo: "${newTicket.subject}". Tu tarea: ${task.task}`,
                            type: 'info'
                        })
                    }).catch(err => console.error('Error creating team member notification:', err));
                }

                // Email to each team member
                const memberEmails = teamTasks
                    .filter((t) => t.userId !== currentUser?.id)
                    .map((t) => allUsers.find(u => u.id === t.userId)?.email)
                    .filter(Boolean) as string[];

                if (memberEmails.length > 0) {
                    const teamEmailBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #7c3aed; margin-bottom: 10px;">👥 Ticket de Equipo Asignado</h2>
  <p>El jefe <strong>${currentUser?.name}</strong> te asignó una tarea en un ticket de equipo:</p>

  <div style="background-color: #f5f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #7c3aed;">
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li><strong>📌 Asunto:</strong> ${newTicket.subject}</li>
      <li><strong>🏢 Departamento:</strong> ${newTicket.department}</li>
      <li><strong>🚦 Prioridad:</strong> ${newTicket.priority}</li>
      <li><strong>📅 Fecha:</strong> ${newTicket.date}</li>
    </ul>
  </div>
  <p style="margin-top: 16px;">Por favor, ingresá al portal para ver tu tarea asignada y marcarla cuando la completes.</p>
</div>`.trim();

                    fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: memberEmails,
                            subject: `[TICKET DE EQUIPO] ${newTicket.subject}`,
                            body: teamEmailBody,
                            ticketData: {
                                id: newId,
                                subject: newTicket.subject,
                                department: newTicket.department,
                                priority: newTicket.priority,
                                date: newTicket.date,
                                requesterEmail: currentUser?.email
                            }
                        })
                    }).catch(err => console.error('Error sending team ticket email:', err));
                }
            }

            // Email notification
            const deptEmailKey = `notification_emails_${newTicket.department}`.replace(/\s+/g, '_');
            const emailString = systemSettings[deptEmailKey] || systemSettings.notification_emails || systemSettings.notification_email || '';
            const emailList = emailString.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);

            console.log(`📧 TicketContext: Encontrados ${emailList.length} correos para el departamento ${newTicket.department} (clave: ${deptEmailKey})`);

            if (emailList.length > 0) {
                const emailBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb; margin-bottom: 10px;">🎫 Nuevo Ticket Registrado</h2>
  <p>Se ha registrado una nueva solicitud en el portal:</p>

  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li><strong>📌 Asunto:</strong> ${newTicket.subject}</li>
      <li><strong>👤 Solicitante:</strong> ${newTicket.requester}</li>
      ${newTicket.affectedWorker ? `<li><strong>🤝 Colaborador:</strong> ${newTicket.affectedWorker}</li>` : ''}
      <li><strong>📧 Email:</strong> ${currentUser?.email}</li>
      <li><strong>🏢 Sector/Departamento:</strong> ${newTicket.department}</li>
      <li><strong>🚦 Prioridad:</strong> ${newTicket.priority}</li>
      <li><strong>📅 Fecha/Hora:</strong> ${newTicket.date}</li>
    </ul>
  </div>

  <h3 style="margin-top: 20px; color: #4b5563;">📝 Descripción:</h3>
  <p style="background-color: #fff; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px;">
    ${newTicket.description}
  </p>

  <p style="margin-top: 20px; font-style: italic; color: #6b7280; font-size: 0.9em;">
    Por favor, ingrese al portal administrativo para gestionar esta solicitud.
  </p>
</div>`.trim();

                // Add supervisor and collaborator emails to the recipients list if available
                const finalTo = [...emailList];
                if (supervisorUser?.email) finalTo.push(supervisorUser.email);
                if (collaboratorUser?.email && collaboratorUser.email !== supervisorUser?.email) {
                    finalTo.push(collaboratorUser.email);
                }

                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: finalTo,
                        subject: `[NUEVO TICKET] ${newTicket.subject}`,
                        body: emailBody,
                        ticketData: {
                            id: newId,
                            requester: newTicket.requester,
                            requesterEmail: currentUser?.email,
                            affectedWorker: newTicket.affectedWorker,
                            department: newTicket.department,
                            subject: newTicket.subject,
                            description: newTicket.description,
                            priority: newTicket.priority,
                            date: newTicket.date,
                            deptEmails: emailString,
                            supervisorEmail: supervisorUser?.email || ''
                        }
                    })
                }).catch(err => console.error('Error triggering notification:', err));
            }
        } catch (err) {
            console.error('Error creating ticket:', err);
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
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ message, type: 'comment' })
            });

            if (!res.ok) {
                console.error('Failed to save activity');
            }

            // Send in-app notification only (no email on comments)
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket && (currentUser?.id ?? 0) > 0) {
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

    const addNotification = async (ticketId: string, ticketSubject: string, message: string, statusColor?: string) => {
        // Optimistic update
        const tempId = Date.now();
        const newNotification: Notification = {
            id: tempId,
            user_id: currentUser?.id || 0,
            ticket_id: ticketId,
            message,
            type: 'info',
            read: 0,
            created_at: new Date().toISOString(),
            ticketId,
            ticketSubject,
            timestamp: new Date(),
            statusColor
        };
        setNotifications(prev => [newNotification, ...prev]);

        // Persist to DB
        try {
            await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    action: 'create',
                    ticketId,
                    ticketSubject,
                    message,
                    type: 'info',
                    statusColor
                })
            });
        } catch (err) {
            console.error('Error persisting notification:', err);
        }
    };

    const markNotificationRead = (notificationId: number) => {
        // Update local state first (optimistic)
        setNotifications(prev =>
            prev.map(notif =>
                notif.id === notificationId ? { ...notif, read: 1 } : notif
            )
        );

        // Persist to DB
        fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ notificationId, action: 'mark_read' })
        }).catch(err => console.error('Error marking notification read:', err));
    };

    const deleteNotification = (notificationId: number) => {
        // Delete from DB
        fetch(`/api/notifications?id=${notificationId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        }).catch(err => console.error('Error deleting notification:', err));

        // Optimistic update
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    };

    const markAllNotificationsRead = () => {
        // Persist to DB
        fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ action: 'mark_all_read' })
        }).catch(err => console.error('Error marking all notifications read:', err));

        setNotifications(prev =>
            prev.map(notif => ({ ...notif, read: 1 }))
        );
    };

    const clearAllNotifications = () => {
        // Delete all from DB
        fetch('/api/notifications?all=true', { method: 'DELETE', headers: getAuthHeaders() })
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
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ status: newStatus })
        }).catch(err => console.error('Error persisting ticket status to DB:', err));

        // Add activity log with the actual user name
        addActivity(ticketId, currentUser?.name || 'Sistema', `Estado cambiado a: ${newStatus}`);

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
                user_id: currentUser?.id || 0,
                ticket_id: ticketId,
                message: `Ticket #${ticketId} - "${ticket.subject}": estado cambiado a ${newStatus} por ${currentUser?.name || 'Sistema'}`,
                type: 'status_change',
                read: 0,
                created_at: new Date().toISOString(),
                ticketId, // Legacy support
                ticketSubject: ticket.subject, // Legacy support
                timestamp: new Date(), // Legacy support
                statusColor: statusColors[newStatus] // Legacy support
            };
            setNotifications(prev => [notification, ...prev]);

            // Send email notification for status changes
            const resolvedBy = currentUser?.name || 'Sistema';
            const resolvedByEmail = currentUser?.email || '';
            const requesterEmail = ticket.requesterEmail || '';
            const requesterName = ticket.requester || 'Usuario';

            // Prepare email recipients: always notify the requester
            const recipients = [];
            if (requesterEmail) recipients.push(requesterEmail);

            // If it's being resolved, also notify the resolver if different
            if (newStatus === 'Resuelto' && resolvedByEmail && resolvedByEmail !== requesterEmail) {
                recipients.push(resolvedByEmail);
            }

            if (recipients.length > 0) {
                const isResolved = newStatus === 'Resuelto';
                const statusEmoji = isResolved ? '✅' : '🔄';
                const statusColor = isResolved ? '#059669' : '#2563eb';
                const emailSubject = isResolved
                    ? `[TICKET RESUELTO] ${ticket.subject}`
                    : `[ACTUALIZACIÓN TICKET] ${ticket.subject}`;

                const emailBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: ${statusColor}; margin-bottom: 10px;">${statusEmoji} Ticket ${newStatus.toUpperCase()}</h2>
  <p>El ticket <strong>#${ticket.id}</strong> ha cambiado de estado.</p>
  
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor};">
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li><strong>📌 Asunto:</strong> ${ticket.subject}</li>
      <li><strong>🏢 Departamento:</strong> ${ticket.department}</li>
      <li><strong>🚦 Prioridad:</strong> ${ticket.priority}</li>
      <li><strong>👤 Solicitante:</strong> ${requesterName} (${requesterEmail})</li>
      <li><strong>✍️ Actualizado por:</strong> ${resolvedBy}</li>
      <li><strong>📅 Fecha de reporte:</strong> ${ticket.date}</li>
      <li><strong>🕒 Última actualización:</strong> ${new Date().toLocaleString('es-AR')}</li>
    </ul>
  </div>

  <h3 style="margin-top: 20px; color: #4b5563;">📝 Descripción original:</h3>
  <p style="background-color: #fff; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px;">
    ${ticket.description || 'N/A'}
  </p>

  <p style="margin-top: 20px; font-weight: bold; color: ${statusColor}; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px;">
    Gracias por utilizar el sistema de tickets GSS.
  </p>
</div>`.trim();

                const supervisorUser = allUsers.find(u => u.name === ticket.supervisor);

                // Fetch department emails from settings
                const deptEmailKey = `notification_emails_${ticket.department}`.replace(/\s+/g, '_');
                const deptEmailString = systemSettings[deptEmailKey] || systemSettings.notification_emails || systemSettings.notification_email || '';

                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: recipients,
                        subject: emailSubject,
                        body: emailBody,
                        ticketData: {
                            id: ticket.id,
                            subject: ticket.subject,
                            department: ticket.department,
                            priority: ticket.priority,
                            requester: requesterName,
                            requesterEmail: requesterEmail,
                            status: newStatus,
                            description: ticket.description,
                            affectedWorker: ticket.affectedWorker,
                            date: ticket.date,
                            deptEmails: deptEmailString,
                            supervisorEmail: supervisorUser?.email || ''
                        }
                    })
                }).catch(err => console.error('Error triggering status email:', err));
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
                headers: getAuthHeaders(),
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
                headers: getAuthHeaders(),
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

    const deleteTicket = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                setTickets(prev => prev.filter(t => t.id !== ticketId));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting ticket:', error);
            return false;
        }
    };
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const transferTicket = async (ticketId: string, newSupervisorId: number, transferredBy: number, reason?: string) => {
        try {
            console.log('📡 API Call - Transfer Ticket:', { ticketId, newSupervisorId, transferredBy, reason });
            const res = await fetch(`/api/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            return res.ok;
        } catch (error) {
            console.error('Error removing collaborator:', error);
            return false;
        }
    };

    const getTicketCollaborators = async (ticketId: string) => {
        try {
            const res = await fetch(`/api/tickets/${ticketId}/collaborators`, { headers: getAuthHeaders() });
            if (res.ok) {
                return await res.json();
            }
            return [];
        } catch (error) {
            console.error('Error fetching collaborators:', error);
            return [];
        }
    };

    const fetchFolders = async () => {
        try {
            const res = await fetch('/api/folders', { headers: getAuthHeaders() });
            if (res.ok) {
                const data: Folder[] = await res.json();
                setFolders(data);
                // Rebuild the ticket->folder map
                const map: Record<string, number> = {};
                await Promise.all(data.map(async (folder) => {
                    const r = await fetch(`/api/folders/${folder.id}/tickets`, { headers: getAuthHeaders() });
                    if (r.ok) {
                        const tickets = await r.json();
                        tickets.forEach((t: any) => { map[t.id] = folder.id; });
                    }
                }));
                setTicketFolderMap(map);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    };

    const createFolder = async (name: string): Promise<Folder | null> => {
        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const folder = await res.json();
                setFolders(prev => [{ ...folder, ticketCount: 0 }, ...prev]);
                return folder;
            }
            return null;
        } catch (error) {
            return null;
        }
    };

    const deleteFolder = async (folderId: number): Promise<boolean> => {
        try {
            const res = await fetch(`/api/folders/${folderId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                setFolders(prev => prev.filter(f => f.id !== folderId));
                setTicketFolderMap(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => { if (next[k] === folderId) delete next[k]; });
                    return next;
                });
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const renameFolder = async (folderId: number, name: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/folders/${folderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const addTicketToFolder = async (ticketId: string, folderId: number): Promise<boolean> => {
        try {
            const res = await fetch(`/api/folders/${folderId}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ticketId })
            });
            if (res.ok) {
                setTicketFolderMap(prev => ({ ...prev, [ticketId]: folderId }));
                setFolders(prev => prev.map(f => {
                    const wasInFolder = ticketFolderMap[ticketId] === f.id;
                    if (f.id === folderId) return { ...f, ticketCount: f.ticketCount + 1 };
                    if (wasInFolder) return { ...f, ticketCount: Math.max(0, f.ticketCount - 1) };
                    return f;
                }));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const removeTicketFromFolder = async (ticketId: string, folderId: number): Promise<boolean> => {
        try {
            const res = await fetch(`/api/folders/${folderId}/tickets`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ ticketId })
            });
            if (res.ok) {
                setTicketFolderMap(prev => {
                    const next = { ...prev };
                    delete next[ticketId];
                    return next;
                });
                setFolders(prev => prev.map(f =>
                    f.id === folderId ? { ...f, ticketCount: Math.max(0, f.ticketCount - 1) } : f
                ));
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const getTicketFolderId = (ticketId: string): number | null => {
        return ticketFolderMap[ticketId] ?? null;
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
            markAllNotificationsRead,
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
            deleteTicket,
            updateUser,
            isSidebarOpen,
            toggleSidebar,
            pendingUsers,
            fetchAllUsers,
            loading,
            isMobile,
            allUsers,
            getAuthHeaders,
            transferTicket,
            addCollaborator,
            removeCollaborator,
            getTicketCollaborators,
            fetchTickets,
            loadTicketActivities,
            folders,
            fetchFolders,
            createFolder,
            deleteFolder,
            renameFolder,
            addTicketToFolder,
            removeTicketFromFolder,
            getTicketFolderId
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
