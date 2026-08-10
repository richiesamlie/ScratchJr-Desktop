/**
 * Data store module for ScratchJr Desktop.
 *
 * Manages project file storage, media cache, path validation,
 * and database lifecycle coordination.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, dialog } = require('electron');
const { DEBUG_DATABASE, DEBUG_FILEIO, debugLog } = require('./logging');
const { DatabaseManager } = require('./database');

class ScratchJRDataStore {
  constructor(electronBrowserWindow) {
    /** Cache of key to base64-encoded media value */
    this.mediaStrings = {};
    this.mediaCacheMaxSize = 50;
    this.electronBrowserWindow = electronBrowserWindow;
  }

  getMD5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async getDatabaseManager() {
    if (!this.databaseManager) {
      if (!this._dbInitPromise) {
        const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
        const scratchDBPath = path.join(scratchFolder, 'scratchjr.sqllite');
        this._dbInitPromise = DatabaseManager.initialize(scratchDBPath);
      }
      this.databaseManager = await this._dbInitPromise;
      if (DEBUG_DATABASE) debugLog('DatabaseManager created');
    }
    return this.databaseManager;
  }

  hasRestoreDatabase() {
    const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
    const scratchRestoreDB = path.join(scratchFolder, 'scratchjr.sqllite.restore');
    return fs.existsSync(scratchRestoreDB);
  }

  async restoreProjects() {
    const scratchFolder = ScratchJRDataStore.getScratchJRFolder();
    const scratchDBPath = path.join(scratchFolder, 'scratchjr.sqllite');
    const scratchRestoreDB = path.join(scratchFolder, 'scratchjr.sqllite.restore');

    if (fs.existsSync(scratchRestoreDB)) {
      this.databaseManager = await DatabaseManager.initialize(scratchDBPath, scratchRestoreDB);

      if (DEBUG_DATABASE) debugLog('DatabaseManager reloaded from restored copy');

      this.electronBrowserWindow.webContents.send('databaseRestored', {});

      dialog.showMessageBox(
        this.electronBrowserWindow,
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

  isInScratchJRFolder(fullPath) {
    if (!fullPath || fullPath.length === 0) return false;
    const testFolder = path.dirname(fullPath);
    const scratchJRPath = ScratchJRDataStore.getScratchJRFolder();
    return (scratchJRPath === testFolder);
  }

  isParentFolder(parent, dir) {
    const relative = path.relative(parent, dir);
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  static getScratchJRFolder() {
    const documents = app.getPath('documents');
    if (!documents) throw new Error('could not get documents folder');

    const scratchJRPath = path.join(documents, 'ScratchJR');
    this.ensureDir(scratchJRPath);
    return scratchJRPath;
  }

  static ensureDir(filePath) {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath);
    }
  }

  cacheMedia(key, base64EncodedStr) {
    const keys = Object.keys(this.mediaStrings);
    if (keys.length >= this.mediaCacheMaxSize) {
      delete this.mediaStrings[keys[0]];
    }
    this.mediaStrings[key] = base64EncodedStr;
  }

  getCachedMedia(key) {
    return this.mediaStrings[key];
  }

  removeFromMediaCache(key) {
    if (this.mediaStrings[key]) {
      delete this.mediaStrings[key];
    }
  }

  readProjectFileAsBase64EncodedString(filename) {
    const db = this.databaseManager;
    return db.readProjectFile(filename);
  }

  removeProjectFile(filename) {
    const db = this.databaseManager;
    db.removeProjectFile(filename);
  }

  writeProjectFile(file, contents, encoding) {
    const db = this.databaseManager;
    if (db.saveToProjectFiles(file, contents, encoding)) {
      return file;
    }
    return -1;
  }

  safeGetFilenameInAppDirectory(file, warnIfNotPresent) {
    if (!file || file === '') throw new Error('File cannot be null or empty');

    // __dirname here is the directory of this module (src/main/).
    // App root is one level up: src/main/ -> src/ -> src/app/
    const appRoot = path.join(__dirname, '..', 'app');

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

module.exports = { ScratchJRDataStore };
