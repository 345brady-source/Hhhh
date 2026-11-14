/*
 * The engine that recognises words on a picture, started from the portal's own files with no request.
 *
 * A hosted preview refuses every request a page makes for data, so nothing here asks the network for anything: the
 * engine's script is loaded by a script element, its worker is started from one of the portal's own files
 * (assets/vendor/textread/textread-boot.js), and its language data reaches that worker as a script it imports.
 *
 *   NS.textengine.start()                  starts the engine once; resolves when it is ready to read. Rejects with an
 *                                          Error whose code is 'load', within 20 seconds, carrying
 *                                            why     'worker'   the page was not allowed to start the worker
 *                                                    'compile'  the worker started but its code could not be prepared for running
 *                                                    'file'     one of the reader's own files could not be loaded
 *                                                    'time'     no answer in time
 *                                            detail  the engine's own words: for the console only, never for a screen
 *                                          A failed start is forgotten and its worker ended, so a later start tries again.
 *   NS.textengine.read(canvas, mode, ms)   reads one strip: mode 'line' as one line of text, 'block' as one block.
 *                                          Resolves with the blocks of the result (paragraphs, lines, words with their
 *                                          boxes); a strip with nothing printed on it resolves with none, and the
 *                                          engine is not asked. Rejects with code 'time' after ms (8 seconds when not given), and the
 *                                          engine is stopped so that the next read starts it afresh; with code 'fail'
 *                                          for any other failure; with code 'load' when the engine cannot start.
 *                                          A strip asked for while the first worker is still reading goes to a second
 *                                          worker, started the first time this happens; one strip at a time never starts it.
 *   NS.textengine.stop()                   ends the workers there are
 *
 * Nothing here places a field or decides anything about a page; it only reads what it is handed.
 */
(function (NS) {
  'use strict';
  const DIR = 'assets/vendor/textread/';
  const LOAD_MS = 20000;
  const STRIP_MS = 8000;
  const MODES = { line: '7', block: '6' }; // the engine's page modes: one text line, one block of text
  const INK = 48; // the least difference between light and dark (of 255) for a strip to have anything printed on it
  const SAID = { load: 'the text reader could not start', time: 'the text reader took too long', fail: 'the text could not be read' };
  const here = (f) => new URL(DIR + f, document.baseURI).href;
  const words = (e) => String((e && e.message) || e || '').slice(0, 500);
  const fail = (code, detail, more) => Object.assign(new Error(SAID[code]), { code, detail: words(detail) }, more || {});

  // Two workers at most. The first is started by start(); the second only when a strip is asked for while the first
  // is still reading one (a caller that reads one strip at a time never starts it). Each takes its reads one after
  // another; a read goes to the worker with fewer reads waiting.
  const WORKERS = 2;
  const slots = [];
  for (let i = 0; i < WORKERS; i++) slots.push({ engine: null, paged: null, turn: Promise.resolve(), pending: 0, ready: false });

  function script(src) {
    return new Promise((ok, no) => {
      if (window.Tesseract) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (window.Tesseract ? ok() : no(new Error('did not start: ' + src)));
      s.onerror = () => (s.remove(), no(new Error('could not be loaded: ' + src)));
      document.head.appendChild(s);
    });
  }

  /** The class of a failed start, from what the browser or the engine said and whether the worker had answered yet. */
  function classify(e, spoke) {
    const t = words(e);
    if (e && e.name === 'SecurityError') return 'worker';
    if (/compil|instantiat|webassembly|unsafe-eval/i.test(t)) return 'compile';
    if (!spoke && /security|origin|sandbox|not allowed|denied|cannot be accessed/i.test(t)) return 'worker';
    if (/importscripts|failed to load|could not be loaded|did not start|network ?error|missing|not found/i.test(t)) return 'file';
    return /\.(js|wasm)\b|\/\/[^\s/]+\//i.test(t) ? 'file' : 'worker';
  }

  /**
   * Runs make() and keeps the worker made meanwhile in run.born, watched from its first moment. The engine hands its
   * worker over only once it has started, so without this a start that fails would leave a worker running that
   * nothing can end, and a failure the engine does not report would never be heard.
   */
  function keeping(run, make, watch) {
    const Real = window.Worker;
    const Kept = function (address, options) {
      run.born = new Real(address, options);
      watch(run.born);
      return run.born;
    };
    Kept.prototype = Real.prototype;
    window.Worker = Kept;
    try {
      return make();
    } finally {
      window.Worker = Real;
    }
  }

  /** The engine, started once (every file comes from the portal's own folder; no request is made). */
  function start() {
    return startSlot(slots[0]);
  }
  function startSlot(slot) {
    if (slot.engine) return slot.engine;
    const run = { born: null, spoke: false, said: '', over: false, refused: false };
    // the browser says on the page, not on the worker, that its policy refused to let a worker start
    const policy = (e) => {
      if (/worker-src|child-src|script-src|default-src/.test(String(e.effectiveDirective || e.violatedDirective)) && /textread-boot\.js/.test(String(e.blockedURI))) run.refused = true;
    };
    document.addEventListener('securitypolicyviolation', policy);
    const p = new Promise((ok, no) => {
      const clock = setTimeout(() => no({ why: 'time', detail: 'no answer within ' + LOAD_MS / 1000 + ' s' + (run.said ? '; last said: ' + run.said : '') }), LOAD_MS);
      const bad = (why) => (e) => (clearTimeout(clock), no({ why: why || classify(e, run.spoke), detail: words(e) }));
      const watch = (born) => {
        // what the worker's first file tells of a failure in the start that nothing caught
        born.addEventListener('message', (m) => {
          if (!m.data || m.data.status !== 'failed') return;
          run.said = words(m.data.data);
          if (!run.over) bad()(m.data.data);
        });
        // an error of the worker itself is taken here and not thrown at the page. With no words it means the
        // worker's first file never ran: refused by the page's policy, or not loaded.
        born.addEventListener('error', (e) => {
          e.preventDefault();
          if (run.over) return;
          if (e.message) bad()(e.message);
          else bad(run.refused ? 'worker' : 'file')((run.refused ? 'refused by the policy: ' : 'could not be loaded: ') + here('textread-boot.js'));
        });
      };
      script(here('textread.min.js')).then(() => {
        const options = {
          workerPath: here('textread-boot.js'),
          workerBlobURL: false,
          corePath: here('textread-core.wasm.js'),
          langPath: here('').replace(/\/$/, ''),
          cacheMethod: 'none',
          gzip: true,
          logger: () => {
            run.spoke = true;
          },
          // The engine reports some failures of its start only here and then never answers: they end the start at once.
          errorHandler: (e) => {
            run.said = words(e);
            if (!run.over) bad()(e);
          }
        };
        // an engine that answers after its start was given up is ended, never kept
        return keeping(run, () => window.Tesseract.createWorker('eng', 1, options), watch).then((w) => (run.over ? end(w) : (clearTimeout(clock), ok(w))), bad());
      }, bad('file')).catch(bad());
    }).then(
      (w) => {
        run.over = true;
        document.removeEventListener('securitypolicyviolation', policy);
        if (slot.engine === p) slot.ready = true;
        return w;
      },
      (e) => {
        run.over = true;
        document.removeEventListener('securitypolicyviolation', policy);
        if (slot.engine === p) (slot.engine = null), (slot.ready = false);
        if (run.born) end(run.born);
        throw fail('load', e.detail, { why: e.why });
      }
    );
    slot.engine = p;
    slot.paged = null;
    return p;
  }

  function end(w) {
    try {
      Promise.resolve(w.terminate()).catch(() => {});
    } catch (e) {
      /* already ended */
    }
  }

  function stopSlot(slot) {
    const p = slot.engine;
    slot.engine = null;
    slot.paged = null;
    slot.ready = false;
    if (p) p.then(end, () => {});
  }
  function stop() {
    slots.forEach(stopSlot);
  }

  /**
   * True when nothing is printed on the strip: its lightest and its darkest point are nearly alike (seen on white
   * where it is see-through). Asked to read such a strip as a line, the engine makes a word up; so it is never asked.
   * A strip that cannot be looked at is not called blank.
   */
  function blank(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return true;
    try {
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let lo = 255;
      let hi = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = 255 - (((255 - ((d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8)) * d[i + 3]) >> 8);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        if (hi - lo >= INK) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function once(slot, canvas, mode, ms) {
    const psm = MODES[mode] || MODES.line;
    if (blank(canvas)) return Promise.resolve([]);
    return startSlot(slot).then((w) => {
      const mine = slot.engine;
      // A strip is dark print on light paper (its contrast is stretched so): the engine's second try of every unsure
      // word as white on black is never needed, and it costs as much again as the first.
      const job = (psm === slot.paged ? Promise.resolve() : w.setParameters({ tessedit_pageseg_mode: psm, tessedit_do_invert: '0' }).then(() => void (slot.paged = psm))).then(() =>
        w.recognize(canvas, {}, { blocks: true, text: false })
      );
      return new Promise((ok, no) => {
        const clock = setTimeout(() => {
          if (slot.engine === mine) stopSlot(slot);
          no(fail('time', 'no answer within ' + (ms || STRIP_MS) + ' ms'));
        }, ms || STRIP_MS);
        job.then(
          (r) => (clearTimeout(clock), ok((r && r.data && r.data.blocks) || [])),
          (e) => (clearTimeout(clock), no(fail('fail', e)))
        );
      });
    });
  }

  /**
   * One strip read as a line or as a block. Each worker takes its reads in the order they were asked for; a strip asked
   * for while the first worker is busy goes to the second once it has started (and starts it, the first time).
   */
  function read(canvas, mode, ms) {
    let slot = slots[0];
    if (slot.pending > 0 && slots[0].ready) {
      const other = slots.slice(1).find((q) => q.ready && q.pending < slot.pending);
      if (other) slot = other;
      else slots.slice(1).forEach((q) => q.engine || startSlot(q).catch(() => {}));
    }
    slot.pending++;
    const mine = slot.turn.then(() => once(slot, canvas, mode, ms));
    const done = () => void slot.pending--;
    slot.turn = mine.then(done, done);
    return mine;
  }

  NS.textengine = { start, read, stop };
})(window.CVPortal);
