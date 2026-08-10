
/**
 * Smoke check for ScratchJr Desktop.
 *
 * Launches the app via electron-forge, waits for successful boot,
 * then checks for fatal errors in stdout/stderr.
 *
 * Usage: node scripts/smoke.js
 * Exit 0 = pass, exit 1 = fail.
 */

const { spawn } = require('child_process');
const path = require('path');

const TIMEOUT_MS = 45_000;
const BOOT_MARKERS = ['[SCRATCHJR_READY]'];
const FATAL_PATTERNS = [
    /SyntaxError/,
    /ReferenceError/,
    /TypeError/,
    /Cannot find module/,
    /MODULE_NOT_FOUND/,
    /App threw an error during load/,
];

let bootSeen = false;
let fatalHit = null;
const collected = [];
let postBootTimer = null;

if (process.platform === 'win32') {
    // Best-effort cleanup from a prior smoke run.
    spawn('taskkill', ['/F', '/IM', 'ScratchJr.exe'], { stdio: 'ignore' });
}

const child = spawn('cmd.exe', ['/c', 'npm', 'start'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, NODE_ENV: 'development' },
});

function checkLine(line) {
    if (!bootSeen && BOOT_MARKERS.some((marker) => line.includes(marker))) {
        bootSeen = true;
        // Wait 3 seconds to catch any immediate post-boot fatal errors, then pass.
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
    const lines = chunk.toString().split(/[\r\n]+/);
    for (const line of lines) {
        if (line.trim()) {
            collected.push(`[${label}] ${line}`);
            checkLine(line);
        }
    }
}

child.stdout.on('data', (d) => onChunk(d, 'stdout'));
child.stderr.on('data', (d) => onChunk(d, 'stderr'));

let settled = false;

function finalize(code, timedOut = false) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (postBootTimer) clearTimeout(postBootTimer);

    // Kill the child process tree
    if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
        try { child.kill('SIGTERM'); } catch (_) { /* process may already be dead */ }
    }

    console.log('\n=== Smoke Check Results ===\n');
    console.log(`Boot marker seen: ${bootSeen}`);
    console.log(`Fatal pattern hit: ${fatalHit || '(none)'}`);
    console.log(`Exit code: ${code}`);
    console.log(`Timed out: ${timedOut}`);

    if (collected.length > 0) {
        console.log('\n--- Last 30 lines ---');
        const tail = collected.slice(-30);
        for (const line of tail) {
            console.log(line);
        }
    }

    console.log('\n=== Verdict ===');
    if (!bootSeen) {
        console.log('FAIL: Boot marker not seen within timeout.');
        process.exit(1);
    }
    if (fatalHit) {
        console.log(`FAIL: Fatal error detected: ${fatalHit}`);
        process.exit(1);
    }
    console.log('PASS: App booted without fatal errors.');
    process.exit(0);
}

const timer = setTimeout(() => {
    if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.on('close', () => finalize(null, true));
        setTimeout(() => finalize(null, true), 3000);
        return;
    }

    child.kill('SIGTERM');
    setTimeout(() => {
        child.kill('SIGKILL');
        finalize(null, true);
    }, 3000);
}, TIMEOUT_MS);

child.on('error', (err) => {
    fatalHit = `spawn error: ${err.message}`;
    finalize(null, false);
});

child.on('close', (code) => {
    finalize(code, false);
});
