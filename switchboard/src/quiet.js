// Runs before anything else is loaded.

// Switchboard uses Node's built-in SQLite (node:sqlite), available without flags from Node 22.13.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Switchboard needs Node.js 22.13 or newer (you have ${process.versions.node}). Download it from https://nodejs.org/`);
  process.exit(1);
}

// Node's built-in SQLite prints an "experimental" warning on load. Hide that one warning
// (and only that one) so the console and the MCP stdio channel stay clean.
const printers = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w?.name === 'ExperimentalWarning' && /SQLite/i.test(w.message)) return;
  for (const print of printers) print(w);
});
