export type Organismo = 'MTSS' | 'Juzgado';
export type EstadoCitacion = 'pendiente' | 'en curso' | 'cerrado';
export type TipoFactura =
  | 'Asistencia MTSS'
  | 'Contestación demanda'
  | 'Acuerdo transaccional'
  | 'Asistencia juzgado'
  | 'Otros';

export interface Factura {
  id: string;
  nro: string;
  tipo: TipoFactura;
  monto: number;
}

export interface Citacion {
  id: string;
  empresa: string;
  org: Organismo;
  fecha: string;       // YYYY-MM-DD
  hora: string;        // HH:MM
  sede: string;
  trabajador: string;
  abogado: string;
  rubros: string;
  total: number;       // Total reclamado UYU
  estado: EstadoCitacion;
  motivo: string;
  acuerdo: string;
  macuerdo: number;    // Monto pagado en acuerdo UYU
  facturas: Factura[];
  obs: string;
  pdfUrl?: string | null;
  pdfFilename?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitacionParsedPdf {
  parsed: Partial<{
    empresa: string;
    org: Organismo;
    fecha: string;
    hora: string;
    sede: string;
    trabajador: string;
    abogado: string;
    rubros: string;
    total: number;
    motivo: string;
  }>;
  rawText: string;
  scanned: boolean;
  corruptedFields: string[];
  filename: string;
  size: number;
}

export interface CitacionFormData {
  empresa: string;
  org: Organismo;
  fecha: string;
  hora: string;
  sede: string;
  trabajador: string;
  abogado: string;
  rubros: string;
  total: number | '';
  estado: EstadoCitacion;
  motivo: string;
  acuerdo: string;
  macuerdo: number | '';
  facturas: Omit<Factura, 'id'>[];
  obs: string;
}

export interface CitacionesStats {
  total: number;
  pendientes: number;
  enCurso: number;
  cerrados: number;
  totalReclamado: number;
  totalAcuerdos: number;
  totalHonorarios: number;
}

export const TIPOS_FACTURA: TipoFactura[] = [
  'Asistencia MTSS',
  'Contestación demanda',
  'Acuerdo transaccional',
  'Asistencia juzgado',
  'Otros',
];

export const FORM_EMPTY: CitacionFormData = {
  empresa: '',
  org: 'MTSS',
  fecha: '',
  hora: '',
  sede: '',
  trabajador: '',
  abogado: '',
  rubros: '',
  total: '',
  estado: 'pendiente',
  motivo: '',
  acuerdo: '',
  macuerdo: '',
  facturas: [],
  obs: '',
};
