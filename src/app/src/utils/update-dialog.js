/**
 * Update dialog module for ScratchJr Desktop.
 *
 * Checks for updates on launch and shows a popup dialog
 * with download options if a new version is available.
 */

/** @param {UpdateInfo} info */
export function showUpdateDialog(info) {
    if (!info.available) return;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'update-dialog-overlay';

    // Build release notes text
    const notesText = info.releaseNotes || '';

    overlay.innerHTML = `
        <div class="update-dialog">
            <h2>Update Available</h2>
            <div class="version-info">
                v${info.currentVersion} → v${info.latestVersion}
            </div>
            <div class="release-notes">${escapeHtml(notesText)}</div>
            <div class="buttons">
                <button class="btn btn-primary" id="update-download-btn">Download</button>
                <button class="btn btn-secondary" id="update-view-btn">View Release</button>
            </div>
            <button class="btn btn-dismiss" id="update-dismiss-btn">Skip for now</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Wire up buttons
    const bridge = /** @type {ScratchJrBridge} */ (window.scratchjr || window.tablet);

    /** @param {string} id @param {() => void} handler */
    const on = (id, handler) => {
        const el = /** @type {HTMLElement} */ (document.getElementById(id));
        if (el) el.addEventListener('click', handler);
    };

    on('update-download-btn', () => {
        bridge.updateOpenUrl(info.downloadUrl);
        closeDialog(overlay);
    });

    on('update-view-btn', () => {
        bridge.updateOpenUrl(info.releasePageUrl);
        closeDialog(overlay);
    });

    on('update-dismiss-btn', () => {
        closeDialog(overlay);
    });
}

/**
 * Check for updates and show dialog if available.
 * Called from appEntry.js after settings are loaded.
 */
export async function checkAndUpdate() {
    try {
        const bridge = /** @type {ScratchJrBridge} */ (window.scratchjr || window.tablet);
        if (!bridge || !bridge.updateCheck) return;

        const info = await bridge.updateCheck();
        if (info && info.available) {
            showUpdateDialog(info);
        }
    } catch (err) {
        // Silently ignore — update check is non-critical
        console.log('Update check failed:', err);
    }
}

/** @param {HTMLElement} overlay */
function closeDialog(overlay) {
    overlay.remove();
}

/** @param {string} str */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
