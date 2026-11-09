#!/usr/bin/env node
import '../src/quiet.js';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probe, startApp } from '../src/server.js';
import { DATA_DIR, PORT, HOST, PUBLIC_URL } from '../src/config.js';

const argv = process.argv.slice(2);
const args = new Set(argv);
const here = path.dirname(fileURLToPath(import.meta.url));
const self = path.join(here, 'switchboard.js');

function openBrowser(url) {
  if (args.has('--no-open') || process.env.SWITCHBOARD_NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  } catch {}
}

// `switchboard service install|uninstall|status` — start Switchboard in the background at login.
if (argv[0] === 'service') {
  const action = argv[1] || 'status';
  const home = os.homedir();
  const env = { SWITCHBOARD_NO_OPEN: '1', ...(process.env.SWITCHBOARD_DATA_DIR ? { SWITCHBOARD_DATA_DIR: DATA_DIR } : {}), ...(process.env.SWITCHBOARD_PORT ? { SWITCHBOARD_PORT: String(PORT) } : {}) };
  const run = (cmd, a) => {
    try {
      return execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    } catch (e) {
      return e.stdout?.toString() || e.message;
    }
  };
  if (process.platform === 'darwin') {
    const plist = path.join(home, 'Library/LaunchAgents/com.switchboard.app.plist');
    if (action === 'install') {
      fs.mkdirSync(path.dirname(plist), { recursive: true });
      fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.switchboard.app</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string><string>${self}</string></array>
  <key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k, v]) => `<key>${k}</key><string>${v}</string>`).join('')}</dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${path.join(DATA_DIR, 'switchboard.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(DATA_DIR, 'switchboard.log')}</string>
</dict></plist>
`);
      run('launchctl', ['unload', plist]);
      run('launchctl', ['load', '-w', plist]);
      console.log(`Installed. Switchboard now starts at login: http://127.0.0.1:${PORT}/\n(${plist})`);
    } else if (action === 'uninstall') {
      run('launchctl', ['unload', '-w', plist]);
      fs.rmSync(plist, { force: true });
      console.log('Removed the login item.');
    } else console.log(run('launchctl', ['list', 'com.switchboard.app']));
  } else if (process.platform === 'linux') {
    const unit = path.join(home, '.config/systemd/user/switchboard.service');
    if (action === 'install') {
      fs.mkdirSync(path.dirname(unit), { recursive: true });
      fs.writeFileSync(unit, `[Unit]
Description=Switchboard mail and calendar
After=network-online.target

[Service]
ExecStart=${process.execPath} ${self}
${Object.entries(env).map(([k, v]) => `Environment=${k}=${v}`).join('\n')}
Restart=on-failure

[Install]
WantedBy=default.target
`);
      console.log(run('systemctl', ['--user', 'daemon-reload']) + run('systemctl', ['--user', 'enable', '--now', 'switchboard.service']));
      console.log(`Installed. Switchboard now starts at login: http://127.0.0.1:${PORT}/\n(${unit}; to keep it running when logged out: loginctl enable-linger $USER)`);
    } else if (action === 'uninstall') {
      run('systemctl', ['--user', 'disable', '--now', 'switchboard.service']);
      fs.rmSync(unit, { force: true });
      console.log('Removed the service.');
    } else console.log(run('systemctl', ['--user', 'status', 'switchboard.service', '--no-pager']));
  } else if (process.platform === 'win32') {
    const startup = path.join(process.env.APPDATA || home, 'Microsoft/Windows/Start Menu/Programs/Startup/Switchboard.vbs');
    if (action === 'install') {
      const envSet = Object.entries(env).map(([k, v]) => `env("${k}") = "${v}"`).join('\r\n');
      fs.writeFileSync(startup, `Set sh = CreateObject("WScript.Shell")\r\nSet env = sh.Environment("Process")\r\n${envSet}\r\nsh.Run """${process.execPath}"" ""${self}""", 0, False\r\n`);
      spawn('wscript', [startup], { detached: true, stdio: 'ignore' }).unref();
      console.log(`Installed. Switchboard now starts at sign-in: http://127.0.0.1:${PORT}/\n(${startup})`);
    } else if (action === 'uninstall') {
      fs.rmSync(startup, { force: true });
      console.log('Removed the startup item. Stop the running copy from Task Manager (node.exe) if needed.');
    } else console.log(fs.existsSync(startup) ? `Installed: ${startup}` : 'Not installed.');
  } else {
    console.log('Automatic start is supported on macOS, Linux and Windows.');
  }
  process.exit(0);
}

if (args.has('--help') || args.has('-h')) {
  console.log(`Switchboard — mail and calendar for all your accounts, driven by Claude.

  switchboard                 start (opens your browser)
  switchboard --no-open       start without opening a browser
  switchboard service install start automatically at login (macOS, Linux, Windows)
  switchboard service uninstall

Environment: SWITCHBOARD_PORT, SWITCHBOARD_DATA_DIR, SWITCHBOARD_HOST, SWITCHBOARD_PUBLIC_URL,
SWITCHBOARD_PASSWORD (required when SWITCHBOARD_HOST is not 127.0.0.1). See README.md → Hosting.`);
  process.exit(0);
}

const running = await probe();
if (running) {
  const url = PUBLIC_URL ? `${PUBLIC_URL}/` : `http://127.0.0.1:${PORT}/`;
  console.log(`Switchboard is already running (pid ${running.pid}): ${url}`);
  openBrowser(url);
  process.exit(0);
}

let app;
try {
  app = await startApp();
} catch (e) {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use. Set SWITCHBOARD_PORT to another port.` : e.message);
  process.exit(1);
}
console.log(`Switchboard is running at ${app.url}${HOST !== '127.0.0.1' ? ` (listening on ${HOST}:${PORT}, password required)` : ''}`);
console.log(`Data folder: ${DATA_DIR}`);
console.log('Press Ctrl+C to quit.');
openBrowser(app.url);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await app.stop().catch(() => {});
    process.exit(0);
  });
}
