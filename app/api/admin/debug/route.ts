import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';

export async function GET() {
    const isProduction = process.env.NODE_ENV === 'production';
    const dbPath = isProduction
        ? path.resolve('/app/data/tickets.db')
        : path.resolve(process.cwd(), 'tickets.db');

    const dbDir = path.dirname(dbPath);

    const diagnostics = {
        node_env: process.env.NODE_ENV,
        cwd: process.cwd(),
        db_path_resolved: dbPath,
        db_dir: dbDir,
        db_dir_exists: fs.existsSync(dbDir),
        db_file_exists: fs.existsSync(dbPath),
        db_connection_status: db ? 'Connected' : 'NULL (Failed)',
        directory_contents: {},
        write_test: 'Not attempted'
    };

    // List contents of db dir if it exists
    if (diagnostics.db_dir_exists) {
        try {
            // @ts-ignore
            diagnostics.directory_contents = fs.readdirSync(dbDir);
        } catch (e: any) {
            // @ts-ignore
            diagnostics.directory_contents = `Error reading dir: ${e.message}`;
        }

        // Try writing a test file
        try {
            const testFile = path.join(dbDir, 'write_test.txt');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            diagnostics.write_test = 'Success';
        } catch (e: any) {
            diagnostics.write_test = `Failed: ${e.message}`;
        }
    } else {
        // Try listing /app/data or /app to see where we are
        try {
            const appDir = '/app';
            if (fs.existsSync(appDir)) {
                // @ts-ignore
                diagnostics.app_dir_contents = fs.readdirSync(appDir);
            }
        } catch (e) { }
    }

    return NextResponse.json(diagnostics);
}
