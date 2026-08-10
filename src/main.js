//
//  main.js  - Orchestrator for ScratchJr Desktop main process.
//
//  Wires together the modular components:
//    - logging.js: structured logging and debug flags
//    - database.js: SQL.js database lifecycle
//    - data-store.js: project file storage and media cache
//    - window-lifecycle.js: BrowserWindow, security, navigation
//    - ipc-handlers.js: all IPC channels between main and renderer

const { app, Menu } = require('electron');
const { logFile, debugLog } = require('./main/logging');
const { ScratchJRDataStore } = require('./main/data-store');
const { createWindow, getWindow } = require('./main/window-lifecycle');
const ipcHandlers = require('./main/ipc-handlers');

let dataStore;

// Register crash handlers (must happen before any other code runs)
process.on('uncaughtException', (err) => {
  const entry = JSON.stringify({ts: new Date().toISOString(), type: 'uncaughtException', message: err?.message, stack: err?.stack});
  logFile.write(entry + '\n');
  process.stdout.write(entry + '\n');
  try { if (dataStore && dataStore.databaseManager) dataStore.databaseManager.save(); } catch (_) { /* best-effort save */ }
  logFile.end(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  const entry = JSON.stringify({ts: new Date().toISOString(), type: 'unhandledRejection', message: String(reason), stack: reason?.stack});
  logFile.write(entry + '\n');
  process.stdout.write(entry + '\n');
  try { if (dataStore && dataStore.databaseManager) dataStore.databaseManager.save(); } catch (_) { /* best-effort save */ }
  logFile.end(() => process.exit(1));
});

// Register IPC handlers (they use lazy getters so dataStore doesn't need to exist yet)
ipcHandlers.register(() => dataStore, getWindow);

// App lifecycle
app.whenReady().then(async () => {
  dataStore = new ScratchJRDataStore(null);
  await dataStore.getDatabaseManager();
  debugLog('Database eagerly initialized');

  createWindow(dataStore);

  let template;
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
          { label: 'Restore projects', click: dataStore.restoreProjects.bind(dataStore) },
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
  if (getWindow() === null) {
    createWindow(dataStore);
  }
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});
