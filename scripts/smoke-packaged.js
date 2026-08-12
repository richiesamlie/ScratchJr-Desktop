/**
 * Smoke check for a PACKAGED ScratchJr build.
 *
 * Boots the packaged executable and verifies the renderer loads
 * ([SCRATCHJR_READY] from the main process). Unlike scripts/smoke.js this
 * exercises the actual packaged artifact, so it catches packaging regressions
 * (missing renderer bundle, broken entry) that a dev-boot check cannot.
 *
 * Usage: node scripts/smoke-packaged.js <packaged-dir>
 *        (e.g. out/ScratchJr-win32-x64)
 * Exit 0 = pass, exit 1 = fail.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TIMEOUT_MS = 60_000;
const BOOT_MARKERS = ['[SCRATCHJR_READY]'];
const FATAL_PATTERNS = [
    /SyntaxError/,
    /ReferenceError/,
    /TypeError/,
    /Cannot find module/,
    /MODULE_NOT_FOUND/,
    /App threw an error during load/,
];

const packagedDir = path.resolve(process.argv[2] || 'out/ScratchJr-win32-x64');
const exeName = process.platform === 'win32' ? 'ScratchJr.exe' : 'ScratchJr';
const exePath = path.join(packagedDir, exeName);
if (!fs.existsSync(exePath)) {
    console.error(`FAIL: packaged executable not found at ${exePath}`);
    process.exit(1);
}

let bootSeen = false;
let fatalHit = null;
const collected = [];
let postBootTimer = null;
let settled = false;

const child = spawn(exePath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
});

function checkLine(line) {
    if (!bootSeen && BOOT_MARKERS.some((marker) => line.includes(marker))) {
        bootSeen = true;
        postBootTimer = setTimeout(() => {
            if (!fatalHit) {
                finalize(0, false);
            }
        }, 3000);
    }
    if (!fatalHit) {
        for (const pat of FATAL_PATTERNS) {
            if (pat.test(line)) {
                fatalHit = line;
                if (postBootTimer) clearTimeout(postBootTimer);
                break;
            }
        }
    }
}

function onChunk(chunk, label) {
    const text = chunk.toString();
    collected.push(text);
    for (const line of text.split(/\r?\n/)) {
        if (line.trim()) checkLine(line);
    }
}

child.stdout.on('data', (d) => onChunk(d, 'stdout'));
child.stderr.on('data', (d) => onChunk(d, 'stderr'));

function finalize(code, timedOut = false) {
    if (settled) return;
    settled = true;
    if (postBootTimer) clearTimeout(postBootTimer);
    if (timedOut) {
        console.log('Timed out waiting for boot marker.');
    }
    if (fatalHit) {
        console.log(`FAIL: fatal error detected: ${fatalHit}`);
        console.log('--- last output ---');
        console.log(collected.slice(-10).join('').slice(-2000));
        process.exit(1);
    }
    if (!bootSeen) {
        console.log('FAIL: [SCRATCHJR_READY] not seen.');
        console.log('--- last output ---');
        console.log(collected.slice(-10).join('').slice(-2000));
        process.exit(1);
    }
    if (code && code !== 0) {
        console.log(`FAIL: app exited with code ${code}`);
        process.exit(1);
    }
    console.log('PASS: packaged app booted without fatal errors.');
    process.exit(0);
}

const timer = setTimeout(() => {
    if (bootSeen && !fatalHit) {
        // Boot marker seen but post-boot window not elapsed; treat as pass.
        finalize(0, false);
    } else {
        finalize(1, true);
    }
}, TIMEOUT_MS);

child.on('error', (err) => {
    console.log(`FAIL: failed to spawn ${exePath}: ${err.message}`);
    process.exit(1);
});

child.on('close', (code) => {
    finalize(code, false);
});

// Ensure the child is killed if this script is interrupted.
process.on('SIGINT', () => {
    child.kill('SIGKILL');
    finalize(1, true);
});
