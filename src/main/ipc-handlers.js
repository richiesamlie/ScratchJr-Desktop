/**
 * IPC handlers module for ScratchJr Desktop.
 *
 * Registers all ipcMain.handle/ipcMain.on handlers for the renderer bridge.
 * Each handler receives its dependencies via the register() function.
 */

const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const {
  DEBUG, DEBUG_DATABASE, DEBUG_FILEIO, DEBUG_RESOURCEIO, DEBUG_NYI, debugLog
} = require('./logging');
const { normalizeAndValidateSqlPayload } = require('../lib/sql-validator');

function register(getDataStore, getWindow) {
  ipcMain.handle('io_getIsDebug', () => {
    return DEBUG;
  });

  ipcMain.on('debugWriteLog', (event, args) => {
    debugLog(args);
  });

  ipcMain.handle('io_cleanassets', (_event, fileType) => {
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

  ipcMain.handle('io_setfile', (_event, arg) => {
    if (DEBUG_FILEIO) debugLog('io_setfile', arg);
    try {
      return getDataStore().writeProjectFile(arg.name, arg.contents, { encoding: 'utf8' });
    } catch (e) {
      debugLog('io_setfile error:', e);
      return false;
    }
  });

  ipcMain.handle('io_getfile', (_event, arg) => {
    if (DEBUG_FILEIO) debugLog('io_getfile', arg);
    try {
      return getDataStore().readProjectFileAsBase64EncodedString(arg);
    } catch (e) {
      debugLog('io_getfile error:', e);
      return null;
    }
  });

  ipcMain.handle('io_getmedia', (_event, filename) => {
    if (DEBUG_FILEIO) debugLog('io_getmedia', filename);
    try {
      return getDataStore().readProjectFileAsBase64EncodedString(filename);
    } catch (e) {
      debugLog('io_getmedia error:', e);
      return null;
    }
  });

  ipcMain.handle('io_getmediadata', (_event, key, offset, length) => {
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

  ipcMain.handle('io_getmediadone', (_event, key) => {
    if (DEBUG_FILEIO) debugLog('io_getmediadone', key);
    getDataStore().removeFromMediaCache(key);
    return true;
  });

  ipcMain.handle('io_getmedialen', (_event, file, key) => {
    if (DEBUG_FILEIO) debugLog('io_getmedialen', file, key);
    const dataStore = getDataStore();
    const encodedStr = dataStore.readProjectFileAsBase64EncodedString(file);
    dataStore.cacheMedia(key, encodedStr);
    return (encodedStr) ? encodedStr.length : 0;
  });

  ipcMain.handle('io_setmedia', (_event, base64ContentStr, ext) => {
    if (DEBUG_FILEIO) debugLog('io_setmedia - write file', ext);
    try {
      const dataStore = getDataStore();
      const filename = `${dataStore.getMD5(base64ContentStr)}.${ext}`;
      dataStore.writeProjectFile(filename, base64ContentStr, { encoding: 'base64' });
      return filename;
    } catch (e) {
      debugLog('io_setmedia error:', e);
      return null;
    }
  });

  ipcMain.handle('io_setmedianame', (_event, encodedData, key, ext) => {
    if (DEBUG_FILEIO) debugLog('io_setmedianame', key, ext);
    try {
      const filename = `${key}.${ext}`;
      getDataStore().writeProjectFile(filename, encodedData, { encoding: 'base64' });
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

  ipcMain.handle('io_getmd5', (_event, data) => {
    if (DEBUG_FILEIO) debugLog('io_getmd5');
    try {
      return getDataStore().getMD5(data);
    } catch (e) {
      debugLog('io_getmd5', e);
      return null;
    }
  });

  ipcMain.handle('io_remove', (_event, filename) => {
    if (DEBUG_FILEIO) debugLog('io_remove: ', filename);
    try {
      getDataStore().removeProjectFile(filename);
      return true;
    } catch (e) {
      debugLog('io_remove error:', e);
      return false;
    }
  });

  ipcMain.handle('io_gettextresource', (_event, filename) => {
    if (DEBUG_RESOURCEIO) debugLog('io_gettextresource', filename);
    const filePath = getDataStore().safeGetFilenameInAppDirectory(filename, true);
    if (filePath) {
      return fs.readFileSync(filePath, 'utf8');
    }
    debugLog('io_gettextresource: File could not be resolved.', filename);
    return null;
  });

  ipcMain.handle('io_getAudioData', (_event, audioName) => {
    if (DEBUG_FILEIO) debugLog('io_getAudioData - looking for', audioName);
    const dataStore = getDataStore();
    let filePath = dataStore.safeGetFilenameInAppDirectory(audioName, false);
    if (!filePath) {
      filePath = dataStore.safeGetFilenameInAppDirectory('sounds/' + audioName, false);
    }
    if (!filePath) {
      if (DEBUG_FILEIO) debugLog('...trying to look in the PROJECTFILE table', audioName);
      let projectDBFile = dataStore.readProjectFileAsBase64EncodedString(audioName);
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

  // IPC sender validation: reject calls from unexpected windows
  function validateSender(event) {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    return event.sender === win.webContents;
  }

  ipcMain.handle('database_stmt', (_event, json) => {
    if (DEBUG_DATABASE) debugLog('database_stmt', json);
    try {
      const safeQuery = normalizeAndValidateSqlPayload(json);
      const db = getDataStore().databaseManager;
      const result = db.stmt(safeQuery);
      if (DEBUG_DATABASE) debugLog('database_stmt result:', result);
      return result;
    } catch (e) {
      debugLog('database_stmt blocked:', e.message);
      return -1;
    }
  });

  ipcMain.handle('database_query', (_event, json) => {
    if (DEBUG_DATABASE) debugLog('database_query', json);
    try {
      const safeQuery = normalizeAndValidateSqlPayload(json);
      const db = getDataStore().databaseManager;
      return JSON.stringify(db.query(safeQuery));
    } catch (e) {
      debugLog('database_query blocked:', e.message);
      return '[]';
    }
  });

  ipcMain.on('app-closed-acked', (event) => {
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
}

module.exports = { register };
