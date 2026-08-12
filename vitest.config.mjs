import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Resolve `./foo.js` imports in .ts test subjects to `./foo.ts` when the
// .js file does not exist (TS convention: source keeps the emitted suffix).
const resolveDotTs = {
    name: 'resolve-dot-ts',
    enforce: 'pre',
    resolveId(source, importer) {
        if (!source.endsWith('.js') || !importer) return null;
        const candidate = path.resolve(path.dirname(importer), source);
        if (fs.existsSync(candidate)) return null;
        const asTs = candidate.replace(/\.js$/, '.ts');
        if (fs.existsSync(asTs)) return asTs;
        return null;
    },
};

export default defineConfig({
    plugins: [resolveDotTs],
    test: {
        include: ['tests/**/*.test.js'],
        globals: false,
        testTimeout: 10000,
    },
});
