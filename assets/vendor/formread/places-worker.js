/*
 * The place reader's worker (the portal's own file). The page starts it as a module worker from this file:
 *   new Worker(new URL('assets/vendor/formread/places-worker.js', document.baseURI), { type: 'module' })
 *
 * A page that may make no request for data (a hosted preview) has every such request refused, so nothing here asks
 * the network for anything: the runtime, its compiled code and the model all arrive as the portal's own script files,
 * imported from this folder or the portal's origin, and the bytes they carry as text are handed to the runtime from
 * memory. No part of a page picture leaves this worker except the answer posted back to the page.
 *
 * Messages in:  { type: 'start', modelScript }   modelScript: a script of the portal's own origin that sets
 *                                                self.FORMREAD_MODEL_GZ64 (the model, gzip then base64)
 *               { type: 'run', pixels, w, h, id } pixels: Float32Array of w*h grey values 0..1 (row by row)
 *               { type: 'stop' }
 * Messages out: { type: 'ready', threads }
 *               { type: 'maps', data, w, h, classes, id }  data: Float32Array, classes maps of h*w each (transferred)
 *               { type: 'error', code, detail, id }  code: 'load' | 'compile' | 'run'; detail is for the console only
 */
const MAX_SIDE = 4096; // the caller resizes the page picture; a larger one is refused, not run
let session = null;
let starting = null;

const reply = (msg, transfer) => self.postMessage(msg, transfer || []);
const fail = (code, e, id) => reply({ type: 'error', code, detail: String((e && e.message) || e || 'unknown').slice(0, 300), id });

// a failure nothing below catches still ends as an answer, never as a page left waiting
self.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  fail('load', e.reason);
});

/** Text (base64 of gzip) to bytes, decompressed without any request. */
async function unpack(text) {
  let bin;
  if (typeof Uint8Array.fromBase64 === 'function') bin = Uint8Array.fromBase64(text);
  else {
    const s = atob(text);
    bin = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  }
  const out = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** A script of this worker's own origin only. */
function ownScript(name) {
  const u = new URL(String(name || ''), self.location.href);
  if (u.origin !== self.location.origin || !/\.js$/.test(u.pathname)) throw new Error('not one of the portal’s own scripts: ' + u.pathname);
  return u.href;
}

async function start(modelScript) {
  let rt, wasm, model;
  try {
    rt = await import(new URL('runtime.min.js', self.location.href).href);
    await import(new URL('runtime-wasm.js', self.location.href).href);
    await import(ownScript(modelScript));
    if (typeof self.FORMREAD_WASM_GZ64 !== 'string' || !self.FORMREAD_WASM_GZ64) throw new Error('compiled code missing: runtime-wasm.js');
    if (typeof self.FORMREAD_MODEL_GZ64 !== 'string' || !self.FORMREAD_MODEL_GZ64) throw new Error('model missing: ' + modelScript);
    wasm = await unpack(self.FORMREAD_WASM_GZ64);
    model = await unpack(self.FORMREAD_MODEL_GZ64);
    self.FORMREAD_WASM_GZ64 = null; // the text is not kept beside the bytes
    self.FORMREAD_MODEL_GZ64 = null;
  } catch (e) {
    return fail('load', e);
  }
  try {
    const env = rt.env;
    env.logLevel = 'error';
    env.wasm.numThreads = 1;
    env.wasm.proxy = false;
    env.wasm.wasmBinary = wasm; // given as bytes, the runtime looks nothing up by address
    session = await rt.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    self.__formreadTensor = rt.Tensor;
  } catch (e) {
    session = null;
    return fail('compile', e);
  }
  reply({ type: 'ready', threads: rt.env.wasm.numThreads });
}

async function run(m) {
  const id = m.id;
  if (!session) return fail('run', 'not started', id);
  const w = m.w | 0;
  const h = m.h | 0;
  if (!(m.pixels instanceof Float32Array) || w < 16 || h < 16 || w > MAX_SIDE || h > MAX_SIDE || m.pixels.length !== w * h) return fail('run', `a ${w} by ${h} picture of ${m.pixels && m.pixels.length} values`, id);
  try {
    const input = new self.__formreadTensor('float32', m.pixels, [1, 1, h, w]);
    const out = await session.run({ page: input });
    const t = out[session.outputNames[0]];
    const data = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data);
    const [, classes, mh, mw] = t.dims;
    reply({ type: 'maps', data, w: mw, h: mh, classes, id }, [data.buffer]);
  } catch (e) {
    fail('run', e, id);
  }
}

self.addEventListener('message', (ev) => {
  const m = ev.data || {};
  if (m.type === 'start') {
    if (session) return reply({ type: 'ready' });
    if (!starting) starting = start(m.modelScript).finally(() => (starting = null));
    return;
  }
  if (m.type === 'run') return void run(m);
  if (m.type === 'stop') {
    const s = session;
    session = null;
    Promise.resolve(s && s.release && s.release()).catch(() => {}).finally(() => self.close());
  }
});
