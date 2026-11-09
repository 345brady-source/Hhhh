// A stand-in for the Claude Messages API used to test the in-app assistant's agent loop
// without network access. It streams the same server-sent events the real API sends.
import http from 'node:http';

function sse(res, events) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  for (const [type, data] of events) res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.end();
}

let n = 0;
function message(blocks, stopReason) {
  const id = `msg_test_${++n}`;
  const events = [['message_start', { message: { id, type: 'message', role: 'assistant', content: [], model: 'claude-opus-5-5', stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }]];
  blocks.forEach((b, index) => {
    if (b.type === 'thinking') {
      events.push(['content_block_start', { index, content_block: { type: 'thinking', thinking: '', signature: '' } }]);
      events.push(['content_block_delta', { index, delta: { type: 'thinking_delta', thinking: b.thinking } }]);
      events.push(['content_block_delta', { index, delta: { type: 'signature_delta', signature: 'sig' } }]);
    } else if (b.type === 'text') {
      events.push(['content_block_start', { index, content_block: { type: 'text', text: '' } }]);
      for (const piece of b.text.match(/.{1,12}/gs)) events.push(['content_block_delta', { index, delta: { type: 'text_delta', text: piece } }]);
    } else if (b.type === 'tool_use') {
      events.push(['content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }]);
      const json = JSON.stringify(b.input);
      for (let i = 0; i < json.length; i += 20) events.push(['content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 20) } }]);
    }
    events.push(['content_block_stop', { index }]);
  });
  events.push(['message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 42 } }]);
  events.push(['message_stop', {}]);
  return events;
}

/** script(requestBody) returns { blocks, stop } for each turn. */
export function startFakeAnthropic(script, port = 0) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = body ? JSON.parse(body) : {};
      requests.push({ url: req.url, headers: req.headers, body: json });
      if (!req.url.startsWith('/v1/messages')) {
        res.writeHead(404);
        return res.end('{}');
      }
      const turn = script(json, requests.length);
      if (!json.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: 'msg_x', type: 'message', role: 'assistant', model: json.model, content: turn.blocks, stop_reason: turn.stop, usage: { input_tokens: 1, output_tokens: 1 } }));
      }
      sse(res, message(turn.blocks, turn.stop));
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise((r) => server.close(r)) })));
}
