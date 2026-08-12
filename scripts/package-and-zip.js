/**
 * Package and zip ScratchJr for distribution.
 * 
 * Workaround for Electron Forge make pipeline issues with Node 26.
 * Uses @electron/packager directly, then creates a zip archive.
 * 
 * Usage: npm run make:zip
 */

const { packager } = require('@electron/packager');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const pkg = require('../package.json');

// Target platform/arch. Defaults to the host so plain `npm run make:zip`
// behaves as before; override for cross-building:
//   npm_config_platform=linux npm_config_arch=arm64 npm run make:zip
const targetPlatform = process.env.npm_config_platform || process.platform;
const targetArch = process.env.npm_config_arch || 'x64';

if (targetPlatform === 'darwin' && process.platform === 'win32') {
    console.error(
        'Cannot safely build macOS from Windows: the .app bundle relies on\n'
        + 'framework symlinks that Windows zipping destroys. Build darwin on a\n'
        + 'macOS runner (the CI matrix does this) — refusing to continue.'
    );
    process.exit(1);
}

    const options = {
    dir: process.cwd(),
    name: pkg.productName || pkg.name,
    platform: targetPlatform,
    arch: targetArch,
    out: path.join(process.cwd(), 'out'),
    overwrite: true,
    icon: path.join(process.cwd(), targetPlatform === 'win32'
        ? 'src/icons/win/icon.ico'
        : targetPlatform === 'darwin'
            ? 'src/icons/mac/icon.icns'
            : 'src/icons/png/512x512.png'),
    asar: true,
    ignore: [/^\/out\//],
    appCopyright: pkg['app-copyright'] || '',
    appVersion: pkg.version,
    // Code signing: set these env vars in CI when certificates are available
    // CSC_LINK: path to certificate file (.p12/.pfx on Windows, .p12 on macOS)
    // CSC_KEY_PASSWORD: certificate password
    // APPLE_ID / APPLE_ID_PASSWORD / APPLE_TEAM_ID: for notarization (macOS)
};

console.log(`Packaging ${pkg.productName || pkg.name} v${pkg.version} for ${options.platform}/${options.arch}...`);

packager(options)
    .then((outputPaths) => {
        console.log('Packaged:', outputPaths);

        for (const outDir of outputPaths) {
            const zipName = `${path.basename(outDir)}.zip`;
            const zipPath = path.join(path.dirname(outDir), zipName);

            console.log(`Creating ${zipName}...`);

            if (process.platform === 'win32') {
                // Use PowerShell on Windows
                execSync(
                    `powershell -Command "Compress-Archive -Path '${outDir}' -DestinationPath '${zipPath}' -Force"`,
                    { stdio: 'inherit' }
                );
            } else {
                // Use zip on macOS/Linux
                execSync(`cd "${path.dirname(outDir)}" && zip -r "${zipName}" "${path.basename(outDir)}"`, {
                    stdio: 'inherit',
                });
            }

            const stats = fs.statSync(zipPath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
            console.log(`Created: ${zipPath} (${sizeMB} MB)`);
        }

        console.log('\nDone!');
    })
    .catch((err) => {
        console.error('Packaging failed:', err);
        process.exit(1);
    });
