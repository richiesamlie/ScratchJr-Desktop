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

    const options = {
    dir: process.cwd(),
    name: pkg.productName || pkg.name,
    platform: process.platform,
    arch: process.env.npm_config_arch || 'x64',
    out: path.join(process.cwd(), 'out'),
    overwrite: true,
    icon: path.join(process.cwd(), process.platform === 'win32'
        ? 'src/icons/win/icon.ico'
        : process.platform === 'darwin'
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
