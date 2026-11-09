#!/usr/bin/env node
import '../src/quiet.js';
import { spawn } from 'node:child_process';
import { probe, startApp } from '../src/server.js';
import { DATA_DIR } from '../src/config.js';

const args = new Set(process.argv.slice(2));

function openBrowser(url) {
  if (args.has('--no-open') || process.env.SWITCHBOARD_NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  } catch {}
}

const running = await probe();
if (running) {
  const url = `http://127.0.0.1:${process.env.SWITCHBOARD_PORT || 4545}/`;
  console.log(`Switchboard is already running (pid ${running.pid}): ${url}`);
  openBrowser(url);
  process.exit(0);
}

const app = await startApp();
console.log(`Switchboard is running at ${app.url}`);
console.log(`Data folder: ${DATA_DIR}`);
console.log('Press Ctrl+C to quit.');
openBrowser(app.url);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await app.stop().catch(() => {});
    process.exit(0);
  });
}
