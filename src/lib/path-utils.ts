/**
 * Path containment utilities for ScratchJr Desktop.
 *
 * Extracted from main.js to enable unit testing.
 * Prevents path traversal attacks in file operations.
 */

const path = require('path');

function isParentFolder(parent: string, dir: string) {
    const relative = path.relative(parent, dir);
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateFilePath(appRoot: string, requestedFile: string) {
    if (!requestedFile || requestedFile === '') {
        throw new Error('File cannot be null or empty');
    }
    // Resolve to absolute paths first to prevent Windows root-relative tricks
    // (e.g., path.join('/app', '\etc\passwd') treats '\etc' as root-relative on Windows)
    const resolvedRoot = path.resolve(appRoot);
    const resolvedFile = path.resolve(appRoot, requestedFile);
    if (!isParentFolder(resolvedRoot, resolvedFile)) {
        throw new Error(`safe resolve path - file outside app folder.${resolvedFile}`);
    }
    return resolvedFile;
}

module.exports = { isParentFolder, validateFilePath };
