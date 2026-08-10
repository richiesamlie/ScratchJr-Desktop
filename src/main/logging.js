/**
 * Logging module for ScratchJr Desktop main process.
 *
 * Sets up structured logging to a debug.log file and overrides
 * console.log/console.error to write to both file and stdout.
 */

const path = require('path');
const fs = require('fs');
const util = require('util');
const { app } = require('electron');

const isDev = !app.isPackaged || !!process.env.DEBUG_SCRATCHJR;

// --- Structured log file (initialized early so crash handlers can use it) ---
const logPath = path.join(app.getPath('userData'), 'debug.log');
const logFile = fs.createWriteStream(logPath, { flags: 'a' });
const logStdout = process.stdout;

console.log = function (...args) {
  const msg = util.format(...args);
  logFile.write(msg + '\n');
  logStdout.write(msg + '\n');
};
console.error = console.log;

// Debug flags
const DEBUG = isDev;
const DEBUG_DATABASE = DEBUG && false;
const DEBUG_FILEIO = DEBUG && false;
const DEBUG_RESOURCEIO = DEBUG && false;
const DEBUG_CLEANASSETS = DEBUG && false;
const DEBUG_NYI = DEBUG && false;
const DEBUG_LOAD_DEVTOOLS = DEBUG && true;

function debugLog(...args) {
  if (DEBUG) {
    console.log(args);
  }
}

module.exports = {
  isDev,
  DEBUG,
  DEBUG_DATABASE,
  DEBUG_FILEIO,
  DEBUG_RESOURCEIO,
  DEBUG_CLEANASSETS,
  DEBUG_NYI,
  DEBUG_LOAD_DEVTOOLS,
  debugLog,
  logFile,
  logStdout,
};
