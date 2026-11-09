import { EventEmitter } from 'node:events';

/** App-wide change notifications; the web UI receives them over /api/events/stream. */
export const events = new EventEmitter();
events.setMaxListeners(100);
