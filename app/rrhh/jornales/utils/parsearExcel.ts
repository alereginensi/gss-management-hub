/**
 * utils/parsearExcel.ts — lectura de archivos Excel del lado cliente.
 * Usado por TabAltas y TabBajas para generar previews antes de persistir.
 */

export type ExcelRow = Record<string, unknown>;

export function leerExcel(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    import('xlsx')
      .then((XLSX) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result;
            if (!result) throw new Error('Lectura vacía');
            const wb = XLSX.read(result, { type: 'binary', cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
              raw: false,
              dateNF: 'dd/mm/yyyy',
            });
            resolve(rows);
          } catch (err: any) {
            reject(new Error(`Error al leer ${file.name}: ${err?.message || err}`));
          }
        };
        reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
        reader.readAsBinaryString(file);
      })
      .catch(reject);
  });
}

export function findCol(row: ExcelRow, keys: string[]): string {
  for (const k of keys) {
    const val = (row as any)[k];
    if (val !== undefined && String(val).trim() !== '') return String(val).trim();
    for (const rk in row) {
      if (
        rk.trim().toLowerCase() === k.toLowerCase() &&
        (row as any)[rk] !== undefined &&
        String((row as any)[rk]).trim() !== ''
      ) {
        return String((row as any)[rk]).trim();
      }
    }
  }
  return '';
}

export interface PersonaLite {
  id: string;
  nombre: string;
  doc: string;
}

export function parsearPersonal(rows: ExcelRow[]): PersonaLite[] {
  const personal: PersonaLite[] = [];
  for (const r of rows) {
    const id = findCol(r, ['Padron', 'Padrón', 'ID', 'Numero de empleado', 'Número de empleado', 'padron']);
    const nombre = findCol(r, ['Nombre', 'nombre']);
    const apellido = findCol(r, ['Apellido', 'apellido']);
    const doc = findCol(r, ['Cedula', 'Cédula', 'CI', 'Documento', 'documento']);
    if (!id || !nombre) continue;
    personal.push({
      id,
      nombre: nombre + (apellido ? ' ' + apellido : ''),
      doc: doc || '',
    });
  }
  return personal;
}
