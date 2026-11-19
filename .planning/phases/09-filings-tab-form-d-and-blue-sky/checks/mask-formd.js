// gate: none
// Masks filed Form D notices so they can be stored as fixtures: the structure of each file is kept, and every text
// value that could say who filed it is replaced by a member of the fixed masking set below.
//   node mask-formd.js <folder of original files> <output folder> <file for the list of replaced values>
// The originals are files named NN-D.xml and NN-DA.xml. The output is real-01-D.xml ... in the originals' order, and
// STRUCTURE.txt (each file's element count and the SHA-256 of its element names in order, which the check compares).
// The list of replaced values is the independent proof's input (no line of it may be found in the output). It must be
// outside the repository, and this tool refuses any other place. No original value is ever printed.
//
// What is kept, and only in the element named: a word from the schema's own choice lists, true and false; a whole
// number in an amount or count element; a date in a date element; the four-digit year of formation; a state or country
// code (never its written-out name: a city can share it); the schema version; None, All States and Indefinite where the
// schema puts them. Everything else is replaced, whatever element it is in.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCHEMA = path.join(ROOT, 'server/test/fixtures/formd/schema');
const nn = (n) => String(n).padStart(2, '0');

// The masking set. Each member is numbered, so two different people (or addresses, or entities) stay different.
const MASKS = {
  given: (n) => `Given${nn(n)}`,
  middle: (n) => `Middle${nn(n)}`,
  family: (n) => `Family${nn(n)}`,
  entity: (n) => `Masked Entity ${nn(n)}`,
  signer: (n) => `Masked Signer ${nn(n)}`,
  street: (n) => `${nn(n)} Masked Street`,
  suite: (n) => `Suite ${nn(n)}`,
  city: (n) => `Masked City ${nn(n)}`,
  zip: (n) => `000${nn(n)}`,
  phone: (n) => `(555) 010-0${String(n).padStart(3, '0')}`,
  email: (n) => `masked${nn(n)}@example.com`,
  cik: (n) => `90000000${nn(n)}`,
  accession: (n) => `9000000000-00-000${String(n).padStart(3, '0')}`,
  crd: (n) => `9000${nn(n)}`,
  text: (n) => `Masked text ${nn(n)}`
};
// which member replaces which element; any element not named here is replaced as free text
const KIND = {
  firstName: 'given',
  middleName: 'middle',
  lastName: 'family',
  entityName: 'entity',
  issuerName: 'entity',
  previousName: 'entity',
  recipientName: 'entity',
  associatedBDName: 'entity',
  signatureName: 'signer',
  nameOfSigner: 'signer',
  contactName: 'signer',
  street1: 'street',
  street2: 'suite',
  city: 'city',
  zipCode: 'zip',
  issuerPhoneNumber: 'phone',
  contactPhoneNumber: 'phone',
  contactEmailAddress: 'email',
  notificationEmailAddress: 'email',
  cik: 'cik',
  previousAccessionNumber: 'accession',
  recipientCRDNumber: 'crd',
  associatedBDCRDNumber: 'crd'
};

const read = (f) => fs.readFileSync(path.join(SCHEMA, f), 'utf8');
const enums = (xsd) => Array.from(xsd.matchAll(/<xs:enumeration value="([^"]*)"\/>/g)).map((m) => m[1]);
const WORDS = new Set(['true', 'false'].concat(enums(read('formDSubmission.xsd.xml'))));
const CODES = new Set(enums(read('formDStateCodes.xsd.xml')));
const STATES = new Set(enums(read('statesOfSolicitationCodes.xsd.xml')));
const NUMBER = /^[0-9]+$/;
const DATE = /^\d{4}-\d\d-\d\d$/;
// what may stay, by element (a parent/element name wins over the element name alone)
const KEEP = {
  schemaVersion: (v) => /^X\d{4}$/.test(v),
  submissionType: (v) => v === 'D' || v === 'D/A',
  testOrLive: (v) => v === 'LIVE' || v === 'TEST',
  stateOrCountry: (v) => CODES.has(v),
  state: (v) => STATES.has(v),
  'yearOfInc/value': (v) => /^2\d\d\d$/.test(v),
  'dateOfFirstSale/value': (v) => DATE.test(v),
  'statesOfSolicitationList/value': (v) => v === 'All States',
  signatureDate: (v) => DATE.test(v),
  minimumInvestmentAccepted: (v) => NUMBER.test(v),
  totalOfferingAmount: (v) => NUMBER.test(v) || v === 'Indefinite',
  totalAmountSold: (v) => NUMBER.test(v),
  totalRemaining: (v) => NUMBER.test(v) || v === 'Indefinite',
  numberNonAccreditedInvestors: (v) => NUMBER.test(v),
  totalNumberAlreadyInvested: (v) => NUMBER.test(v),
  dollarAmount: (v) => NUMBER.test(v)
};
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m, n) => NAMED[n]).replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#([0-9]+);/g, (m, d) => String.fromCodePoint(Number(d)));

/** One file's text → { text, tags, replaced: [original values], kept, masked }. Throws when the file is not plain elements and text. */
function mask(text) {
  const decl = /^<\?xml version="1\.0"( encoding="[A-Za-z0-9-]+")?\?>\s*/.exec(text);
  const body = decl ? text.slice(decl[0].length) : text;
  if (/<\?|<!/.test(body)) throw new Error('it holds a comment, a declaration or an instruction');
  const tokens = body.match(/<[^>]*>|[^<]+/g) || [];
  if (tokens.some((t) => t.charAt(0) === '<' && !/^<\/?[A-Za-z0-9]+>$/.test(t))) throw new Error('it holds an attribute or an element that closes itself');
  const numbers = {};
  const number = (kind, original) => {
    const m = (numbers[kind] = numbers[kind] || new Map());
    const key = decode(original).toLowerCase().replace(/\s+/g, ' ');
    if (!m.has(key)) m.set(key, m.size + 1);
    return MASKS[kind](m.get(key));
  };
  const stack = [];
  const tags = [];
  const replaced = [];
  const out = [];
  let kept = 0;
  let masked = 0;
  let last = '';
  tokens.forEach((t, i) => {
    if (t.charAt(0) !== '<') {
      const leaf = last === 'open' && tokens[i + 1] === `</${stack[stack.length - 1]}>`;
      if (!leaf) {
        if (t.trim() !== '') throw new Error('it holds text beside elements');
        out.push(t);
        return;
      }
      const name = stack[stack.length - 1];
      const v = t.trim();
      const keep = KEEP[`${stack[stack.length - 2]}/${name}`] || KEEP[name];
      if (v === '') out.push('');
      else if (WORDS.has(v) || (keep && keep(v))) {
        kept++;
        out.push(v);
      } else {
        masked++;
        replaced.push(v);
        if (decode(v) !== v) replaced.push(decode(v));
        out.push(number(KIND[name] || 'text', v));
      }
      return;
    }
    if (t.charAt(1) === '/') {
      if (stack.pop() !== t.slice(2, -1)) throw new Error('an element is closed by another name');
      last = 'close';
    } else {
      stack.push(t.slice(1, -1));
      tags.push(t.slice(1, -1));
      last = 'open';
    }
    out.push(t);
  });
  if (stack.length) throw new Error('it stops before it ends');
  return { text: '<?xml version="1.0"?>\n' + out.join(''), tags, replaced, kept, masked };
}

if (require.main === module) {
  const [from, to, listFile] = process.argv.slice(2).map((a) => path.resolve(a));
  const stop = (why) => {
    console.log(`MASK FORMD: FAIL - ${why}`);
    process.exit(1);
  };
  if (!from || !to || !listFile) stop('usage: node mask-formd.js <folder of original files> <output folder> <file for the list of replaced values>');
  if ((listFile + path.sep).startsWith(ROOT + path.sep) || (from + path.sep).startsWith(ROOT + path.sep)) stop('the originals and the list of replaced values must stay outside the repository');
  const files = fs.readdirSync(from).filter((f) => /^\d+-(D|DA)\.xml$/.test(f)).sort();
  if (!files.length) stop('no NN-D.xml or NN-DA.xml file in the folder of originals');
  fs.mkdirSync(to, { recursive: true });
  const all = new Set();
  const structure = [];
  files.forEach((f, i) => {
    const name = `real-${nn(i + 1)}-${/-DA\.xml$/.test(f) ? 'DA' : 'D'}.xml`;
    let r;
    try {
      r = mask(fs.readFileSync(path.join(from, f), 'utf8'));
    } catch (e) {
      stop(`original ${i + 1} of ${files.length} was not masked: ${e.message}`);
    }
    const again = (r.text.match(/<[A-Za-z0-9]+>/g) || []).map((t) => t.slice(1, -1));
    if (again.length !== r.tags.length || again.join('\n') !== r.tags.join('\n')) stop(`original ${i + 1}: the masked file's elements differ from the original's`);
    // one value a line; a value that runs over several lines is listed line by line
    r.replaced.forEach((v) =>
      v
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => Array.from(l).length >= 4)
        .forEach((l) => all.add(l))
    );
    fs.writeFileSync(path.join(to, name), r.text);
    structure.push(`${crypto.createHash('sha256').update(r.tags.join('\n')).digest('hex')}  ${r.tags.length}  ${name}`);
    console.log(`${name}: elements before ${r.tags.length}, after ${again.length}, equal; values replaced ${r.masked}, kept ${r.kept}`);
  });
  fs.writeFileSync(path.join(to, 'STRUCTURE.txt'), structure.join('\n') + '\n');
  fs.writeFileSync(listFile, Array.from(all).join('\n') + '\n');
  console.log(`MASK FORMD: ${files.length} files masked; ${all.size} replaced values of four or more characters listed outside the repository`);
}
module.exports = { mask, MASKS };
