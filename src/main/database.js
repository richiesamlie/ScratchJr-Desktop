/**
 * Database module for ScratchJr Desktop.
 *
 * Manages the SQL.js database lifecycle: initialize, open, close, save,
 * migrations, project file CRUD, and asset cleanup.
 */

const fs = require('fs');
const { DEBUG_DATABASE, DEBUG_CLEANASSETS, debugLog } = require('./logging');

class DatabaseManager {
  constructor(databaseFilename, databaseRestoreFilename, SQL) {
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

  static async initialize(databaseFilename, databaseRestoreFilename) {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({});
    return new DatabaseManager(databaseFilename, databaseRestoreFilename, SQL);
  }

  open(SQL) {
    const fileToOpen = (this.databaseRestoreFilename) ? this.databaseRestoreFilename : this.databaseFilename;
    const filebuffer = fs.readFileSync(fileToOpen);
    this.db = new SQL.Database(filebuffer);
    this.db.handleError = this.handleError;

    if (this.databaseRestoreFilename) {
      this.save();
    }
  }

  handleError(e) {
    if (DEBUG_DATABASE) debugLog(e);
  }

  close() {
    if (this.db) this.db.close();
    this.db = null;
  }

  isOpen() {
    return (this.db != null);
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.databaseFilename, buffer);
  }

  cleanProjectFiles(fileType) {
    if (fileType === 'wav') {
      fileType = 'webm';
    }

    const queryListAllFilesWithExtension = {
      stmt: `select MD5 FROM PROJECTFILES WHERE MD5 LIKE ?`,
      values: [`%.${fileType}`],
    };

    const allProjectFilesWithExtension = this.query(queryListAllFilesWithExtension);

    for (let i = 0; i < allProjectFilesWithExtension.length; i++) {
      const currentFileToCheck = allProjectFilesWithExtension[i].MD5;

      if (!currentFileToCheck) continue;

      if (DEBUG_CLEANASSETS) debugLog('checking if in use: ', currentFileToCheck);

      const queryFindFileInProjects = {
        stmt: 'select ID from PROJECTS where json like ?',
        values: [`%${currentFileToCheck}%`],
      };

      const projectJSON = this.query(queryFindFileInProjects);
      if (projectJSON.length > 0) {
        if (DEBUG_CLEANASSETS) debugLog('...project is currently using: ', currentFileToCheck);
        continue;
      }

      const queryFindFileInUsershapes = {
        stmt: 'select MD5 from USERSHAPES where MD5 = ?',
        values: [currentFileToCheck],
      };

      const shapeFiles = this.query(queryFindFileInUsershapes);
      if (shapeFiles.length > 0) {
        if (DEBUG_CLEANASSETS) debugLog('...user shapes is using: ', currentFileToCheck, shapeFiles);
        continue;
      }

      const queryFindFileInUserbkgs = {
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

  removeProjectFile(fileMD5) {
    const json = {};
    json.cond = 'MD5 = ?';
    json.items = ['CONTENTS'];
    json.values = [fileMD5];
    const table = 'PROJECTFILES';

    json.stmt = `delete from ${table} where ${json.cond}`;
    this.query(json);
    this.save();
  }

  readProjectFile(fileMD5) {
    const json = {};
    json.cond = 'MD5 = ?';
    json.items = ['CONTENTS'];
    json.values = [fileMD5];
    const table = 'PROJECTFILES';

    json.stmt = `select ${json.items} from ${table} where ${json.cond}${json.order ? ` order by ${json.order}` : ''}`;

    const rows = this.query(json);

    if (rows.length > 0) {
      return rows[0].CONTENTS;
    }
    return null;
  }

  saveToProjectFiles(fileMD5, content) {
    const json = {};
    const keylist = ['md5', 'contents'];
    const values = '?,?';
    json.values = [fileMD5, content];
    json.stmt = `insert or replace into projectfiles (${keylist.toString()}) values (${values})`;
    var insertSQLResult = this.stmt(json);

    this.save();

    return (insertSQLResult >= 0);
  }

  getRowData(res) {
    return res.getAsObject();
  }

  initTables(SQL) {
    if (this.db) throw new Error('database already created');
    this.db = new SQL.Database();
    this.db.handleError = this.handleError;

    if (DEBUG_DATABASE) debugLog('making tables...');

    this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MTIME DATETIME, ALTMD5 TEXT, POS INTEGER, NAME TEXT, JSON TEXT, THUMBNAIL TEXT, OWNER TEXT, GALLERY TEXT, DELETED TEXT, VERSION TEXT)\n');
    this.db.exec('CREATE TABLE IF NOT EXISTS USERSHAPES (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, NAME TEXT, OWNER TEXT, SCALE TEXT, VERSION TEXT)\n');
    this.db.exec('CREATE TABLE IF NOT EXISTS USERBKGS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, OWNER TEXT,  VERSION TEXT)\n');
    this.db.exec('CREATE TABLE IF NOT EXISTS PROJECTFILES (MD5 TEXT PRIMARY KEY, CONTENTS TEXT)\n');
  }

  clearTables() {
    this.db.exec('DELETE FROM PROJECTS');
    this.db.exec('DELETE FROM USERSHAPES');
    this.db.exec('DELETE FROM USERBKGS');
  }

  runMigrations() {
    try {
      this.db.exec('ALTER TABLE PROJECTS ADD COLUMN ISGIFT INTEGER DEFAULT 0');
    } catch (e) {
      debugLog('failed to migrate tables', e);
    }
  }

  stmt(jsonStrOrJsonObj) {
    try {
      const json = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};
      const stmt = json.stmt;
      const values = json.values;

      if (DEBUG_DATABASE) debugLog('DatabaseManager executing stmt', stmt, values);

      const statement = this.db.prepare(stmt, values);

      try {
        while (statement.step()) statement.get();

        const result = this.db.exec('select last_insert_rowid();');
        const lastRowId = result[0].values[0][0];

        return lastRowId;
      } finally {
        statement.free();
      }
    } catch (e) {
      if (DEBUG_DATABASE) debugLog('stmt failed', jsonStrOrJsonObj, e);
      return -1;
    }
  }

  query(jsonStrOrJsonObj) {
    try {
      const json = (typeof jsonStrOrJsonObj === 'string') ? JSON.parse(jsonStrOrJsonObj) : jsonStrOrJsonObj || {};

      const stmt = json.stmt;
      const values = json.values;

      const statement = this.db.prepare(stmt, values);

      try {
        const rows = [];
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

module.exports = { DatabaseManager };
