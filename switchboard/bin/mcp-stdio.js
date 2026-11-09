#!/usr/bin/env node
// MCP server over stdio, for Claude Desktop and Claude Code.
// If the Switchboard app is already running, this relays to it; otherwise it starts the app
// in this process (so the web UI at http://127.0.0.1:4545 works while Claude is open).
// stdout carries the MCP protocol only; anything else goes to stderr.
import '../src/quiet.js';

console.log = (...a) => console.error(...a);

const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { probe, startApp } = await import('../src/server.js');
const { apiToken, PORT } = await import('../src/config.js');

const running = await probe();
if (running) {
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const upstream = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${PORT}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${apiToken()}` } },
  });
  const local = new StdioServerTransport();
  local.onmessage = (msg) => {
    upstream.send(msg).catch((err) => {
      if (msg.id !== undefined) local.send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `Switchboard is not reachable: ${err.message}` } });
    });
  };
  upstream.onmessage = (msg) => local.send(msg);
  upstream.onerror = (err) => console.error('switchboard relay:', err.message);
  local.onclose = () => process.exit(0);
  await upstream.start();
  await local.start();
} else {
  let app = null;
  try {
    app = await startApp({ quiet: true });
    console.error(`Switchboard started at ${app.url}`);
  } catch (e) {
    console.error(`Could not start the Switchboard web app (${e.message}); serving Claude only.`);
    const { openDb } = await import('../src/db.js');
    openDb();
  }
  const { createMcpServer } = await import('../src/claude/mcp.js');
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  transport.onclose = async () => {
    await app?.stop().catch(() => {});
    process.exit(0);
  };
  process.stdin.on('end', async () => {
    await app?.stop().catch(() => {});
    process.exit(0);
  });
  await server.connect(transport);
}
