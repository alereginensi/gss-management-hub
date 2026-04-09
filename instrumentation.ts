/**
 * instrumentation.ts
 *
 * Se ejecuta una sola vez cuando Next.js arranca en el servidor.
 * Registra el cron de descarga automática de mitrabajo.uy (08:00 AM Uruguay).
 *
 * Solo corre en runtime Node.js (no Edge). Solo activo si las variables
 * MITRABAJO_USER y MITRABAJO_PASS están configuradas.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const user = process.env.MITRABAJO_USER;
    const pass = process.env.MITRABAJO_PASS;

    if (!user || !pass) {
        console.log('[mitrabajo-cron] MITRABAJO_USER/PASS no configurados — cron desactivado.');
        return;
    }

    const cron = (await import('node-cron')).default;
    const { execFile } = await import('child_process');
    const path = await import('path');

    const scriptPath = path.join(process.cwd(), 'scripts', 'download-mitrabajo.cjs');

    cron.schedule('0 8 * * *', () => {
        const timestamp = new Date().toISOString();
        console.log(`[mitrabajo-cron] ${timestamp} — Iniciando descarga automática...`);

        execFile('node', [scriptPath], { env: process.env, timeout: 120_000 }, (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) {
                console.error('[mitrabajo-cron] ERROR:', error.message);
            } else {
                console.log('[mitrabajo-cron] Descarga completada.');
            }
        });
    }, {
        timezone: 'America/Montevideo',
        scheduled: true,
    });

    console.log('[mitrabajo-cron] Cron registrado — descarga diaria a las 08:00 AM (America/Montevideo).');
}
