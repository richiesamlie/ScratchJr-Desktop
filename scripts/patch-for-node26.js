/**
 * Patches for Node.js 26 compatibility with Electron Forge 7 + @electron/packager v20
 * 
 * Run automatically via postinstall. Fixes:
 * 1. Forge core: hooks API mismatch (callback vs Promise-based)
 * 2. cross-zip: fs.rmdir({recursive}) removed in Node 26
 */

const fs = require('fs');
const path = require('path');

function patchFile(filePath, patches) {
    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${filePath} not found`);
        return false;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [search, replace] of patches) {
        if (content.includes(search)) {
            content = content.replace(search, replace);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`  PATCHED: ${filePath}`);
    } else {
        console.log(`  OK: ${filePath} (already patched or different version)`);
    }
    return changed;
}

console.log('Applying Node 26 compatibility patches...');

// 1. Patch @electron-forge/core package.js - bridge packager v20 opts object
const forgePkgPath = path.join(__dirname, '..', 'node_modules', '@electron-forge', 'core', 'dist', 'api', 'package.js');
patchFile(forgePkgPath, [
    // Replace hidePromiseFromPromisify to unwrap opts object
    [
        `function hidePromiseFromPromisify(fn) {
    return (...args) => {
        void fn(...args);
    };
}`,
        `function hidePromiseFromPromisify(fn) {
    return async (opts) => {
        if (opts && typeof opts === 'object' && opts.buildPath !== undefined) {
            await fn(opts.buildPath, opts.electronVersion, opts.platform, opts.arch);
        } else {
            await fn(opts);
        }
    };
}`
    ],
    // Replace sequentialHooks to use Promise-based style
    [
        `function sequentialHooks(hooks) {
    return [
        hidePromiseFromPromisify(async (buildPath, electronVersion, platform, arch, done) => {
            for (const hook of hooks) {
                try {
                    await (0, node_util_1.promisify)(hook)(buildPath, electronVersion, platform, arch);
                }
                catch (err) {
                    d('hook failed:', hook.toString(), err);
                    return done(err);
                }
            }
            done();
        }),
    ];
}`,
        `function sequentialHooks(hooks) {
    return [
        async (opts) => {
            for (const hook of hooks) {
                try {
                    await hook(opts);
                }
                catch (err) {
                    d('hook failed:', hook.toString(), err);
                    throw err;
                }
            }
        },
    ];
}`
    ],
    // Replace sequentialFinalizePackageTargetsHooks
    [
        `function sequentialFinalizePackageTargetsHooks(hooks) {
    return [
        hidePromiseFromPromisify(async (targets, done) => {
            for (const hook of hooks) {
                try {
                    await (0, node_util_1.promisify)(hook)(targets);
                }
                catch (err) {
                    return done(err);
                }
            }
            done();
        }),
    ];
}`,
        `function sequentialFinalizePackageTargetsHooks(hooks) {
    return [
        async (targets) => {
            for (const hook of hooks) {
                try {
                    await hook(targets);
                }
                catch (err) {
                    throw err;
                }
            }
        },
    ];
}`
    ],
]);

// 2. Patch cross-zip - fs.rmdir({recursive}) -> fs.rm
const crossZipPath = path.join(__dirname, '..', 'node_modules', 'cross-zip', 'index.js');
patchFile(crossZipPath, [
    [`fs.rmdir(outPath, { recursive: true, maxRetries: 3 }, doZip2)`, `fs.rm(outPath, { recursive: true, maxRetries: 3 }, doZip2)`],
    [`fs.rmdirSync(outPath, { recursive: true, maxRetries: 3 })`, `fs.rmSync(outPath, { recursive: true, maxRetries: 3 })`],
]);

console.log('Done.');
