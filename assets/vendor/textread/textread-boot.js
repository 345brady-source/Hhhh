/*
 * The first file of the text reader's worker (the portal's own; the reader's own files beside it are unchanged).
 *
 * The reader asks for its language data by address. A page that may make no request of its own (a hosted preview)
 * has every such request refused, so the data arrives here as a script instead: language-data.js holds the same bytes
 * as text, this file turns the text back into bytes, and answers the reader's one request for them from memory.
 * Every other request goes on unchanged. Nothing here asks the network for anything.
 */
// A failure in the reader's start that nothing in it catches (its code refused by the host, say) would be written to
// this worker's console only, and the page would wait for an answer that never comes: the page is told instead.
self.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  self.postMessage({ status: 'failed', data: String((e.reason && e.reason.message) || e.reason || 'a failure nothing caught').slice(0, 500) });
});
importScripts('language-data.js');
(() => {
  if (typeof self.__textreadEng !== 'string' || !self.__textreadEng) throw new Error('language data missing: language-data.js');
  const text = atob(self.__textreadEng);
  self.__textreadEng = null; // the text is not kept beside the bytes
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const ask = self.fetch;
  self.fetch = (address, options) => (/eng\.traineddata/.test(String(address && address.url ? address.url : address)) ? Promise.resolve(new Response(bytes)) : ask.call(self, address, options));
})();
importScripts('textread-worker.min.js');
