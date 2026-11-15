/*
 * Loads the shared investor-portal core (synced from the web app) into a
 * namespace. The core files are plain scripts that attach to window.CVPortal.
 */
import './setup';
import './brand.js';
import './tenants.js';
import './data.js';
import './nacha.js';

const g = globalThis as unknown as { window: { CVPortal: CoreNS } };

/* eslint-disable @typescript-eslint/no-explicit-any */
export type CoreNS = Record<string, any>;
export const NS: CoreNS = g.window.CVPortal;
