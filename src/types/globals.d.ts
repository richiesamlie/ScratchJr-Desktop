/**
 * Ambient globals injected by the host environment (Electron preload,
 * Android WebView bridge, iOS webview). Populated at runtime; this file
 * just tells TypeScript they exist.
 */

interface AndroidInterfaceStatic {
    audio_play(url: string, volume: number): number | null;
    audio_stop(handle: number): void;
    audio_isplaying(handle: number): boolean;
    // filled in as more call sites are typed
    [key: string]: unknown;
}

declare const AndroidInterface: AndroidInterfaceStatic;

interface Window {
    ScratchJr?: unknown;
    Undo?: unknown;
    Home?: unknown;
    loadPage?: unknown;
    isTouch?: boolean;
    devicePixelRatio?: number;
}
