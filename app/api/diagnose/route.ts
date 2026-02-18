import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
    try {
        const debugInfo: any = {
            env: {
                NODE_ENV: process.env.NODE_ENV,
                PWD: process.cwd(),
            },
            paths: {
                appData: '/app/data',
                appDataExists: fs.existsSync('/app/data'),
                cwd: process.cwd(),
                dbPath: process.env.NODE_ENV === 'production'
                    ? path.resolve('/app/data/tickets.db')
                    : path.resolve(process.cwd(), 'tickets.db')
            },
            fs: {},
            system: {
                userInfo: os.userInfo(),
                platform: os.platform(),
                release: os.release()
            }
        };

        // Check /app/data permissions and content
        if (fs.existsSync('/app/data')) {
            try {
                // @ts-ignore
                debugInfo.fs.appDataStats = fs.statSync('/app/data');
                // @ts-ignore
                debugInfo.fs.appDataFiles = fs.readdirSync('/app/data');

                // Try writing a test file
                const testFile = '/app/data/write_test.txt';
                fs.writeFileSync(testFile, 'test ' + new Date().toISOString());
                debugInfo.fs.canWrite = true;
                fs.unlinkSync(testFile);
            } catch (e: any) {
                debugInfo.fs.error = e.message;
                debugInfo.fs.canWrite = false;
            }
        } else {
            debugInfo.fs.error = '/app/data does not exist';
        }

        // Try importing DB
        try {
            const dbModule = require('@/lib/db');
            debugInfo.dbStatus = 'Imported successfully';
            // basic query
            if (dbModule.default) {
                try {
                    const count = dbModule.default.prepare('SELECT count(*) as c FROM locations').get();
                    debugInfo.dbQuery = 'Success';
                    debugInfo.rowCount = count;
                } catch (qError: any) {
                    debugInfo.dbQueryError = qError.message;
                }

                // Check if admin exists
                try {
                    const admin = dbModule.default.prepare('SELECT id, email, role, approved FROM users WHERE email = ?').get('admin@gss.com');
                    debugInfo.adminUser = admin || 'Not Found';
                } catch (uError: any) {
                    debugInfo.adminCheckError = uError.message;
                }

                // List tables
                try {
                    const tables = dbModule.default.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
                    debugInfo.tables = tables.map((t: any) => t.name);
                } catch (tError: any) {
                    debugInfo.tableListError = tError.message;
                }
            } else {
                debugInfo.dbInstance = 'Not found on default export';
            }
        } catch (dbError: any) {
            debugInfo.dbImportError = dbError.message;
            debugInfo.dbStack = dbError.stack;
        }

        return NextResponse.json(debugInfo);
    } catch (error: any) {
        return NextResponse.json({
            error: 'Diagnostic failed',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
