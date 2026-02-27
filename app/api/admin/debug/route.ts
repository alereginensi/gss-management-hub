import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const isProduction = false;
    const dbPath = path.resolve(process.cwd(), 'tickets.db');
    const dbDir = path.dirname(dbPath);

    const diagnostics = {
        node_env: process.env.NODE_ENV,
        cwd: process.cwd(),
        db_path_resolved: dbPath,
        db_dir: dbDir,
        db_dir_exists: fs.existsSync(dbDir),
        db_file_exists: fs.existsSync(dbPath),
        db_connection_status: db ? 'Connected' : 'NULL (Failed)',
        db_type: (db as any).type || 'unknown',
        directory_contents: {},
        write_test: 'Not attempted'
    };

    if (diagnostics.db_dir_exists) {
        try {
            // @ts-ignore
            diagnostics.directory_contents = fs.readdirSync(dbDir);
        } catch (e: any) {
            // @ts-ignore
            diagnostics.directory_contents = `Error reading dir: ${e.message}`;
        }

        try {
            const testFile = path.join(dbDir, 'write_test.txt');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            diagnostics.write_test = 'Success';
        } catch (e: any) {
            diagnostics.write_test = `Failed: ${e.message}`;
        }
    }

    return NextResponse.json(diagnostics);
}
