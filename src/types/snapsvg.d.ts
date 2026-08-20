// snapsvg ships without type declarations (only Snap.path.isPointInside is used,
// Snap.svg is Apache 2.0 licensed). Local ambient declaration; the `declare module`
// cannot live in a .ts file because the module resolves to an untyped JS file.
declare module 'snapsvg' {
    const Snap: {
        path: {
            isPointInside(d: string, x: number, y: number): boolean;
        };
    };
    export default Snap;
}

// eve is a bare event emitter used by snapsvg; no types shipped.
declare module 'eve' {
    const eve: Record<string, unknown>;
    export default eve;
}

declare namespace globalThis {
    let eve: Record<string, unknown>;
}
