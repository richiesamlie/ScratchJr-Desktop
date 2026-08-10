import { describe, it, expect } from 'vitest';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { isParentFolder, validateFilePath } = require('../../src/lib/path-utils.js');

const isWindows = process.platform === 'win32';

describe('isParentFolder', () => {
    it('returns true for a child path', () => {
        expect(isParentFolder('/app', '/app/css/style.css')).toBe(true);
    });

    it('returns true for a nested child path', () => {
        expect(isParentFolder('/app', '/app/src/utils/lib.js')).toBe(true);
    });

    it('returns false for path traversal with ..', () => {
        expect(isParentFolder('/app', '/app/../etc/passwd')).toBe(false);
    });

    it('returns false for absolute path outside parent', () => {
        expect(isParentFolder('/app', '/etc/passwd')).toBe(false);
    });

    it('returns false for parent itself (empty relative)', () => {
        expect(isParentFolder('/app', '/app')).toBe(false);
    });

    it('returns false for sibling directory', () => {
        expect(isParentFolder('/app', '/other/file.txt')).toBe(false);
    });

    it('returns true for deep nested path', () => {
        expect(isParentFolder('/app', '/app/a/b/c/d/e/f.txt')).toBe(true);
    });

    it('handles Windows-style paths', () => {
        // On Windows, path.relative handles backslashes
        if (!isWindows) return; // Skip on non-Windows
        const parent = 'C:\\Users\\app';
        const child = 'C:\\Users\\app\\file.txt';
        expect(isParentFolder(parent, child)).toBe(true);
    });

    it('blocks Windows path traversal', () => {
        if (!isWindows) return; // Skip on non-Windows
        const parent = 'C:\\Users\\app';
        const escape = 'C:\\Users\\other\\file.txt';
        expect(isParentFolder(parent, escape)).toBe(false);
    });
});

describe('validateFilePath', () => {
    const appRoot = '/test/app';

    it('returns resolved path for valid file', () => {
        const result = validateFilePath(appRoot, 'css/style.css');
        expect(result).toBe(path.resolve(appRoot, 'css/style.css'));
    });

    it('throws for null file', () => {
        expect(() => validateFilePath(appRoot, null)).toThrow('File cannot be null or empty');
    });

    it('throws for empty string', () => {
        expect(() => validateFilePath(appRoot, '')).toThrow('File cannot be null or empty');
    });

    it('throws for undefined file', () => {
        expect(() => validateFilePath(appRoot, undefined)).toThrow('File cannot be null or empty');
    });

    it('throws for path traversal', () => {
        expect(() => validateFilePath(appRoot, '../../../etc/passwd')).toThrow('file outside app folder');
    });

    it('throws for Windows root-relative escape', () => {
        if (!isWindows) return; // Backslash is not a path separator on Unix
        // path.join normalizes \etc\passwd as root-relative on Windows
        // After the fix, validateFilePath uses path.resolve to catch this
        expect(() => validateFilePath(appRoot, '\\etc\\passwd')).toThrow();
    });

    it('throws for absolute path outside parent', () => {
        if (!isWindows) return; // Windows drive paths are relative on Unix
        // Use a Windows-native absolute path that path.join won't collapse
        const escape = 'C:\\Windows\\System32\\config\\SAM';
        expect(() => validateFilePath(appRoot, escape)).toThrow();
    });

    it('accepts nested valid path', () => {
        const result = validateFilePath(appRoot, 'src/utils/lib.js');
        expect(result).toContain('lib.js');
    });
});
