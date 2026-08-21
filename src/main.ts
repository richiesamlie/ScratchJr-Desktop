//
//  main.ts  - Orchestrator for ScratchJr Desktop main process.
//
//  Wires together the modular components:
//    - logging.ts: structured logging and debug flags
//    - database.ts: SQL.js database lifecycle
//    - data-store.ts: project file storage and media cache
//    - window-lifecycle.ts: BrowserWindow, security, navigation
//    - ipc-handlers.ts: all IPC channels between main and renderer

import { app, Menu, MenuItemConstructorOptions, dialog } from 'electron';
import { logFile, debugLog } from './main/logging';
import { ScratchJRDataStore } from './main/data-store';
import { createWindow, getWindow } from './main/window-lifecycle';
import * as ipcHandlers from './main/ipc-handlers';
import { checkForUpdate, openExternalUrl } from './main/updater';

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

/** Check for updates and show a native dialog with the result */
async function showUpdateCheck(): Promise<void> {
    const win = getWindow();
    const info = await checkForUpdate();
    if (info.available) {
        const result = dialog.showMessageBoxSync(win!, {
            type: 'info',
            buttons: ['Download', 'View Release', 'Cancel'],
            defaultId: 0,
            title: 'Update Available',
            message: `A new version is available: v${info.latestVersion}`,
            detail: `You are currently running v${info.currentVersion}.

${info.releaseNotes ? info.releaseNotes.slice(0, 500) : ''}`,
        });
        if (result === 0) {
            openExternalUrl(info.downloadUrl);
        } else if (result === 1) {
            openExternalUrl(info.releasePageUrl);
        }
    } else {
        dialog.showMessageBox(win!, {
            type: 'info',
            buttons: ['OK'],
            title: 'No Updates Available',
            message: `You are running the latest version (v${info.currentVersion}).`,
        });
    }
}

// App lifecycle
app.whenReady().then(async () => {
    dataStore = new ScratchJRDataStore(null);
    await dataStore.getDatabaseManager();
    debugLog('Database eagerly initialized');

    createWindow(dataStore);

    const fsMenu: MenuItemConstructorOptions[] = [
        {
            label: 'Toggle full screen',
            click: () => { const w = getWindow(); if (w) w.setFullScreen(!w.isFullScreen()); },
            accelerator: 'CmdOrCtrl+f'
        },
    ];
    if (dataStore.hasRestoreDatabase()) {
        fsMenu.push({ label: 'Restore projects', click: () => dataStore!.restoreProjects() });
    }
    fsMenu.push({ type: 'separator' });
    fsMenu.push({
        label: 'Check for Updates...',
        click: () => { showUpdateCheck(); },
    });
    fsMenu.push({ role: 'quit' });

    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: fsMenu,
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Auto-check for updates on launch (fire-and-forget, 3s delay to not slow startup)
    setTimeout(() => {
        showUpdateCheck();
    }, 3000);
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
