// Tipos TypeScript para el módulo Agenda Web de Uniformes

export type WorkplaceCategory = string;

export type EmpresaKey = 'REIMA' | 'ORBIS' | 'SCOUT' | 'ERGON' | string;

export type AppointmentStatus =
  | 'confirmada'
  | 'en_proceso'
  | 'completada'
  | 'cancelada'
  | 'ausente'
  | 'reprogramada';

export type ArticleStatus = 'activo' | 'renovado' | 'devuelto' | 'extraviado';
export type ConditionStatus = 'nuevo' | 'reutilizable' | 'deteriorado' | 'dado_de_baja';
export type OriginType =
  | 'entrega_inicial'
  | 'renovacion'
  | 'solicitud_emergente'
  | 'migracion'
  | 'cambio';

export type RequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'entregada';
export type ShipmentStatus =
  | 'preparado'
  | 'despachado'
  | 'en_transito'
  | 'entregado'
  | 'recibido'
  | 'incidente';

export type EmployeeEstado = 'activo' | 'inactivo' | 'baja';
export type SlotEstado = 'activo' | 'cancelado' | 'completo';

// ─── Empleados ────────────────────────────────────────────────────────────────

export interface AgendaEmployee {
  id: number;
  documento: string;
  nombre: string;
  empresa?: string;
  sector?: string;
  puesto?: string;
  workplace_category?: WorkplaceCategory;
  fecha_ingreso?: string;
  talle_superior?: string;
  talle_inferior?: string;
  calzado?: string;
  enabled: number; // 1 | 0
  allow_reorder: number; // 1 | 0
  estado: EmployeeEstado;
  observaciones?: string;
  created_by?: number;
  created_at: string;
}

export interface AgendaEmployeeInput {
  documento: string;
  nombre: string;
  empresa?: string;
  sector?: string;
  puesto?: string;
  workplace_category?: WorkplaceCategory;
  fecha_ingreso?: string;
  talle_superior?: string;
  talle_inferior?: string;
  calzado?: string;
  enabled?: number;
  allow_reorder?: number;
  estado?: EmployeeEstado;
  observaciones?: string;
}

// ─── Turnos (Time Slots) ─────────────────────────────────────────────────────

export interface AgendaTimeSlot {
  id: number;
  fecha: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  capacity: number;
  current_bookings: number;
  held_until?: string;
  hold_token?: string;
  estado: SlotEstado;
  created_at: string;
  // Calculated
  available?: number;
  is_held?: boolean;
}

// ─── Citas (Appointments) ────────────────────────────────────────────────────

export interface OrderItem {
  article_type: string;
  size?: string;
  qty: number;
}

export interface AgendaAppointment {
  id: number;
  employee_id: number;
  time_slot_id: number;
  status: AppointmentStatus;
  order_items?: OrderItem[] | string;
  delivered_order_items?: OrderItem[] | string;
  remito_number?: string;
  remito_pdf_url?: string;
  parsed_remito_text?: string;
  parsed_remito_data?: string;
  employee_signature_url?: string;
  responsible_signature_url?: string;
  delivery_notes?: string;
  delivered_at?: string;
  delivered_by?: number;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: AgendaEmployee;
  slot?: AgendaTimeSlot;
}

export interface AgendaAppointmentItemChange {
  id: number;
  appointment_id: number;
  before_items: OrderItem[] | string;
  after_items: OrderItem[] | string;
  reason?: string;
  changed_by?: number;
  created_at: string;
}

// ─── Configuración ───────────────────────────────────────────────────────────

export interface AgendaConfig {
  id: 1;
  min_advance_hours: number;
  hold_duration_seconds: number;
  public_contact_whatsapp?: string;
  allow_reorder_global: number;
  slot_duration_minutes: number;
  slots_per_day: number;
  auto_generate_day: number;
  updated_at: string;
}

// ─── Intentos fallidos ───────────────────────────────────────────────────────

export type FailedAttemptMotivo = 'not_found' | 'not_enabled' | 'validation_error';

export interface AgendaFailedAttempt {
  id: number;
  documento: string;
  motivo: FailedAttemptMotivo;
  ip?: string;
  user_agent?: string;
  context?: string;
  created_at: string;
}

// ─── Catálogo de uniformes ───────────────────────────────────────────────────

export interface AgendaUniformCatalogItem {
  id: number;
  empresa?: string | null;
  sector?: string | null;
  puesto?: string | null;
  workplace_category?: string | null;
  article_type: string;
  article_name_normalized?: string | null;
  quantity: number;
  useful_life_months: number;
  initial_enabled: number;
  renewable: number;
  reusable_allowed: number;
  special_authorization_required: number;
  created_at: string;
}

// ─── Artículos entregados ────────────────────────────────────────────────────

export interface AgendaArticle {
  id: number;
  employee_id: number;
  appointment_id?: number;
  article_type: string;
  size?: string;
  condition_status: ConditionStatus;
  delivery_date: string;
  useful_life_months: number;
  expiration_date?: string;
  renewal_enabled_at?: string;
  current_status: ArticleStatus;
  origin_type: OriginType;
  notes?: string;
  created_by?: number;
  migrated_flag: number;
  created_at: string;
  // Joined
  employee?: AgendaEmployee;
}

// ─── Solicitudes emergentes ──────────────────────────────────────────────────

export type RequestSource = 'logistica' | 'limpieza' | 'seguridad' | 'rrhh';

export interface AgendaRequest {
  id: number;
  employee_id: number;
  article_type: string;
  size?: string;
  reason: string;
  requested_at: string;
  requested_by?: number;
  approved_by?: number;
  approved_at?: string;
  approval_signature_url?: string;
  status: RequestStatus;
  legal_text_version: string;
  notes?: string;
  resulting_article_id?: number;
  is_emergency?: number;
  source?: RequestSource;
  employee?: AgendaEmployee;
}

export const LEGAL_TEXT_V1 = `Responsabilidad del supervisor en la gestión de prendas por casos especiales: El supervisor o personal de staff que autorice la entrega de una prenda fuera del proceso estándar asume plena responsabilidad sobre el destino, uso y devolución de la misma. Toda solicitud de este tipo debe quedar debidamente registrada en el sistema con el motivo declarado y la identidad del autorizante. En caso de que la prenda no sea devuelta en tiempo y forma, o que no se acredite el destino declarado, el supervisor responsable podrá ser pasible de sanciones disciplinarias y/o económicas conforme a la normativa interna vigente. La firma o validación digital de la solicitud tiene carácter de declaración formal y compromiso de seguimiento por parte del autorizante.`;

// ─── Envíos al interior ──────────────────────────────────────────────────────

export interface AgendaShipment {
  id: number;
  employee_id: number;
  tracking_number?: string;
  carrier?: string;
  shipment_status: ShipmentStatus;
  dispatched_at?: string;
  delivered_at?: string;
  receiver_signature_url?: string;
  notes?: string;
  created_by?: number;
  created_at: string;
  employee?: AgendaEmployee;
  articles?: AgendaArticle[];
}

// ─── Jobs de importación ─────────────────────────────────────────────────────

export type ImportJobType = 'employees' | 'articles_migration';

export interface AgendaImportJob {
  id: number;
  type: ImportJobType;
  file_name?: string;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  error_log?: string; // JSON: { row, field, message }[]
  processed_by?: number;
  processed_at: string;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors: ImportError[];
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'approve'
  | 'reject'
  | 'lookup_failed'
  | 'hold'
  | 'release'
  | 'complete_delivery'
  | 'revert_delivery'
  | 'upload_remito'
  | 'upload_signature'
  | 'config_change';

export type AuditEntityType =
  | 'employee'
  | 'appointment'
  | 'slot'
  | 'article'
  | 'request'
  | 'shipment'
  | 'catalog'
  | 'config'
  | 'import';

export interface AgendaAuditLog {
  id: number;
  module: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: number;
  user_id?: number;
  details?: string; // JSON
  created_at: string;
}

// ─── Parseo de remito ────────────────────────────────────────────────────────

export interface RemitoItem {
  raw: string;
  article_type?: string;
  qty: number;
  matched: boolean;
}

export interface RemitoParseResult {
  matched: RemitoItem[];
  unmatched: string[];
  special: string[]; // líneas tipo "R - ..."
}

// ─── Generación de slots ─────────────────────────────────────────────────────

export interface SlotGenerationParams {
  year: number;
  month: number; // 1-12
  days_of_week: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Thu, 4=Wed, 5=Fri, 6=Sat
  start_hour: string; // HH:MM
  end_hour: string; // HH:MM
  slot_duration_minutes: number;
  break_minutes: number;
  capacity: number;
}
