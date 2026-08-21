import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock electron — logging.ts uses app.isPackaged and app.getPath at module scope
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: () => '/tmp',
        quit: vi.fn(),
    },
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    BrowserWindow: vi.fn(() => ({
        isDestroyed: vi.fn(() => false),
        webContents: { send: vi.fn(), on: vi.fn() },
    })),
    contextBridge: { exposeInMainWorld: vi.fn() },
    ipcRenderer: { invoke: vi.fn(), send: vi.fn(), on: vi.fn() },
    globalShortcut: { registerAll: vi.fn(), unregisterAll: vi.fn() },
    dialog: { showMessageBox: vi.fn(), showErrorBox: vi.fn() },
    webFrame: { setVisualZoomLevelLimits: vi.fn() },
}));

// Mock logging to avoid fs.createWriteStream at module scope
vi.mock('../../src/main/logging.ts', () => ({
    DEBUG_DATABASE: false,
    DEBUG_CLEANASSETS: false,
    DEBUG: false,
    DEBUG_FILEIO: false,
    DEBUG_NYI: false,
    DEBUG_LOAD_DEVTOOLS: false,
    DEBUG_RESOURCEIO: false,
    debugLog: vi.fn(),
    logFile: { write: vi.fn(), end: vi.fn() },
}));

import { DatabaseManager } from '../../src/main/database.ts';

let tmpDir;
let dbPath;
let sqlJs;

beforeEach(async () => {
    vi.useFakeTimers();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'));
    dbPath = path.join(tmpDir, 'test.sqllite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sqlJs = await require('sql.js')();
});

afterEach(() => {
    vi.useRealTimers();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

describe('DatabaseManager.save()', () => {
    it('creates the database file on disk', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        expect(fs.existsSync(dbPath)).toBe(true);
        mgr.close();
    });

    it('atomic write: renames .tmp to final path (no .tmp left behind)', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.save();
        expect(fs.existsSync(dbPath + '.tmp')).toBe(false);
        expect(fs.existsSync(dbPath)).toBe(true);
        mgr.close();
    });

    it('creates a .bak backup before overwriting', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        expect(fs.existsSync(dbPath)).toBe(true);
        mgr.save();
        expect(fs.existsSync(dbPath + '.bak')).toBe(true);
        mgr.close();
    });

    it('does nothing if db is null', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.close();
        mgr.save();
        expect(mgr.db).toBeNull();
    });
});

describe('DatabaseManager.savePending() debounce', () => {
    it('coalesces rapid calls into a single save', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        const saveSpy = vi.spyOn(mgr, 'save');

        mgr.savePending();
        mgr.savePending();
        mgr.savePending();
        mgr.savePending();
        mgr.savePending();

        expect(saveSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);

        expect(saveSpy).toHaveBeenCalledTimes(1);
        saveSpy.mockRestore();
        mgr.close();
    });

    it('does nothing if db is null', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.close();
        const saveSpy = vi.spyOn(mgr, 'save');
        mgr.savePending();
        vi.advanceTimersByTime(200);
        expect(saveSpy).not.toHaveBeenCalled();
        saveSpy.mockRestore();
    });
});

describe('DatabaseManager.flushPendingSave()', () => {
    it('immediately saves when there is a pending debounce', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        const saveSpy = vi.spyOn(mgr, 'save');

        mgr.savePending();
        expect(saveSpy).not.toHaveBeenCalled();

        mgr.flushPendingSave();
        expect(saveSpy).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(200);
        expect(saveSpy).toHaveBeenCalledTimes(1);

        saveSpy.mockRestore();
        mgr.close();
    });

    it('does nothing if no pending save exists', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        const saveSpy = vi.spyOn(mgr, 'save');

        mgr.flushPendingSave();
        expect(saveSpy).not.toHaveBeenCalled();

        saveSpy.mockRestore();
        mgr.close();
    });
});

describe('DatabaseManager.checkIntegrity()', () => {
    it('returns true for a freshly created database', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        expect(mgr.checkIntegrity()).toBe(true);
        mgr.close();
    });

    it('returns false if db is null', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.close();
        expect(mgr.checkIntegrity()).toBe(false);
    });
});

describe('DatabaseManager.close()', () => {
    it('sets db to null and isOpen returns false', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        expect(mgr.isOpen()).toBe(true);
        mgr.close();
        expect(mgr.isOpen()).toBe(false);
        expect(mgr.db).toBeNull();
    });
});

describe('DatabaseManager stmt/query', () => {
    it('stmt returns -1 if db is not open', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.close();
        const result = mgr.stmt({ stmt: 'INSERT INTO dummy VALUES (1)', values: [] });
        expect(result).toBe(-1);
    });

    it('query returns empty array if db is not open', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.close();
        const result = mgr.query({ stmt: 'SELECT * FROM dummy', values: [] });
        expect(result).toEqual([]);
    });

    it('stmt and query work on a live database', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        const rowId = mgr.stmt({
            stmt: "INSERT INTO PROJECTS (NAME, VERSION, DELETED, MTIME) VALUES (?, ?, ?, ?)",
            values: ['TestProject', 'v1', 'NO', '12345']
        });
        expect(rowId).toBeGreaterThanOrEqual(0);

        const rows = mgr.query({
            stmt: 'SELECT NAME FROM PROJECTS WHERE ID = ?',
            values: [rowId]
        });
        expect(rows.length).toBe(1);
        expect(rows[0].NAME).toBe('TestProject');

        const updateResult = mgr.stmt({
            stmt: "UPDATE PROJECTS SET NAME = ? WHERE ID = ?",
            values: ['UpdatedProject', rowId]
        });
        expect(updateResult).toBe(1);

        const updatedRows = mgr.query({
            stmt: 'SELECT NAME FROM PROJECTS WHERE ID = ?',
            values: [rowId]
        });
        expect(updatedRows[0].NAME).toBe('UpdatedProject');
        mgr.close();
    });

    it('ensures tables exist when opening an existing 0-byte file', () => {
        fs.writeFileSync(dbPath, Buffer.alloc(0));
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        const rowId = mgr.stmt({
            stmt: "INSERT INTO PROJECTS (NAME, VERSION, DELETED, MTIME) VALUES (?, ?, ?, ?)",
            values: ['FromZeroByte', 'v1', 'NO', '12345']
        });
        expect(rowId).toBeGreaterThanOrEqual(0);
        const rows = mgr.query({ stmt: 'SELECT NAME FROM PROJECTS WHERE ID = ?', values: [rowId] });
        expect(rows.length).toBe(1);
        expect(rows[0].NAME).toBe('FromZeroByte');
        mgr.close();
    });

    it('freshDatabase creates all tables without error', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr.freshDatabase(sqlJs);
        const rowId = mgr.stmt({
            stmt: "INSERT INTO PROJECTS (NAME, VERSION, DELETED, MTIME) VALUES (?, ?, ?, ?)",
            values: ['FreshDBProject', 'v1', 'NO', '12345']
        });
        expect(rowId).toBeGreaterThanOrEqual(0);
        mgr.close();
    });
});

describe('DatabaseManager autoRecover', () => {
    it('returns false when no backup file exists', () => {
        const mgr = new DatabaseManager(dbPath, undefined, sqlJs);
        expect(mgr.autoRecover()).toBe(false);
        mgr.close();
    });

    it('recovers data from .bak when main file is corrupt', () => {
        // Create DB, insert data, save twice so .bak has the data.
        // The backup saves the PREVIOUS state, so two saves are needed:
        //  1st save: writes current state to disk (first time, no .bak yet)
        //  2nd save: copies disk file (with data) to .bak, then writes again
        const mgr1 = new DatabaseManager(dbPath, undefined, sqlJs);
        mgr1.stmt({
            stmt: "INSERT INTO PROJECTS (NAME, VERSION, DELETED, MTIME) VALUES (?, ?, ?, ?)",
            values: ['BackupProject', 'v1', 'NO', '12345']
        });
        mgr1.save(); // writes data to disk
        mgr1.save(); // copies data-containing file to .bak
        expect(fs.existsSync(dbPath + '.bak')).toBe(true);
        mgr1.close();

        // Corrupt the main file
        fs.writeFileSync(dbPath, 'not a valid sqlite database');

        // Constructor detects corruption and auto-recovers from .bak
        const mgr2 = new DatabaseManager(dbPath, undefined, sqlJs);

        // Verify data survived the auto-recovery
        const rows = mgr2.query({ stmt: 'SELECT NAME FROM PROJECTS', values: [] });
        expect(rows.length).toBe(1);
        expect(rows[0].NAME).toBe('BackupProject');
        mgr2.close();
    });
});
