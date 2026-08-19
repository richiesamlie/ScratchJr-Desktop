/**
 * Preload script for ScratchJr Desktop.
 *
 * Runs in an isolated context with access to Node.js APIs.
 * Exposes a minimal bridge API to the renderer via contextBridge.
 * This is the ONLY file that should require('electron') in the renderer process.
 */

const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Disable zoom (must happen in preload since it requires webFrame)
webFrame.setVisualZoomLevelLimits(1, 1);

/**
 * ScratchJr bridge API exposed to renderer as window.scratchjr
 *
 * All request/response channels use invoke (async).
 * Fire-and-forget channels use send.
 * Event listeners use on.
 */
contextBridge.exposeInMainWorld('scratchjr', {

    // ---- Database ----
    database_stmt: (json) => ipcRenderer.invoke('database_stmt', json),
    database_query: (json) => ipcRenderer.invoke('database_query', json),

    // ---- Settings & Resources ----
    io_getsettings: () => ipcRenderer.invoke('io_getsettings', null),
    io_gettextresource: (filename) => ipcRenderer.invoke('io_gettextresource', filename),
    io_getIsDebug: () => ipcRenderer.invoke('io_getIsDebug'),
    io_getLang: () => ipcRenderer.invoke('io_getLang'),

    // ---- File I/O ----
    io_setfile: (name, contents) => ipcRenderer.invoke('io_setfile', { name, contents }),
    io_getfile: (str) => ipcRenderer.invoke('io_getfile', str),
    io_remove: (str) => ipcRenderer.invoke('io_remove', str),
    io_cleanassets: (str) => ipcRenderer.invoke('io_cleanassets', str),
    io_getmd5: (str) => ipcRenderer.invoke('io_getmd5', str),

    // ---- Media I/O ----
    io_getmedia: (file) => ipcRenderer.invoke('io_getmedia', file),
    io_getmediadata: (key, offset, length) => ipcRenderer.invoke('io_getmediadata', key, offset, length),
    io_getmediadone: (key) => ipcRenderer.invoke('io_getmediadone', key),
    io_getmedialen: (file, key) => ipcRenderer.invoke('io_getmedialen', file, key),
    io_setmedia: (str, ext) => ipcRenderer.invoke('io_setmedia', str, ext),
    io_setmedianame: (str, name, ext) => ipcRenderer.invoke('io_setmedianame', str, name, ext),
    io_getAudioData: (name) => ipcRenderer.invoke('io_getAudioData', name),

    // ---- Debug (fire-and-forget) ----
    debugWriteLog: (args) => ipcRenderer.send('debugWriteLog', args),

    // ---- Lifecycle (fire-and-forget) ----
    sendAppClosedAcked: () => ipcRenderer.send('app-closed-acked'),

    // ---- Event listeners (main → renderer push) ----
    onDatabaseRestored: (callback) => {
        ipcRenderer.on('databaseRestored', () => callback());
    },
    onKeyboardShortcut: (callback) => {
        ipcRenderer.on('keyboard-shortcut', (_event, action) => callback(action));
    },
    onAppClose: (callback) => {
        ipcRenderer.on('app-close', () => callback());
    },
});
