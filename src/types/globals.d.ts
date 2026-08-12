/**
 * Ambient globals injected by the host environment (Electron preload,
 * Android WebView bridge, iOS webview). Populated at runtime; this file
 * just tells TypeScript they exist.
 */

interface AndroidInterfaceStatic {
    audio_play(url: string, volume: number): number | null;
    audio_stop(handle: number): void;
    audio_isplaying(handle: number): boolean;
    audio_sndfxwithvolume(name: string, volume: number): void;
    scratchjr_getgettingstartedvideopath(): string;
    // filled in as more call sites are typed
    [key: string]: unknown;
}

declare const AndroidInterface: AndroidInterfaceStatic;

declare class WebKitCSSMatrix {
    m11: number; m12: number; m13: number; m14: number;
    m21: number; m22: number; m23: number; m24: number;
    m31: number; m32: number; m33: number; m34: number;
    m41: number; m42: number; m43: number; m44: number;
    constructor(init?: string);
}

/**
 * The `window.tablet` bridge (ElectronDesktopInterface in electronClient.js).
 * Async methods resolve with the JSON/text payload from the main process.
 * Signature refinements land as call sites convert to .ts.
 */
interface TabletBridge {
    database_stmt(json: string): Promise<unknown>;
    database_query(json: string): Promise<unknown>;
    io_getsettings(): Promise<string>;
    io_getmedia(file: string): Promise<string>;
    io_getmediadata(key: string, offset: number, length: number): Promise<unknown>;
    io_getmediadone(key: string): Promise<unknown>;
    io_getmedialen(file: string, key: string): Promise<number>;
    io_setmedia(str: string, ext: string): Promise<unknown>;
    io_setmedianame(str: string, name: string, ext: string): Promise<unknown>;
    io_getmd5(str: string): Promise<string | null>;
    io_remove(str: string): Promise<unknown>;
    io_cleanassets(str: string): Promise<unknown>;
    io_registersound(dir: string, name: string): Promise<void>;
    io_getfile(str: string): Promise<string>;
    io_gettextresource(filename: string): Promise<string>;
    io_setfile(name: string, btoa_str: string): Promise<unknown>;
    getAudioCaptureElement(): unknown;
    io_playsound(name: string): void;
    io_stopsound(name: string): void;
    recordsound_recordstart(): void;
    recordsound_recordstop(): void;
    recordsound_volume(): number;
    recordsound_recordclose(keep: boolean): void;
    recordsound_startplay(): void;
    recordsound_stopplay(): void;
    askForPermission(): void;
    hideSplash(): void;
    deviceName(): string;
    analyticsEvent(category: string, action: string, usageLabel: string, value: number): void;
    scratchjr_stopfeed(): void;
    scratchjr_choosecamera(mode: string): void;
    scratchjr_captureimage(whenDone: () => void): void;
    scratchjr_cameracheck(...args: unknown[]): unknown;
    scratchjr_startfeed(str: string): void;
}

/**
 * Static surface of the ScratchAudio class as read through
 * `window.parent.ScratchAudio` by in-app help pages.
 */
interface ScratchAudioGlobal {
    sndFXWithVolume(name: string, volume: number): void;
}

/**
 * Settings loaded at runtime by appEntry.js from settings.json.
 * Shape matches src/app/settings.json; unlisted keys stay `unknown`.
 */
interface ScratchJrSettings {
    edition: string;
    scratchJrVersion: string;
    useStoryStarters: boolean;
    shareEnabled: boolean;
    defaultSprite: string;
    spriteOutlineColor: string;
    stageColor: string;
    textSpriteFont: string;
    blockArgFont: string;
    paletteBalloonFont: string;
    categoryStartColor: string;
    categoryMotionColor: string;
    categoryLooksColor: string;
    categorySoundColor: string;
    categoryFlowColor: string;
    categoryStopColor: string;
    paletteBlockShadowOpacity: number;
    autoSaveInterval: number;
    defaultLocale: string;
    defaultLocaleShort: string;
    supportedLocales: Record<string, string>;
    settingsPageDisabled: boolean;
    [key: string]: unknown;
}

interface Navigator {
    // Legacy IE-era property still read by Localization.determineLocaleFromBrowser
    userLanguage?: string;
}

interface Window {
    // Runtime-injected by appEntry.js from settings.json
    Settings?: ScratchJrSettings;
    // Electron bridge set by electronClient.js (ElectronDesktopInterface)
    tablet?: TabletBridge;
    // Legacy global assignment kept until Phase 8 teardown
    ScratchAudio?: ScratchAudioGlobal;
    // Non-standard touch handler used by Events.js
    ontouchleave?: ((this: GlobalEventHandlers, ev: TouchEvent) => void) | null;
    ScratchJr?: unknown;
    Undo?: unknown;
    Home?: unknown;
    loadPage?: unknown;
    isTouch?: boolean;
    devicePixelRatio?: number;
}
