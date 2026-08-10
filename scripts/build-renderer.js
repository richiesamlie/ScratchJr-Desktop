/**
 * Bundle the ScratchJr renderer entry point with esbuild.
 *
 * Bundles src/app/appEntry.js and all its imports (including npm deps)
 * into a single file that can be loaded by the HTML pages.
 *
 * Usage: node scripts/build-renderer.js [--watch]
 */

const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
    entryPoints: [path.resolve(__dirname, '..', 'src', 'app', 'renderer-entry.js')],
    bundle: true,
    outfile: path.resolve(__dirname, '..', 'src', 'app', 'dist', 'app.bundle.js'),
    format: 'esm',
    platform: 'browser',
    target: ['chrome134'],  // Electron 42 uses Chromium 134
    sourcemap: true,
    minify: false,  // keep readable for debugging
    logLevel: 'info',
};

async function main() {
    if (isWatch) {
        const ctx = await esbuild.context(options);
        await ctx.watch();
        console.log('Watching for renderer changes...');
    } else {
        await esbuild.build(options);
        console.log('Renderer bundle built successfully.');
    }
}

main().catch((err) => {
    console.error('Renderer bundle failed:', err);
    process.exit(1);
});
