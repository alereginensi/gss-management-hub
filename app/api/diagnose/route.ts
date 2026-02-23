import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
    try {
        const dbModule = require('@/lib/db');
        const activeDbPath = (dbModule.default as any)?.name || 'Unknown';

        const debugInfo: any = {
            env: {
                NODE_ENV: process.env.NODE_ENV,
                PWD: process.cwd(),
            },
            paths: {
                mountPoint: '/app/tickets.db',
                mountPointExists: fs.existsSync('/app/tickets.db'),
                cwd: process.cwd(),
                activeDbPath: activeDbPath
            },
            fs: {},
            system: {
                userInfo: os.userInfo(),
                platform: os.platform(),
                release: os.release()
            }
        };

        // Check root and mount point with detailed stats
        try {
            const listDirDetailed = (dir: string) => {
                try {
                    return fs.readdirSync(dir).map(file => {
                        const fullPath = path.join(dir, file);
                        const stats = fs.statSync(fullPath);
                        return {
                            name: file,
                            size: stats.size,
                            uid: stats.uid,
                            gid: stats.gid,
                            mode: stats.mode.toString(8),
                            isDir: stats.isDirectory()
                        };
                    });
                } catch (e: any) {
                    return `Error: ${e.message}`;
                }
            };

            debugInfo.fs.rootDetailed = listDirDetailed('/app');

            if (fs.existsSync('/app/tickets.db')) {
                const stats = fs.statSync('/app/tickets.db');
                debugInfo.fs.mountStats = {
                    uid: stats.uid,
                    gid: stats.gid,
                    mode: stats.mode.toString(8),
                    isDir: stats.isDirectory()
                };
                if (stats.isDirectory()) {
                    debugInfo.fs.mountDetailed = listDirDetailed('/app/tickets.db');
                }
            }
        } catch (e: any) {
            debugInfo.fs.error = e.message;
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
