// The core scripts expect a browser-style `window`. React Native provides one;
// this makes sure of it before they load.
const g = globalThis as unknown as { window?: Record<string, unknown> };
if (!g.window) g.window = g as unknown as Record<string, unknown>;
if (!g.window.CVPortal) g.window.CVPortal = {};
export {};
