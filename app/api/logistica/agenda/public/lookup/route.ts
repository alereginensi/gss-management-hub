import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCatalogForEmployee } from '@/lib/agenda-catalog';
import { getUniformsForEmpresa, type UniformItem } from '@/lib/agenda-uniforms';
import { syncEmployeeRenewalStatus } from '@/lib/agenda-helpers';

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function inferSizes(articleType: string): string[] {
  const norm = articleType.toLowerCase();
  if (/zapato|calzado|bota|croc|bot[ií]n/.test(norm)) return SHOE_SIZES;
  if (/casco|corbata|pa[ñn]uelo|gorra/.test(norm)) return ['Única'];
  return CLOTHING_SIZES;
}

function matchUniform(articleType: string, uniforms: UniformItem[]): UniformItem | null {
  const norm = normKey(articleType);
  let best: UniformItem | null = null, bestScore = 0;
  for (const u of uniforms) {
    const uNorm = normKey(u.name);
    const kws = uNorm.split(/\s+/).filter(w => w.length >= 2);
    if (!kws.length) continue;
    const hits = kws.filter(kw => norm.includes(kw)).length;
    const score = hits / kws.length;
    if (score > bestScore) { bestScore = score; best = u; }
  }
  return bestScore >= 0.5 ? best : null;
}

export async function POST(request: NextRequest) {
  try {
    const { documento } = await request.json();

    if (!documento?.trim()) {
      return NextResponse.json({ error: 'Documento requerido' }, { status: 400 });
    }

    const docNorm = documento.trim();

    // Buscar empleado
    const employee = await db.get(
      'SELECT * FROM agenda_employees WHERE documento = ?',
      [docNorm]
    );

    // Obtener config para el link de contacto
    const config = await db.get('SELECT public_contact_whatsapp FROM agenda_config WHERE id = 1');
    const whatsapp = config?.public_contact_whatsapp || null;

    const WHATSAPP_DEFAULT = 'https://api.whatsapp.com/send/?phone=59897655779&text=Hola%2C+consulta+sobre+mi+uniforme&type=phone_number&app_absent=0';
    const whatsappUrl = whatsapp || WHATSAPP_DEFAULT;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!employee) {
      // No registrado: NO se loguea como intento fallido (evita spam en admin)
      return NextResponse.json(
        { error: 'Tu documento no está registrado en el sistema.', reason: 'not_found' },
        { status: 404 }
      );
    }

    // Auto-habilitar si tiene artículos vencidos (feature A).
    // Se ejecuta al consultar para que sea instantáneo — el cron diario
    // es solo un safety net para casos donde nadie haya consultado.
    try {
      const updated = await syncEmployeeRenewalStatus(employee.id);
      if (updated > 0) {
        // Reflejar los flags en la response (sync los puso en 1).
        employee.enabled = 1;
        employee.allow_reorder = 1;
      }
    } catch (err) {
      console.warn('[lookup] sync renewal fallo (no crítico):', (err as Error).message);
    }

    if (!employee.enabled || employee.estado !== 'activo') {
      // Registrado pero inhabilitado: sí se loguea
      await db.run(
        'INSERT INTO agenda_failed_attempts (documento, motivo, ip) VALUES (?, ?, ?)',
        [docNorm, 'not_enabled', ip]
      );
      return NextResponse.json(
        { error: 'Tu documento está registrado pero no habilitado para retirar uniformes.', reason: 'not_enabled', whatsapp: whatsappUrl },
        { status: 403 }
      );
    }

    // Bloqueo por turno activo: si el empleado ya tiene una cita confirmada o
    // en proceso con fecha >= hoy, no permitir agendar otra hasta que esa cita
    // se complete, cancele o quede como ausente. Mostrar los datos de la cita
    // existente para que el usuario sepa cuál es.
    const hoyIso = new Date().toISOString().slice(0, 10);
    const turnoActivo = await db.get(
      `SELECT a.id, a.status, a.order_items, s.fecha, s.start_time, s.end_time
       FROM agenda_appointments a
       JOIN agenda_time_slots s ON s.id = a.time_slot_id
       WHERE a.employee_id = ?
         AND a.status IN ('confirmada', 'en_proceso')
         AND s.fecha >= ?
       ORDER BY s.fecha ASC, s.start_time ASC
       LIMIT 1`,
      [employee.id, hoyIso]
    );

    if (turnoActivo) {
      let items: Array<{ article_type?: string; size?: string; color?: string; qty?: number }> = [];
      try {
        const raw = turnoActivo.order_items;
        if (typeof raw === 'string' && raw) items = JSON.parse(raw);
        else if (Array.isArray(raw)) items = raw;
      } catch {
        items = [];
      }

      await db.run(
        'INSERT INTO agenda_failed_attempts (documento, motivo, ip) VALUES (?, ?, ?)',
        [docNorm, 'already_scheduled', ip]
      ).catch(() => {});

      return NextResponse.json(
        {
          error: 'Ya tenés un turno agendado.',
          reason: 'already_scheduled',
          scheduled_appointment: {
            id: turnoActivo.id,
            status: turnoActivo.status,
            fecha: typeof turnoActivo.fecha === 'string' ? turnoActivo.fecha.slice(0, 10) : String(turnoActivo.fecha).slice(0, 10),
            start_time: turnoActivo.start_time,
            end_time: turnoActivo.end_time,
            order_items: items,
          },
        },
        { status: 409 }
      );
    }

    // Obtener catálogo de la empresa del empleado
    const catalog = await getCatalogForEmployee(
      employee.empresa,
      employee.sector,
      employee.puesto,
      employee.workplace_category
    );

    // Feature B: obtener artículos vencidos del empleado (para limitar el pedido).
    // Si el empleado tiene artículos vencidos, SOLO podrá pedir renovación de esos.
    // Si no tiene ninguno (primera entrega o habilitado manual sin vencimientos),
    // el front muestra el catálogo completo.
    // Comparación TEXT vs TEXT con ISO YYYY-MM-DD (PG no auto-castea TEXT→DATE).
    const todayIso = new Date().toISOString().slice(0, 10);
    const expiredArticles = await db.query(
      `SELECT id, article_type, size, delivery_date, expiration_date, useful_life_months
       FROM agenda_articles
       WHERE employee_id = ?
         AND current_status = 'activo'
         AND expiration_date IS NOT NULL
         AND expiration_date <= ?
       ORDER BY expiration_date ASC`,
      [employee.id, todayIso]
    );

    // Obtener citas previas (historial breve)
    const prevAppointments = await db.query(
      `SELECT a.id, a.status, a.order_items, a.delivered_order_items, a.created_at,
              s.fecha, s.start_time
       FROM agenda_appointments a
       JOIN agenda_time_slots s ON s.id = a.time_slot_id
       WHERE a.employee_id = ?
       ORDER BY a.created_at DESC LIMIT 5`,
      [employee.id]
    );

    const uniforms = getUniformsForEmpresa(employee.empresa || '');
    const catalogWithSizes = catalog.map(item => {
      const match = matchUniform(item.article_type, uniforms);
      return {
        ...item,
        sizes: match?.sizes ?? inferSizes(item.article_type),
        colors: match?.colors ?? undefined,
      };
    });

    return NextResponse.json({
      employee: {
        id: employee.id,
        nombre: employee.nombre,
        empresa: employee.empresa,
        sector: employee.sector,
        puesto: employee.puesto,
        workplace_category: employee.workplace_category,
        talle_superior: employee.talle_superior,
        talle_inferior: employee.talle_inferior,
        calzado: employee.calzado,
        allow_reorder: employee.allow_reorder,
      },
      catalog: catalogWithSizes,
      renewable_articles: expiredArticles,
      previous_appointments: prevAppointments,
    });
  } catch (err) {
    console.error('Error en lookup de empleado:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
