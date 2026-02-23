import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
    try {
        const activeDbPath = (db as any)?.name || 'Unknown';

        const debugInfo: any = {
            env: {
                NODE_ENV: process.env.NODE_ENV,
                PWD: process.cwd(),
            },
            paths: {
                mountPoint: '/app/data',
                mountPointExists: fs.existsSync('/app/data'),
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
            // 3. Deep System Auditing (Railway/Linux specific)
            try {
                if (fs.existsSync('/proc/mounts')) {
                    debugInfo.fs.mounts = fs.readFileSync('/proc/mounts', 'utf8')
                        .split('\n')
                        .filter(line => line.includes('/app') || line.includes('/data') || line.includes('tickets.db'));
                }
            } catch (e: any) {
                debugInfo.fs.mounts = `Error reading mounts: ${e.message}`;
            }

            const listDirDetailed = (dir: string) => {
                try {
                    if (!fs.existsSync(dir)) return `Directory ${dir} does not exist`;
                    return fs.readdirSync(dir).map(file => {
                        const fullPath = path.join(dir, file);
                        const stats = fs.statSync(fullPath);
                        return {
                            name: file,
                            size: stats.size,
                            uid: stats.uid,
                            gid: stats.gid,
                            mode: stats.mode.toString(8),
                            ino: stats.ino,
                            isDir: stats.isDirectory()
                        };
                    });
                } catch (e: any) {
                    return `Error: ${e.message}`;
                }
            };

            debugInfo.fs.rootDetailed = listDirDetailed('/app');
            debugInfo.fs.appDir = listDirDetailed('/app');
            debugInfo.fs.dataDir = listDirDetailed('/app/data');

            // 4. Try to find ANY database file in the entire /app tree
            const findDatabases = (dir: string, results: any[] = []) => {
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        if (fullPath.includes('node_modules')) continue;
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            findDatabases(fullPath, results);
                        } else if (file.endsWith('.db') && stats.size > 0) {
                            results.push({
                                path: fullPath,
                                size: stats.size,
                                mtime: stats.mtime,
                                ino: stats.ino
                            });
                        }
                    }
                } catch (e) { }
                return results;
            };
            debugInfo.foundDatabases = findDatabases('/app');

            if (fs.existsSync('/app/data')) {
                const stats = fs.statSync('/app/data');
                debugInfo.fs.mountStats = {
                    uid: stats.uid,
                    gid: stats.gid,
                    mode: stats.mode.toString(8),
                    isDir: stats.isDirectory()
                };
                if (stats.isDirectory()) {
                    debugInfo.fs.mountDetailed = listDirDetailed('/app/data');
                }
            }
        } catch (e: any) {
            debugInfo.fs.error = e.message;
        }

        // Try importing DB
        try {
            debugInfo.dbStatus = 'Imported successfully';
            debugInfo.dbType = db?.type || 'unknown';
            debugInfo.dbUrlFound = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

            // basic query
            if (db) {
                try {
                    const count = await db.prepare('SELECT count(*) as c FROM locations').get() as any;
                    debugInfo.dbQuery = 'Success';
                    debugInfo.rowCount = count?.c || 0;
                } catch (qError: any) {
                    debugInfo.dbQueryError = qError.message;
                }

                // Check if admin exists
                try {
                    const admin = await db.prepare('SELECT id, email, role, approved FROM users WHERE email = ?').get('admin@gss.com');
                    debugInfo.adminUser = admin || 'Not Found';
                } catch (uError: any) {
                    debugInfo.adminCheckError = uError.message;
                }

                // List tables
                try {
                    const isPg = db.type === 'pg';
                    const tablesQuery = isPg
                        ? "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'"
                        : "SELECT name FROM sqlite_master WHERE type='table'";

                    const tables = await db.prepare(tablesQuery).all();
                    debugInfo.tables = tables.map((t: any) => t.name || t.table_name);
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
