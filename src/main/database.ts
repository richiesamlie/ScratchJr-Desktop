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
    db: SqlJsDatabase | null = null;

    constructor(databaseFilename: string, databaseRestoreFilename: string | undefined, SQL: SqlJsStatic) {
        if (DEBUG_DATABASE) debugLog('DatabaseManager created');

        this.databaseFilename = databaseFilename;
        this.databaseRestoreFilename = databaseRestoreFilename;

        const isFirstTimeRun = !fs.existsSync(this.databaseFilename);
        if (isFirstTimeRun) {
            this.initTables(SQL);
            this.runMigrations();
            this.save();
        } else {
            this.open(SQL);
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
        const filebuffer = fs.readFileSync(fileToOpen);
        this.db = new SQL.Database(filebuffer);
        this.db.handleError = this.handleError;

        if (this.databaseRestoreFilename) {
            this.save();
        }
    }

    handleError(e: Error): void {
        if (DEBUG_DATABASE) debugLog(e);
    }

    close(): void {
        if (this.db) this.db.close();
        this.db = null;
    }

    isOpen(): boolean {
        return (this.db != null);
    }

    save(): void {
        const data = this.db!.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.databaseFilename, buffer);
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
        this.save();
    }

    removeProjectFile(fileMD5: string): void {
        const json: QueryJson = {};
        json.cond = 'MD5 = ?';
        json.items = ['CONTENTS'];
        json.values = [fileMD5];
        const table = 'PROJECTFILES';

        json.stmt = `delete from ${table} where ${json.cond}`;
        this.query(json);
        this.save();
    }

    readProjectFile(fileMD5: string): string | null {
        const json: QueryJson = {};
        json.cond = 'MD5 = ?';
        json.items = ['CONTENTS'];
        json.values = [fileMD5];
        const table = 'PROJECTFILES';

        json.stmt = `select ${json.items} from ${table} where ${json.cond}`;

        const rows = this.query(json);

        if (rows.length > 0) {
            return rows[0].CONTENTS as string;
        }
        return null;
    }

    saveToProjectFiles(fileMD5: string, content: string): boolean {
        const json: QueryJson = {};
        const keylist = ['md5', 'contents'];
        const values = '?,?';
        json.values = [fileMD5, content];
        json.stmt = `insert or replace into projectfiles (${keylist.toString()}) values (${values})`;
        const insertSQLResult = this.stmt(json);

        this.save();

        return (insertSQLResult >= 0);
    }

    getRowData(res: SqlJsStatement): Record<string, unknown> {
        return res.getAsObject();
    }

    initTables(SQL: SqlJsStatic): void {
        if (this.db) throw new Error('database already created');
        this.db = new SQL.Database();
        this.db.handleError = this.handleError;

        if (DEBUG_DATABASE) debugLog('making tables...');

        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MTIME DATETIME, ALTMD5 TEXT, POS INTEGER, NAME TEXT, JSON TEXT, THUMBNAIL TEXT, OWNER TEXT, GALLERY TEXT, DELETED TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERSHAPES (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, NAME TEXT, OWNER TEXT, SCALE TEXT, VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS USERBKGS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, OWNER TEXT,  VERSION TEXT)\n');
        this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTFILES (MD5 TEXT PRIMARY KEY, CONTENTS TEXT)\n');
    }

    clearTables(): void {
        this.db!.exec('DELETE FROM PROJECTS');
        this.db!.exec('DELETE FROM USERSHAPES');
        this.db!.exec('DELETE FROM USERBKGS');
    }

    runMigrations(): void {
        try {
            this.db!.exec('ALTER TABLE PROJECTS ADD COLUMN ISGIFT INTEGER DEFAULT 0');
        } catch (e) {
            debugLog('failed to migrate tables', e);
        }
    }

    stmt(jsonStrOrJsonObj: string | QueryJson): number {
        try {
            const json: QueryJson = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};
            const stmtStr = json.stmt!;
            const values = json.values;

            if (DEBUG_DATABASE) debugLog('DatabaseManager executing stmt', stmtStr, values);

            const statement = this.db!.prepare(stmtStr, values);

            try {
                while (statement.step()) statement.get();

                const result = this.db!.exec('select last_insert_rowid();');
                const lastRowId = result[0].values[0][0] as number;

                return lastRowId;
            } finally {
                statement.free();
            }
        } catch (e) {
            if (DEBUG_DATABASE) debugLog('stmt failed', jsonStrOrJsonObj, e);
            return -1;
        }
    }

    query(jsonStrOrJsonObj: string | QueryJson): Record<string, unknown>[] {
        try {
            const json: QueryJson = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};

            const stmtStr = json.stmt!;
            const values = json.values;

            const statement = this.db!.prepare(stmtStr, values);

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
