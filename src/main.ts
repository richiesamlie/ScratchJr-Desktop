//
//  main.ts  - Orchestrator for ScratchJr Desktop main process.
//
//  Wires together the modular components:
//    - logging.ts: structured logging and debug flags
//    - database.ts: SQL.js database lifecycle
//    - data-store.ts: project file storage and media cache
//    - window-lifecycle.ts: BrowserWindow, security, navigation
//    - ipc-handlers.ts: all IPC channels between main and renderer

import { app, Menu, MenuItemConstructorOptions } from 'electron';
import { logFile, debugLog } from './main/logging';
import { ScratchJRDataStore } from './main/data-store';
import { createWindow, getWindow } from './main/window-lifecycle';
import * as ipcHandlers from './main/ipc-handlers';

let dataStore: ScratchJRDataStore | undefined;

// Register crash handlers (must happen before any other code runs)
process.on('uncaughtException', (err: Error & { stack?: string }) => {
    const entry = JSON.stringify({ ts: new Date().toISOString(), type: 'uncaughtException', message: err?.message, stack: err?.stack });
    logFile.write(entry + '\n');
    process.stdout.write(entry + '\n');
    try { if (dataStore && dataStore.databaseManager) { dataStore.databaseManager.flushPendingSave(); dataStore.databaseManager.save(); } } catch (_) { /* best-effort save */ }
    logFile.end(() => process.exit(1));
});
process.on('unhandledRejection', (reason: unknown) => {
    const entry = JSON.stringify({ ts: new Date().toISOString(), type: 'unhandledRejection', message: String(reason), stack: (reason as Error)?.stack });
    logFile.write(entry + '\n');
    process.stdout.write(entry + '\n');
    try { if (dataStore && dataStore.databaseManager) { dataStore.databaseManager.flushPendingSave(); dataStore.databaseManager.save(); } } catch (_) { /* best-effort save */ }
    logFile.end(() => process.exit(1));
});

// Register IPC handlers (they use lazy getters so dataStore doesn't need to exist yet)
ipcHandlers.register(() => dataStore as ScratchJRDataStore, getWindow);

// App lifecycle
app.whenReady().then(async () => {
    dataStore = new ScratchJRDataStore(null);
    await dataStore.getDatabaseManager();
    debugLog('Database eagerly initialized');

    createWindow(dataStore);

    let template: MenuItemConstructorOptions[];
    if (dataStore.hasRestoreDatabase()) {
        template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Toggle full screen',
                        click: () => { const w = getWindow(); if (w) w.setFullScreen(!w.isFullScreen()); },
                        accelerator: 'CmdOrCtrl+f'
                    },
                    { label: 'Restore projects', click: () => dataStore!.restoreProjects() },
                    { type: 'separator' },
                    { role: 'quit' },
                ],
            }];
    } else {
        template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Toggle full screen',
                        click: () => { const w = getWindow(); if (w) w.setFullScreen(!w.isFullScreen()); },
                        accelerator: 'CmdOrCtrl+f'
                    },
                    { role: 'quit' },
                ],
            }];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (getWindow() === null && dataStore) {
        createWindow(dataStore);
    }
});

app.on('will-quit', () => {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
});
