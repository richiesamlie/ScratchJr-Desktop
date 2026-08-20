/**
 * Update checker module for ScratchJr Desktop.
 *
 * Checks GitHub releases API for the latest version and compares
 * with the current version. Returns update info for the renderer.
 */

import { app, shell, BrowserWindow } from 'electron';
import { debugLog } from './logging';

const REPO_OWNER = 'richiesamlie';
const REPO_NAME = 'ScratchJr-Desktop-Reborn';
const CHECK_TIMEOUT_MS = 10_000;

export interface UpdateInfo {
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    downloadUrl: string;
    releasePageUrl: string;
    releaseNotes: string;
}

/**
 * Compare two semver strings. Returns:
 *   -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na < nb) return -1;
        if (na > nb) return 1;
    }
    return 0;
}

/**
 * Check GitHub releases API for the latest version.
 * Returns UpdateInfo with whether an update is available.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion();
    const currentTag = `v${currentVersion}`;
    const releasePageUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

    const defaultResult: UpdateInfo = {
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: '',
        releasePageUrl,
        releaseNotes: '',
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
            {
                signal: controller.signal,
                headers: { 'Accept': 'application/vnd.github.v3+json' },
            }
        );
        clearTimeout(timeout);

        if (!response.ok) {
            debugLog('Update check failed: HTTP', response.status);
            return defaultResult;
        }

        const release = await response.json() as {
            tag_name: string;
            body?: string;
            assets?: { name: string; browser_download_url: string }[];
        };

        const latestVersion = release.tag_name.replace(/^v/, '');

        // Find the platform-appropriate download URL
        let downloadUrl = releasePageUrl; // fallback to release page
        if (release.assets && release.assets.length > 0) {
            const platform = process.platform;
            const arch = process.arch;

            // Pick the best matching asset
            let assetName: string | null = null;
            if (platform === 'win32') {
                assetName = 'ScratchJr-win32-x64.zip';
            } else if (platform === 'darwin') {
                assetName = arch === 'arm64'
                    ? 'ScratchJr-darwin-arm64.zip'
                    : 'ScratchJr-darwin-x64.zip';
            } else if (platform === 'linux') {
                assetName = arch === 'arm64'
                    ? 'ScratchJr-linux-arm64.zip'
                    : 'ScratchJr-linux-x64.zip';
            }

            if (assetName) {
                const asset = release.assets.find((a) => a.name === assetName);
                if (asset) {
                    downloadUrl = asset.browser_download_url;
                }
            }
        }

        const available = compareVersions(latestVersion, currentVersion) > 0;

        if (available) {
            debugLog(`Update available: ${currentVersion} → ${latestVersion}`);
        } else {
            debugLog(`App is up to date (${currentVersion})`);
        }

        return {
            available,
            currentVersion,
            latestVersion,
            downloadUrl,
            releasePageUrl,
            releaseNotes: release.body || '',
        };
    } catch (err) {
        debugLog('Update check error:', err);
        return defaultResult;
    }
}

/**
 * Open a URL in the default browser.
 */
export function openExternalUrl(url: string): void {
    shell.openExternal(url).catch((err) => {
        debugLog('Failed to open URL:', url, err);
    });
}
