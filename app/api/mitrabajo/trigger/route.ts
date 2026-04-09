import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { execFile } from 'child_process';
import path from 'path';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'download-mitrabajo.cjs');

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
    return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !hasMitrabajoAccess(session.user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetDate: string | undefined = body.date; // YYYY-MM-DD opcional

    return new Promise<NextResponse>((resolve) => {
        const args = ['node', SCRIPT_PATH];
        if (targetDate) args.push(targetDate);

        execFile(args[0], args.slice(1), { env: process.env, timeout: 120_000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('[mitrabajo trigger]', error.message);
                console.error(stderr);
                resolve(NextResponse.json({
                    ok: false,
                    error: error.message,
                    details: stderr,
                }, { status: 500 }));
            } else {
                resolve(NextResponse.json({ ok: true, output: stdout }));
            }
        });
    });
}
