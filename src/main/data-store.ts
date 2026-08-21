/**
 * Data store module for ScratchJr Desktop.
 *
 * Manages project file storage, media cache, path validation,
 * and database lifecycle coordination.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app, dialog, BrowserWindow } from 'electron';
import { DEBUG_DATABASE, DEBUG_FILEIO, debugLog } from './logging';
import { DatabaseManager } from './database';

export class ScratchJRDataStore {
    /** Cache of key to base64-encoded media value */
    mediaStrings: Record<string, string> = {};
    mediaCacheMaxSize = 50;
    electronBrowserWindow: BrowserWindow | null;
    databaseManager: DatabaseManager | null = null;
    private _dbInitPromise: Promise<DatabaseManager> | null = null;

    constructor(electronBrowserWindow: BrowserWindow | null) {
        this.electronBrowserWindow = electronBrowserWindow;
    }

    getMD5(data: string | Buffer): string {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    async getDatabaseManager(): Promise<DatabaseManager> {
        if (!this.databaseManager) {
            if (!this._dbInitPromise) {
                const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
                const scratchDBPath = path.join(scratchFolder, 'scratchjr.sqllite');
                this._dbInitPromise = DatabaseManager.initialize(scratchDBPath);
            }
            this.databaseManager = await this._dbInitPromise;
            // Wire up auto-recovery notification to the renderer
            this.databaseManager.onAutoRecovery = () => {
                if (this.electronBrowserWindow && !this.electronBrowserWindow.isDestroyed()) {
                    this.electronBrowserWindow.webContents.send('databaseRestored', {});
                }
            };
            if (DEBUG_DATABASE) debugLog('DatabaseManager created');
        }
        return this.databaseManager;
    }

    hasRestoreDatabase(): boolean {
        const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
        const scratchRestoreDB = path.join(scratchFolder, 'scratchjr.sqllite.restore');
        return fs.existsSync(scratchRestoreDB);
    }

    async restoreProjects(): Promise<void> {
        const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
        const scratchDBPath = path.join(scratchFolder, 'scratchjr.sqllite');
        const scratchRestoreDB = path.join(scratchFolder, 'scratchjr.sqllite.restore');

        if (fs.existsSync(scratchRestoreDB)) {
            this.databaseManager = await DatabaseManager.initialize(scratchDBPath, scratchRestoreDB);

            if (DEBUG_DATABASE) debugLog('DatabaseManager reloaded from restored copy');

            this.electronBrowserWindow!.webContents.send('databaseRestored', {});

            dialog.showMessageBox(
                this.electronBrowserWindow!,
                {
                    type: 'info',
                    buttons: ['OK'],
                    title: 'Database Restored',
                    message: 'The database has been restored'
                }
            );

        } else {
            dialog.showErrorBox('Database Restored', 'The database not been restored.  Could not find file: ' + scratchRestoreDB);
        }
    }

    isInScratchJRFolder(fullPath: string): boolean {
        if (!fullPath || fullPath.length === 0) return false;
        const testFolder = path.dirname(fullPath);
        const scratchJRPath = ScratchJRDataStore.getScratchJRFolder();
        return (scratchJRPath === testFolder);
    }

    isParentFolder(parent: string, dir: string): boolean {
        const relative = path.relative(parent, dir);
        return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    static getScratchJRFolder(): string {
        const documents = app.getPath('documents');
        if (!documents) throw new Error('could not get documents folder');

        const scratchJRPath = path.join(documents, 'ScratchJR');
        this.ensureDir(scratchJRPath);
        return scratchJRPath;
    }

    static ensureDir(filePath: string): void {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath);
        }
    }

    cacheMedia(key: string, base64EncodedStr: string): void {
        const keys = Object.keys(this.mediaStrings);
        if (keys.length >= this.mediaCacheMaxSize) {
            delete this.mediaStrings[keys[0]];
        }
        this.mediaStrings[key] = base64EncodedStr;
    }

    getCachedMedia(key: string): string | undefined {
        return this.mediaStrings[key];
    }

    removeFromMediaCache(key: string): void {
        if (this.mediaStrings[key]) {
            delete this.mediaStrings[key];
        }
    }

    readProjectFileAsBase64EncodedString(filename: string): string | null {
        const db = this.databaseManager!;
        return db.readProjectFile(filename);
    }

    removeProjectFile(filename: string): void {
        const db = this.databaseManager!;
        db.removeProjectFile(filename);
    }

    writeProjectFile(file: string, contents: string): string | number {
        const db = this.databaseManager!;
        if (db.saveToProjectFiles(file, contents)) {
            return file;
        }
        return -1;
    }

    safeGetFilenameInAppDirectory(file: string, warnIfNotPresent?: boolean): string | null {
        if (!file || file === '') throw new Error('File cannot be null or empty');

        // __dirname in compiled output is build/main/.
        // App root: build/main/ -> build/ -> <root>/ -> src/app/
        const appRoot = path.join(__dirname, '..', '..', 'src', 'app');

        const filePath = path.join(appRoot, file);
        if (!this.isParentFolder(appRoot, filePath)) {
            throw new Error(`safe resolve path - file outside app folder.${filePath}`);
        }

        if (fs.existsSync(filePath)) {
            return filePath;
        }

        if (DEBUG_FILEIO || warnIfNotPresent) debugLog('safeGetFilenameInAppDirectory: file does not exist.', file, filePath);

        return null;
    }
}
