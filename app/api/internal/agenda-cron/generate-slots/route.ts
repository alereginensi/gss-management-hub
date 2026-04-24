import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isValidCronRequest } from '@/lib/cron-auth';
import { generateSlotsForMonth } from '@/lib/agenda-helpers';

export const maxDuration = 60;

interface AgendaConfigRow {
  slots_per_day: number | null;
  start_hour: string | null;
  end_hour: string | null;
  break_start: string | null;
  break_end: string | null;
}

export async function POST(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let { year, month } = body as { year?: number; month?: number };

    if (!year || !month) {
      // Default: mes siguiente al actual (hora del server)
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      year = next.getFullYear();
      month = next.getMonth() + 1;
    }

    const config = (await db.get(`SELECT slots_per_day, start_hour, end_hour, break_start, break_end FROM agenda_config WHERE id = 1`)) as AgendaConfigRow | null;

    const result = await generateSlotsForMonth({
      year: Number(year),
      month: Number(month),
      days_of_week: [2, 4], // martes y jueves por default
      start_hour: config?.start_hour ?? '09:00',
      end_hour: config?.end_hour ?? '17:00',
      num_slots: Number(config?.slots_per_day ?? 20),
      has_break: !!(config?.break_start && config?.break_end),
      break_start: config?.break_start ?? '12:00',
      break_end: config?.break_end ?? '13:00',
      capacity: 1,
    });

    console.log(`[agenda-cron] generate-slots ${year}-${String(month).padStart(2, '0')}: created=${result.created}, skipped=${result.skipped}`);
    return NextResponse.json({ year, month, ...result });
  } catch (err) {
    console.error('[agenda-cron] generate-slots ERROR:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
