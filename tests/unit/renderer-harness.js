// jsdom renderer harness: jsdom does not implement SVGMatrix/WebKitCSSMatrix
// or 2D canvas rendering. Provide minimal stubs so the editor module graph
// imports and constructs. Only touches globals; import this FIRST in any
// renderer test before importing editor modules.

// SVGMatrix: used at module load (Transform.ts augments its prototype) and
// returned by getCTM()/createSVGMatrix in real browsers.
if (typeof globalThis.SVGMatrix === 'undefined') {
    globalThis.SVGMatrix = class {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0;
            this.d = 1; this.e = 0; this.f = 0;
        }
    };
}

// WebKitCSSMatrix: used by Events/Transform for 3D drag transforms.
if (typeof globalThis.WebKitCSSMatrix === 'undefined') {
    globalThis.WebKitCSSMatrix = class {
        constructor() {
            for (let i = 1; i <= 4; i++) {
                for (let j = 1; j <= 4; j++) {
                    this[`m${i}${j}`] = (i === j) ? 1 : 0;
                }
            }
        }

        setMatrixValue() {}
    };
}

// Runtime settings (appEntry.js injects from settings.json) — test defaults.
if (!window.Settings) {
    window.Settings = {
        edition: 'standard',
        stageColor: '#FFFFFF',
        autoSaveInterval: 0,
        maxPages: 8,
    };
}

// Preload bridge (src/preload.js) — injected at runtime by the Electron
// main process. Async methods resolve with JSON/text payloads.
if (typeof window.scratchjr === 'undefined') {
    window.scratchjr = {
        onAppClose() {},
        sendAppClosedAcked() {},
    };
}

// Electron desktop bridge (electronClient.js) — the window.tablet surface.
// Methods return promises; record/play hooks are void.
if (typeof window.tablet === 'undefined') {
    const bridge = {};
    const asyncNoop = () => Promise.resolve('');
    const voidNoop = () => {};
    const bridgeMethods = {
        io_getmedialen: () => Promise.resolve(0),
        io_setmedia: asyncNoop, io_setmedianame: asyncNoop, io_getmd5: asyncNoop,
        io_remove: asyncNoop, io_cleanassets: asyncNoop, io_registersound: asyncNoop,
        io_getfile: asyncNoop, io_gettextresource: asyncNoop, io_setfile: asyncNoop,
        getAudioCaptureElement: asyncNoop, io_playsound: voidNoop, io_stopsound: voidNoop,
        recordsound_recordstart: voidNoop, recordsound_recordstop: voidNoop,
        recordsound_volume: () => 0, recordsound_recordclose: voidNoop,
        recordsound_startplay: voidNoop, recordsound_stopplay: voidNoop,
        askForPermission: voidNoop, hideSplash: voidNoop, deviceName: () => 'test',
        analyticsEvent: voidNoop, scratchjr_stopfeed: voidNoop,
        scratchjr_choosecamera: voidNoop, scratchjr_captureimage: voidNoop,
        scratchjr_cameracheck: () => null, scratchjr_startfeed: voidNoop,
    };
    for (const [k, v] of Object.entries(bridgeMethods)) {
        bridge[k] = v;
    }
    window.tablet = bridge;
}

// jsdom images never finish loading (onload never fires); force `complete`
// so synchronous draw paths execute (Block.drawBlock -> drawBlockType).
if (typeof HTMLImageElement !== 'undefined') {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { get: () => true, configurable: true });
}

// 2D canvas context: jsdom's getContext returns null without the canvas
// npm package. Return a no-op context where measureText reports a fixed
// width so layout math stays finite.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.__scratchjrPatched) {
    const ctxTarget = {};
    const measureText = () => ({ width: 10, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 5 });
    const ctxStub = new Proxy(ctxTarget, {
        get(target, prop) {
            if (prop === 'measureText') return measureText;
            if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
            if (prop === 'createPattern') return () => ({});
            if (prop === 'canvas') return target.__canvas || null;
            if (typeof prop === 'symbol') return undefined;
            return () => {};
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
    });
    HTMLCanvasElement.prototype.getContext = function getContext() {
        return ctxStub;
    };
    Object.defineProperty(HTMLCanvasElement.prototype, '__scratchjrPatched', { value: true });
}
