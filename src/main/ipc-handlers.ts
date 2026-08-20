/**
 * IPC handlers module for ScratchJr Desktop.
 *
 * Registers all ipcMain.handle/ipcMain.on handlers for the renderer bridge.
 * Each handler receives its dependencies via the register() function.
 */

import fs from 'fs';
import path from 'path';
import { app, ipcMain, BrowserWindow } from 'electron';
import {
    DEBUG, DEBUG_DATABASE, DEBUG_FILEIO, DEBUG_RESOURCEIO, DEBUG_NYI, debugLog
} from './logging';
import { normalizeAndValidateSqlPayload } from '../lib/sql-validator';
import type { ScratchJRDataStore } from './data-store';
import { checkForUpdate, openExternalUrl } from './updater';

// Parse --lang=xx from command line (e.g. ScratchJr --lang=fr)
const cliLangArg = process.argv.find((a) => a.startsWith('--lang='));
const cliLang = cliLangArg ? cliLangArg.split('=')[1] : null;

export function register(getDataStore: () => ScratchJRDataStore, getWindow: () => BrowserWindow | null): void {
    ipcMain.handle('io_getIsDebug', () => DEBUG);
    ipcMain.handle('io_getLang', () => cliLang);

    ipcMain.on('debugWriteLog', (_event: any, args: unknown) => {
        debugLog(args);
    });

    ipcMain.handle('io_cleanassets', (_event: any, fileType: string) => {
        if (DEBUG_NYI) debugLog('cleanAssets - ', fileType);
        try {
            const dataStore = getDataStore();
            const db = dataStore.databaseManager;
            if (db) {
                db.cleanProjectFiles(fileType);
            }
        } catch (err) {
            if (DEBUG_NYI) debugLog('cleanAssets error:', err);
        }
        return true;
    });

    ipcMain.handle('io_setfile', (_event: any, arg: { name: string; contents: string }) => {
        if (DEBUG_FILEIO) debugLog('io_setfile', arg);
        try {
            return getDataStore().writeProjectFile(arg.name, arg.contents);
        } catch (e) {
            debugLog('io_setfile error:', e);
            return false;
        }
    });

    ipcMain.handle('io_getfile', (_event: any, arg: string) => {
        if (DEBUG_FILEIO) debugLog('io_getfile', arg);
        try {
            return getDataStore().readProjectFileAsBase64EncodedString(arg);
        } catch (e) {
            debugLog('io_getfile error:', e);
            return null;
        }
    });

    ipcMain.handle('io_getmedia', (_event: any, filename: string) => {
        if (DEBUG_FILEIO) debugLog('io_getmedia', filename);
        try {
            return getDataStore().readProjectFileAsBase64EncodedString(filename);
        } catch (e) {
            debugLog('io_getmedia error:', e);
            return null;
        }
    });

    ipcMain.handle('io_getmediadata', (_event: any, key: string, offset: number, length: number) => {
        if (DEBUG_FILEIO) debugLog('io_getmediadata', key, offset, length);
        const mediaString = getDataStore().getCachedMedia(key);
        if (mediaString) {
            try {
                return mediaString.substring(offset, offset + length);
            } catch (e) {
                debugLog('error parsing media');
                return null;
            }
        }
        return null;
    });

    ipcMain.handle('io_getmediadone', (_event: any, key: string) => {
        if (DEBUG_FILEIO) debugLog('io_getmediadone', key);
        getDataStore().removeFromMediaCache(key);
        return true;
    });

    ipcMain.handle('io_getmedialen', (_event: any, file: string, key: string) => {
        if (DEBUG_FILEIO) debugLog('io_getmedialen', file, key);
        const dataStore = getDataStore();
        const encodedStr = dataStore.readProjectFileAsBase64EncodedString(file);
        if (encodedStr) {
            dataStore.cacheMedia(key, encodedStr);
        }
        return (encodedStr) ? encodedStr.length : 0;
    });

    ipcMain.handle('io_setmedia', (_event: any, base64ContentStr: string, ext: string) => {
        if (DEBUG_FILEIO) debugLog('io_setmedia - write file', ext);
        try {
            const dataStore = getDataStore();
            const filename = `${dataStore.getMD5(base64ContentStr)}.${ext}`;
            dataStore.writeProjectFile(filename, base64ContentStr);
            return filename;
        } catch (e) {
            debugLog('io_setmedia error:', e);
            return null;
        }
    });

    ipcMain.handle('io_setmedianame', (_event: any, encodedData: string, key: string, ext: string) => {
        if (DEBUG_FILEIO) debugLog('io_setmedianame', key, ext);
        try {
            const filename = `${key}.${ext}`;
            getDataStore().writeProjectFile(filename, encodedData);
            return filename;
        } catch (e) {
            debugLog('io_setmedianame error:', e);
            return null;
        }
    });

    ipcMain.handle('io_getsettings', () => {
        if (DEBUG_RESOURCEIO) debugLog('io_getsettings');
        try {
            const documents = app.getPath('documents');
            return `${path.join(documents, 'ScratchJR')},false,YES,YES`;
        } catch (e) {
            debugLog('io_getsettings', e);
            return null;
        }
    });

    ipcMain.handle('io_getmd5', (_event: any, data: string) => {
        if (DEBUG_FILEIO) debugLog('io_getmd5');
        try {
            return getDataStore().getMD5(data);
        } catch (e) {
            debugLog('io_getmd5', e);
            return null;
        }
    });

    ipcMain.handle('io_remove', (_event: any, filename: string) => {
        if (DEBUG_FILEIO) debugLog('io_remove: ', filename);
        try {
            getDataStore().removeProjectFile(filename);
            return true;
        } catch (e) {
            debugLog('io_remove error:', e);
            return false;
        }
    });

    ipcMain.handle('io_gettextresource', (_event: any, filename: string) => {
        if (DEBUG_RESOURCEIO) debugLog('io_gettextresource', filename);
        const filePath = getDataStore().safeGetFilenameInAppDirectory(filename, true);
        if (filePath) {
            return fs.readFileSync(filePath, 'utf8');
        }
        debugLog('io_gettextresource: File could not be resolved.', filename);
        return null;
    });

    ipcMain.handle('io_getAudioData', (_event: any, audioName: string) => {
        if (DEBUG_FILEIO) debugLog('io_getAudioData - looking for', audioName);
        const dataStore = getDataStore();
        let filePath = dataStore.safeGetFilenameInAppDirectory(audioName, false);
        if (!filePath) {
            filePath = dataStore.safeGetFilenameInAppDirectory('sounds/' + audioName, false);
        }
        if (!filePath) {
            if (DEBUG_FILEIO) debugLog('...trying to look in the PROJECTFILE table', audioName);
            const projectDBFile = dataStore.readProjectFileAsBase64EncodedString(audioName);
            if (DEBUG_FILEIO && !projectDBFile) debugLog('...WARNING: unable to find: ', audioName);
            return projectDBFile;
        }
        const data = fs.readFileSync(filePath);
        if (!data) {
            if (DEBUG_FILEIO) debugLog('io_getAudioData - could not find on disk', audioName, filePath);
            return null;
        }
        const dataStr = Buffer.from(data).toString('base64');
        const extension = path.extname(filePath);
        if (extension === '.mp3') {
            return 'data:audio/mp3;base64,' + dataStr;
        } else if (extension === '.wav') {
            return 'data:audio/wav;base64,' + dataStr;
        }
        return null;
    });

    ipcMain.handle('database_stmt', (_event: any, json: string) => {
        if (DEBUG_DATABASE) debugLog('database_stmt', json);
        try {
            const validated = normalizeAndValidateSqlPayload(json);
            const safeQuery = { stmt: validated.stmt, values: validated.values as Array<string | number | boolean | null> };
            const db = getDataStore().databaseManager!;
            const result = db.stmt(safeQuery);
            if (DEBUG_DATABASE) debugLog('database_stmt result:', result);
            return result;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            debugLog('database_stmt blocked:', message);
            return -1;
        }
    });

    ipcMain.handle('database_query', (_event: any, json: string) => {
        if (DEBUG_DATABASE) debugLog('database_query', json);
        try {
            const validated = normalizeAndValidateSqlPayload(json);
            const safeQuery = { stmt: validated.stmt, values: validated.values as Array<string | number | boolean | null> };
            const db = getDataStore().databaseManager!;
            return JSON.stringify(db.query(safeQuery));
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            debugLog('database_query blocked:', message);
            return '[]';
        }
    });

    ipcMain.on('app-closed-acked', (_event: any) => {
        const dataStore = getDataStore();
        if (dataStore.databaseManager) {
            dataStore.databaseManager.save();
            dataStore.databaseManager.close();
        }

        const { saveWindowState, destroyWindow } = require('./window-lifecycle');
        saveWindowState();
        destroyWindow();
        app.exit();
    });

    // ---- Update checker ----
    ipcMain.handle('update-check', async () => {
        return checkForUpdate();
    });

    ipcMain.handle('update-open-url', (_event: any, url: string) => {
        openExternalUrl(url);
    });
}
