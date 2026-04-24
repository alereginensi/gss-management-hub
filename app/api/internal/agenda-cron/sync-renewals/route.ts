import { NextRequest, NextResponse } from 'next/server';
import { isValidCronRequest } from '@/lib/cron-auth';
import { syncEmployeeRenewalStatus } from '@/lib/agenda-helpers';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const habilitados = await syncEmployeeRenewalStatus();
    console.log(`[agenda-cron] sync-renewals: habilitados=${habilitados}`);
    return NextResponse.json({ habilitados });
  } catch (err) {
    console.error('[agenda-cron] sync-renewals ERROR:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
