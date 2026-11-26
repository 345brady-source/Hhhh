// gate: node
// last "INDEPENDENT READER: PASS (cases run: 6)"
// The independent NACHA reader's own proof (plan 16-01, no browser): checks/achcli.sh gives the pinned moov-io/ach
// achcli v1.69.1 and nothing else; it accepts files the portal's builder makes (PPD+CCD, balanced, same-day), refuses a
// file with a wrong field or a short record, masks what it prints, and cannot be skipped into a pass. Fixture files use
// only never-issued routing numbers (lib16 NEVER) and account numbers starting 99; a file's text is never printed.
//   node reader.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "INDEPENDENT READER: PASS (cases run: N)" or
// "INDEPENDENT READER: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib16.js');

const HASH = 'h1:v+nHTd9qN4vYBmp+4mRf+8E/yztxoxxUtgMxgTGGtbo=';
const TODAY = '2026-12-01';
const NOW = new Date(2026, 11, 1, 10, 0);
const EFFECTIVE = '2026-12-03';
const NAME = 'INDEPENDENT READER';

/** The three fixture files: credits only (PPD and CCD), balanced with an offset, and same-day. */
function files(NS) {
  return {
    ppdccd: L.achFile(NS, { effectiveDate: EFFECTIVE, now: NOW }),
    balanced: L.achFile(NS, { effectiveDate: EFFECTIVE, now: NOW, balanced: true }),
    sameday: L.achFile(NS, { effectiveDate: TODAY, now: NOW })
  };
}
/** This check run again in a child process, with the environment given; its output and exit code. */
function child(args, env) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-reader16-out-'));
  try {
    const r = spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, { GATE_FRESH: '1', P6_OUT: out }, env) });
    return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}
const lastLine = (s) => s.trim().split('\n').pop();

const parts = {
  // achcli.sh gives a binary and its module line is the pinned version and hash.
  async pinned({ check }) {
    const p = spawnSync('bash', [L.ACHCLI_SH, '--path'], { encoding: 'utf8' });
    check('achcli.sh --path exits 0 with the path of a binary', p.status === 0 && fs.existsSync(String(p.stdout).trim()), String(p.stdout).trim());
    const m = spawnSync('bash', [L.ACHCLI_SH, '--mod-line'], { encoding: 'utf8' });
    const f = String(m.stdout).replace(/\n$/, '').split('\t');
    check(`achcli.sh --mod-line is mod github.com/moov-io/ach v1.69.1 ${HASH}`, m.status === 0 && f[1] === 'mod' && f[2] === 'github.com/moov-io/ach' && f[3] === 'v1.69.1' && f[4] === HASH, String(m.stdout).trim());
  },

  // Files the portal's builder makes pass -validate-file and -validate-totals.
  async valid({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const F = files(NS);
    const desc = { ppdccd: 'a PPD and CCD credit file', balanced: `a balanced file (offset to the originating bank, an account starting 99)`, sameday: 'a same-day file (effective today)' };
    Object.keys(F).forEach((k) => {
      const f = F[k];
      const own = f.checks.filter((c) => !c.ok).map((c) => c.label);
      check(`${desc[k]}: the builder's own checks pass`, own.length === 0, own);
      const v = L.validate(f.text);
      check(`${desc[k]} passes the independent reader`, v.ok, v.out);
    });
    check('the PPD and CCD file has two batches (PPD, CCD); the balanced one debits what it credits', F.ppdccd.batches.map((b) => b.sec).join(',') === 'PPD,CCD' && F.balanced.totals.debit === F.balanced.totals.credit && F.balanced.totals.debit > 0);
  },

  // A wrong field and a short record are refused, with the reader's own message.
  async refused({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const f = files(NS).ppdccd;
    const lines = f.text.split('\r\n');
    const lower = lines.slice();
    lower[0] = lower[0].slice(0, 33) + 'a' + lower[0].slice(34);
    const v1 = L.validate(lower.join('\r\n'));
    check('the file ID modifier (position 34) set to a lower-case letter is refused, and the message names FileIDModifier', !v1.ok && /FileIDModifier/i.test(v1.out), v1.out);
    const short = lines.slice();
    const at = short.findIndex((l) => l[0] === '6');
    short[at] = short[at].slice(0, 93);
    const v2 = L.validate(short.join('\r\n'));
    check('an entry record cut to 93 characters is refused', at > 0 && !v2.ok, v2.out);
    check("the reader's messages hold no full routing or account number", L.leaks(v1.out + v2.out).length === 0 && !/99\d{6,}/.test(v1.out + v2.out), `${L.leaks(v1.out + v2.out).length} found`);
  },

  // The only file summary a check prints is the reader's masked one: no fixture account number in full.
  async mask({ check }) {
    const NS = L.loadPortal(undefined, { today: TODAY });
    const f = files(NS).balanced;
    const m = L.masked(f.text);
    check('the masked summary is not empty and names the batches', m.trim().length > 0 && /PPD/.test(m) && /CCD/.test(m), m.length);
    const accounts = [1, 2, 3, 9].map(L.account);
    const shown = accounts.filter((a) => m.indexOf(a) >= 0);
    check('the masked summary holds no fixture account number in full', shown.length === 0, `${shown.length} shown`);
    check('leaks() finds nothing in the masked summary', L.leaks(m).length === 0, `${L.leaks(m).length} found`);
  },

  // Without the reader the check fails with the SKIP line: never PASS.
  async noreader({ check }) {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-reader16-home-'));
    try {
      const r = child(['--case', 'valid'], { ACHCLI: '/nonexistent', ACHCLI_HOME: empty, PATH: '/usr/bin:/bin' });
      const last = lastLine(r.out);
      check('a run of --case valid without the reader exits non-zero', r.status !== 0, r.status);
      check(`its last line is "${NAME}: FAIL (cases run: 1) - valid"`, last === `${NAME}: FAIL (cases run: 1) - valid`, last);
      check('it names the SKIP sentence ("SKIP independent reader: ...")', /^FAIL .*SKIP independent reader: /m.test(r.out), r.out.split('\n').slice(0, 3).join(' | '));
      check('it prints no PASS line for the reader and no passing last line', !/^PASS valid .*passes the independent reader/m.test(r.out) && !/: PASS \(cases run/.test(r.out));
      check('nothing was installed into the empty folder', fs.readdirSync(empty).length === 0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  },

  // The case runner itself: an unknown case name and an empty list each fail.
  async selfcheck({ check }) {
    const u = child(['--case', 'nosuchcase'], {});
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nosuchcase/m.test(u.out) && lastLine(u.out).indexOf(`${NAME}: FAIL`) === 0, lastLine(u.out));
    const e = child(['--case', ''], {});
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.out) && lastLine(e.out).indexOf(`${NAME}: FAIL`) === 0, lastLine(e.out));
  }
};

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
