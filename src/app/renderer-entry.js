// Renderer entry point wrapper.
// Injects eve as a global (required by snapsvg) before loading the app.
import eve from 'eve';
globalThis.eve = eve;

// Re-export the actual app entry
export * from './appEntry.js';
