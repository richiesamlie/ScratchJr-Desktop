/**
 * SQL payload validation for ScratchJr Desktop.
 *
 * Extracted from main.js to enable unit testing.
 * Validates and normalizes SQL payloads before they reach the database.
 */

const SQL_ALLOWED_VERBS = new Set(['select', 'insert', 'update', 'delete']);
const SQL_FORBIDDEN_KEYWORDS = [
    'pragma', 'attach', 'detach', 'drop', 'alter', 'create',
    'replace', 'vacuum', 'begin', 'commit', 'rollback', 'union',
];

export function normalizeAndValidateSqlPayload(jsonPayload: string | Record<string, unknown>): { stmt: string; values: unknown[] } {
    const parsed = (typeof jsonPayload === 'string') ? JSON.parse(jsonPayload) : jsonPayload;
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid sql payload');
    }

    const stmt = (typeof parsed.stmt === 'string') ? parsed.stmt.trim() : '';
    if (!stmt) {
        throw new Error('missing sql stmt');
    }

    const withoutTrailingSemicolon = stmt.replace(/;\s*$/, '');
    if (withoutTrailingSemicolon.includes(';')) {
        throw new Error('multiple sql statements are not allowed');
    }

    const lowered = withoutTrailingSemicolon.toLowerCase();
    const verb = lowered.split(/\s+/)[0];
    if (!SQL_ALLOWED_VERBS.has(verb)) {
        throw new Error(`sql verb not allowed: ${verb}`);
    }

    for (const keyword of SQL_FORBIDDEN_KEYWORDS) {
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (keywordRegex.test(lowered)) {
            throw new Error(`sql keyword not allowed: ${keyword}`);
        }
    }

    return {
        stmt: withoutTrailingSemicolon,
        values: Array.isArray(parsed.values) ? parsed.values : [],
    };
}

export { SQL_ALLOWED_VERBS, SQL_FORBIDDEN_KEYWORDS };
