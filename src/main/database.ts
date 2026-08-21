/**
 * Database module for ScratchJr Desktop.
 *
 * Manages the SQL.js database lifecycle: initialize, open, close, save,
 * migrations, project file CRUD, and asset cleanup.
 */

import fs from 'fs';
import { DEBUG_DATABASE, DEBUG_CLEANASSETS, debugLog } from './logging';

interface SqlJsDatabase {
    prepare(stmt: string, values?: unknown[]): SqlJsStatement;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    export(): Uint8Array;
    close(): void;
    handleError?: (e: Error) => void;
}

interface SqlJsStatement {
    step(): boolean;
    get(): unknown[];
    getAsObject(): Record<string, unknown>;
    free(): void;
}

interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

interface QueryJson {
    stmt?: string;
    values?: Array<string | number | boolean | null>;
    cond?: string;
    items?: string[];
    order?: string;
}

export class DatabaseManager {
    databaseFilename: string;
    databaseRestoreFilename: string | undefined;
    databaseBackupFilename: string;
    db: SqlJsDatabase | null = null;
    private _SQL: SqlJsStatic;
    /** Set by the caller after construction if it needs to know about auto-recovery */
    onAutoRecovery: (() => void) | null = null;
    /** Debounced save timer — coalesces rapid successive writes */
    private _saveTimer: ReturnType<typeof setTimeout> | null = null;
    private _saveDelay = 100; // ms

    constructor(databaseFilename: string, databaseRestoreFilename: string | undefined, SQL: SqlJsStatic) {
        if (DEBUG_DATABASE) debugLog('DatabaseManager created');

        this.databaseFilename = databaseFilename;
        this.databaseRestoreFilename = databaseRestoreFilename;
        this.databaseBackupFilename = databaseFilename + '.bak';
        this._SQL = SQL;

        const isFirstTimeRun = !fs.existsSync(this.databaseFilename);
        if (isFirstTimeRun) {
            this.initTables(SQL);
            this.runMigrations();
            this.save();
        } else {
            this.open(SQL);
            this.initTables(SQL);
            this.runMigrations();
            this.save();
        }
    }

    static async initialize(databaseFilename: string, databaseRestoreFilename?: string): Promise<DatabaseManager> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const initSqlJs = require('sql.js');
        const SQL: SqlJsStatic = await initSqlJs({});
        return new DatabaseManager(databaseFilename, databaseRestoreFilename, SQL);
    }

    open(SQL: SqlJsStatic): void {
        const fileToOpen = (this.databaseRestoreFilename) ? this.databaseRestoreFilename : this.databaseFilename;
        let filebuffer: Buffer;
        try {
            filebuffer = fs.readFileSync(fileToOpen);
        } catch (e) {
            debugLog('Failed to read database file — attempting auto-recovery:', e);
            this.db = null;
            // Skip straight to recovery
            if (this.autoRecover()) {
                debugLog('Auto-recovery succeeded (file unreadable)');
                const recoveredBuffer = fs.readFileSync(this.databaseFilename);
                this.db = new SQL.Database(recoveredBuffer);
                this.db.handleError = this.handleError;
                if (this.onAutoRecovery) this.onAutoRecovery();
            } else {
                this.freshDatabase(SQL);
            }
            return;
        }

        try {
            this.db = new SQL.Database(filebuffer);
            this.db.handleError = this.handleError;
        } catch (e) {
            debugLog('Failed to open database file — attempting auto-recovery:', e);
            this.db = null;
        }

        // Check integrity after opening (or recover if open failed)
        if (!this.db || !this.checkIntegrity()) {
            debugLog('Database corruption detected on open — attempting auto-recovery');
            this.close();
            if (this.autoRecover()) {
                debugLog('Auto-recovery succeeded');
                // Re-open from the now-recovered file
                const recoveredBuffer = fs.readFileSync(this.databaseFilename);
                this.db = new SQL.Database(recoveredBuffer);
                this.db.handleError = this.handleError;
                if (this.onAutoRecovery) {
                    this.onAutoRecovery();
                }
            } else {
                debugLog('Auto-recovery failed — creating fresh database');
                this.freshDatabase(SQL);
            }
        }

        if (this.databaseRestoreFilename) {
            this.save();
        }
    }

    /** Run PRAGMA integrity_check and return true if the database is OK */
    checkIntegrity(): boolean {
        if (!this.db) return false;
        try {
            const result = this.db.exec('PRAGMA integrity_check;');
            if (!result || result.length === 0) return false;
            const rows = result[0].values;
            if (rows.length === 0) return false;
            const status = String(rows[0][0]);
            const ok = status === 'ok';
            if (!ok) {
                debugLog('integrity_check returned:', status);
            }
            return ok;
        } catch (e) {
            debugLog('integrity_check failed:', e);
            return false;
        }
    }

    /**
     * Attempt to recover from a backup file.
     * Returns true if recovery succeeded (the .bak file was valid and was
     * copied over the corrupted main file).
     */
    autoRecover(): boolean {
        if (fs.existsSync(this.databaseBackupFilename)) {
            try {
                // Verify the backup is itself valid before using it
                const backupBuffer = fs.readFileSync(this.databaseBackupFilename);
                const tempDb = new this._SQL.Database(backupBuffer);
                const result = tempDb.exec('PRAGMA integrity_check;');
                tempDb.close();
                const ok = result && result.length > 0 && String(result[0].values[0][0]) === 'ok';
                if (ok) {
                    // Backup is good — copy it over the corrupted main file
                    fs.copyFileSync(this.databaseBackupFilename, this.databaseFilename);
                    return true;
                }
                debugLog('Backup file is also corrupted');
            } catch (e) {
                debugLog('Failed to read/verify backup:', e);
            }
        }
        return false;
    }

    /** Create a brand-new empty database, discarding the corrupted one */
    freshDatabase(SQL: SqlJsStatic): void {
        this.close();
        this.initTables(SQL);
        this.runMigrations();
        this.save();
    }

    handleError(e: Error): void {
        debugLog('sql.js error:', e.message || e);
    }

    close(): void {
        if (this.db) this.db.close();
        this.db = null;
    }

    isOpen(): boolean {
        return (this.db != null);
    }

    save(): void {
        if (!this.db) {
            debugLog('save() called but database is not open');
            return;
        }
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            // Create a rolling backup before overwriting the main file
            if (fs.existsSync(this.databaseFilename)) {
                try {
                    fs.copyFileSync(this.databaseFilename, this.databaseBackupFilename);
                } catch (e) {
                    debugLog('Failed to create backup:', e);
                }
            }
            const tmpPath = this.databaseFilename + '.tmp';
            fs.writeFileSync(tmpPath, buffer);
            fs.renameSync(tmpPath, this.databaseFilename);
        } catch (e) {
            debugLog('save() failed:', e);
            // Attempt to clean up the temp file if rename failed
            try { fs.unlinkSync(this.databaseFilename + '.tmp'); } catch (_) { /* ignore */ }
        }
    }

    /** Schedule a save that coalesces rapid successive calls (debounced). */
    savePending(): void {
        if (!this.db) return;
        if (this._saveTimer !== null) return; // already scheduled
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this.save();
        }, this._saveDelay);
    }

    /** Flush any pending debounced save immediately (used on close/crash). */
    flushPendingSave(): void {
        if (this._saveTimer !== null) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
            this.save();
        }
    }

    cleanProjectFiles(fileType: string): void {
        if (fileType === 'wav') {
            fileType = 'webm';
        }

        const queryListAllFilesWithExtension: QueryJson = {
            stmt: `select MD5 FROM PROJECTFILES WHERE MD5 LIKE ?`,
            values: [`%.${fileType}`],
        };

        const allProjectFilesWithExtension = this.query(queryListAllFilesWithExtension);

        for (let i = 0; i < allProjectFilesWithExtension.length; i++) {
            const currentFileToCheck = allProjectFilesWithExtension[i].MD5 as string;

            if (!currentFileToCheck) continue;

            if (DEBUG_CLEANASSETS) debugLog('checking if in use: ', currentFileToCheck);

            const queryFindFileInProjects: QueryJson = {
                stmt: 'select ID from PROJECTS where json like ?',
                values: [`%${currentFileToCheck}%`],
            };

            const projectJSON = this.query(queryFindFileInProjects);
            if (projectJSON.length > 0) {
                if (DEBUG_CLEANASSETS) debugLog('...project is currently using: ', currentFileToCheck);
                continue;
            }

            const queryFindFileInUsershapes: QueryJson = {
                stmt: 'select MD5 from USERSHAPES where MD5 = ?',
                values: [currentFileToCheck],
            };

            const shapeFiles = this.query(queryFindFileInUsershapes);
            if (shapeFiles.length > 0) {
                if (DEBUG_CLEANASSETS) debugLog('...user shapes is using: ', currentFileToCheck, shapeFiles);
                continue;
            }

            const queryFindFileInUserbkgs: QueryJson = {
                stmt: 'select MD5 from USERBKGS where MD5 = ?',
                values: [currentFileToCheck],
            };
            const bkgFiles = this.query(queryFindFileInUserbkgs);
            if (bkgFiles.length > 0) {
                if (DEBUG_CLEANASSETS) debugLog('...user backgrounds is using: ', currentFileToCheck, bkgFiles);
                continue;
            }

            if (DEBUG_CLEANASSETS) debugLog('...not in use, removing: ', currentFileToCheck);
            this.removeProjectFile(currentFileToCheck);
        }
        this.savePending();
    }

    removeProjectFile(fileMD5: string): void {
        const json: QueryJson = {};
        json.stmt = `delete from PROJECTFILES where MD5 = ?`;
        json.values = [fileMD5];
        this.stmt(json);
    }

    readProjectFile(fileMD5: string): string | null {
        const json: QueryJson = {};
        json.stmt = 'select CONTENTS from PROJECTFILES where MD5 = ?';
        json.values = [fileMD5];

        const rows = this.query(json);

        if (rows.length > 0) {
            return rows[0].CONTENTS as string;
        }
        return null;
    }

    saveToProjectFiles(fileMD5: string, content: string): boolean {
        const json: QueryJson = {};
        json.values = [fileMD5, content];
        json.stmt = 'insert or replace into PROJECTFILES (MD5, CONTENTS) values (?, ?)';
        const insertSQLResult = this.stmt(json);

        if (insertSQLResult < 0) {
            debugLog('saveToProjectFiles: stmt failed for', fileMD5);
            return false;
        }

        this.savePending();

        return true;
    }

    getRowData(res: SqlJsStatement): Record<string, unknown> {
        return res.getAsObject();
    }

    initTables(SQL?: SqlJsStatic): void {
        if (!this.db) {
            if (!SQL) throw new Error('SQL instance required to create database');
            this.db = new SQL.Database();
            this.db.handleError = this.handleError;
        }

        if (DEBUG_DATABASE) debugLog('making tables...');

        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MTIME DATETIME, ALTMD5 TEXT, POS INTEGER, NAME TEXT, JSON TEXT, THUMBNAIL TEXT, OWNER TEXT, GALLERY TEXT, DELETED TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERSHAPES (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, NAME TEXT, OWNER TEXT, SCALE TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERBKGS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, OWNER TEXT,  VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTFILES (MD5 TEXT PRIMARY KEY, CONTENTS TEXT)\n');
    }

    clearTables(): void {
        if (!this.db) return;
        this.db.exec('DELETE FROM PROJECTS');
        this.db.exec('DELETE FROM USERSHAPES');
        this.db.exec('DELETE FROM USERBKGS');
    }

    runMigrations(): void {
        if (!this.db) return;
        try {
            this.db.exec('ALTER TABLE PROJECTS ADD COLUMN ISGIFT INTEGER DEFAULT 0');
        } catch (e) {
            debugLog('failed to migrate tables', e);
        }
    }

    stmt(jsonStrOrJsonObj: string | QueryJson): number {
        if (!this.db) {
            debugLog('stmt() called but database is not open');
            return -1;
        }
        try {
            const json: QueryJson = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};
            const stmtStr = json.stmt!;
            const values = json.values;

            if (DEBUG_DATABASE) debugLog('DatabaseManager executing stmt', stmtStr, values);

            const statement = this.db.prepare(stmtStr, values);

            try {
                while (statement.step()) statement.get();

                const isInsert = stmtStr.trim().toLowerCase().startsWith('insert');
                if (isInsert) {
                    const result = this.db.exec('select last_insert_rowid();');
                    const lastRowId = (result && result.length > 0 && result[0].values.length > 0)
                        ? (result[0].values[0][0] as number)
                        : 0;
                    if (lastRowId === 0) {
                        debugLog('WARNING: INSERT returned rowid 0 — the insert may have failed:', stmtStr, values);
                    }
                    return lastRowId;
                } else {
                    const result = this.db.exec('select changes();');
                    const changes = (result && result.length > 0 && result[0].values.length > 0)
                        ? (result[0].values[0][0] as number)
                        : 0;
                    return changes;
                }
            } finally {
                statement.free();
            }
        } catch (e) {
            debugLog('stmt failed:', e instanceof Error ? e.message : e, jsonStrOrJsonObj);
            return -1;
        }
    }

    query(jsonStrOrJsonObj: string | QueryJson): Record<string, unknown>[] {
        if (!this.db) {
            debugLog('query() called but database is not open');
            return [];
        }
        try {
            const json: QueryJson = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};

            const stmtStr = json.stmt!;
            const values = json.values;

            const statement = this.db.prepare(stmtStr, values);

            try {
                const rows: Record<string, unknown>[] = [];
                while (statement.step()) {
                    rows.push(statement.getAsObject());
                }

                return rows;
            } finally {
                statement.free();
            }
        } catch (e) {
            if (DEBUG_DATABASE) debugLog('query failed', jsonStrOrJsonObj, e);
            return [];
        }
    }
}
