/*
 * What the three scorers share (scratch: not in the repository). Hashed with the scorers: see measure.js.
 *
 *   need(what, file)        a missing document, answer sheet or helper: one line beginning NOT RUN, exit 3
 *   nl(text)                a label as compared: bracketed parts dropped, lower case, letters and digits only
 *   labelOk(place, field)   the label rule (D-06)
 *   hideBars(P)             hides everything fixed to the window before a page is shot, so a picture shows the whole page
 *   contactSheets(dir, n)   contact-NN.png sheets of n pages each, from the compare pictures of dir
 *   writeMeasure(dir, o)    measure.json: what measure.js reads
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function notRun(why) {
  console.log('NOT RUN ' + why);
  process.exit(3);
}
function need(what, file) {
  if (!file || !fs.existsSync(file)) notRun(`${what} is missing: ${file ? path.basename(file) : '(none)'}`);
  return file;
}
const nl = (t) => String(t || '').replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// The portal's standard word for each kind (what the editor shows when the reader gives a field no words of its own).
const STANDARD = { signature: 'Signature', initials: 'Initials', date: 'Date signed', name: 'Name', title: 'Title', nameTitle: 'Name and title', investorName: 'Investor name', amount: 'Commitment amount', address: 'Address', city: 'City', state: 'State', zip: 'ZIP code', cityStateZip: 'City, state and ZIP', email: 'Email', phone: 'Phone', taxId: 'Taxpayer ID' };
// A printed label that says no more than its kind: only then may a field carry the portal's standard word instead.
// The scorers' own list, made without looking at the reader's.
const PLAIN = {
  signature: ['by', 'signature', 'sign', 'sign here', 'signed'],
  initials: ['initials', 'initial', 'initial here'],
  date: ['date', 'dated', 'date signed'],
  name: ['name', 'print name', 'printed name', 'name printed', 'print or type name', 'name print'],
  title: ['title'],
  nameTitle: ['name and title', 'name title'],
  investorName: ['investor name', 'name of investor', 'subscriber name', 'name of subscriber', 'investor', 'subscriber'],
  amount: ['amount', 'subscription amount', 'commitment amount', 'investment amount', 'purchase amount'],
  address: ['address', 'mailing address', 'street address', 'home address', 'residence address'],
  city: ['city'],
  state: ['state'],
  zip: ['zip', 'zip code', 'postal code', 'zip postal code'],
  cityStateZip: ['city state zip', 'city state and zip', 'city state zip code', 'city state and zip code'],
  email: ['email', 'e mail', 'email address', 'e mail address'],
  phone: ['phone', 'phone number', 'telephone', 'telephone number', 'tel'],
  taxId: ['taxpayer id', 'tax id', 'tax id number', 'taxpayer id number', 'taxpayer identification number', 'social security number', 'ssn', 'ein', 'tin']
};
/**
 * The label rule (D-06). A field's label is the place's printed label (or one of the sheet's other readings of the same
 * printed words); or, where that printed label is the plain word of the field's kind, the portal's standard word for
 * that kind. field: { label, kind (the editor's kind), fine (the reader's own kind word, when known) }.
 */
function labelOk(place, field) {
  const printed = [place.printed_label].concat(place.printed_label_also_ok || []).map(nl).filter(Boolean);
  if (!printed.length) return true;
  const got = nl(field.label);
  if (printed.includes(got)) return true;
  return [field.fine, field.kind].filter(Boolean).some((k) => PLAIN[k] && STANDARD[k] && printed.some((p) => PLAIN[k].includes(p)) && nl(STANDARD[k]) === got);
}

/**
 * For the pictures only (called after every field has been read): everything fixed to the window (the portal's bottom
 * bar, toasts) is hidden, and the clip of the pane the editor's pages scroll in is lifted, so that a picture of a page
 * shows the whole page. Without this the foot of every page, about a tenth of it, is cut off by the pane and the
 * picture shows the window behind it instead. The pages themselves are not touched.
 */
async function hideBars(P) {
  return P.evaluate(() => {
    let n = 0;
    document.querySelectorAll('body *').forEach((e) => {
      if (getComputedStyle(e).position !== 'fixed') return;
      if (e.querySelector('.fe-doc') || e.closest('.fe-doc')) return;
      e.style.setProperty('visibility', 'hidden', 'important');
      n++;
    });
    let a = document.querySelector('.fe-doc');
    while (a && a !== document.documentElement) {
      const cs = getComputedStyle(a);
      if (/auto|scroll|hidden|clip/.test(cs.overflowY + cs.overflowX) || a === document.body) {
        a.style.setProperty('overflow', 'visible', 'important');
        a.style.setProperty('height', 'auto', 'important');
        a.style.setProperty('max-height', 'none', 'important');
        n++;
      }
      a = a.parentElement;
    }
    return n;
  }).catch(() => 0);
}

/**
 * For the pictures only: page n alone is laid out, the other pages are taken out of the flow. With the pane's clip
 * lifted every page would otherwise be drawn at once in one very tall window, and a document of thirty pages took
 * minutes to shoot. Called before each page is shot; its size is read after.
 */
async function pageOnly(P, n) {
  await P.evaluate((n) => {
    document.querySelectorAll('.fe-doc .es-page[data-page]').forEach((pg) => {
      const w = pg.closest('.es-page-wrap') || pg;
      if (Number(pg.getAttribute('data-page')) === n) w.style.removeProperty('display');
      else w.style.setProperty('display', 'none', 'important');
    });
    window.scrollTo(0, 0);
  }, n).catch(() => {});
  await P.waitForTimeout(80);
}

/** contact-NN.png: the compare pictures of a folder, per pages to a sheet, each with its page number. */
function contactSheets(dir, per) {
  fs.readdirSync(dir).filter((f) => /^contact-\d+\.png$/.test(f)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  const files = fs.readdirSync(dir).filter((f) => /^compare-p\d+\.png$/.test(f)).sort().map((f) => path.join(dir, f));
  if (!files.length) return 0;
  const py = `
import sys, json, re
from PIL import Image, ImageDraw, ImageFont
files = json.loads(sys.argv[1]); per = int(sys.argv[2]); out = sys.argv[3]
try:
    font = ImageFont.truetype('DejaVuSans.ttf', 18)
except Exception:
    font = ImageFont.load_default()
W = 520; cols = 4
n = 0
for i in range(0, len(files), per):
    part = files[i:i + per]; thumbs = []
    for f in part:
        im = Image.open(f).convert('RGB'); h = round(im.height * W / im.width); thumbs.append((f, im.resize((W, h), Image.LANCZOS)))
    rows = (len(thumbs) + cols - 1) // cols; H = max(t[1].height for t in thumbs)
    sheet = Image.new('RGB', (cols * (W + 8) + 8, rows * (H + 34) + 8), (255, 255, 255)); d = ImageDraw.Draw(sheet)
    for k, (f, t) in enumerate(thumbs):
        x = 8 + (k % cols) * (W + 8); y = 8 + (k // cols) * (H + 34)
        d.text((x, y), 'page ' + str(int(re.search(r'p(\\d+)\\.png$', f).group(1))), fill=(0, 0, 0), font=font)
        sheet.paste(t, (x, y + 26)); d.rectangle([x - 1, y + 25, x + W, y + 26 + t.height], outline=(120, 120, 120))
    n += 1
    sheet.save('%s/contact-%02d.png' % (out, n))
print(n)`;
  const r = spawnSync('python3', ['-I', '-c', py, JSON.stringify(files), String(per || 8), dir], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.log('contact sheets failed: ' + (r.stderr || '').slice(-300)); return 0; }
  return Number(String(r.stdout).trim()) || 0;
}

function writeMeasure(dir, o) {
  fs.writeFileSync(path.join(dir, 'measure.json'), JSON.stringify(o, null, 1) + '\n');
}
/** One field as the stability measure compares it: page, kind, box, owner, required, mark. */
const listRow = (f) => [f.page, f.kind, Math.round(f.x0 * 10) / 10, Math.round(f.top * 10) / 10, Math.round(f.x1 * 10) / 10, Math.round(f.bottom * 10) / 10, f.owner || '', !!f.required, !!f.review];
/** The sentences of a read summary. */
const sentences = (t) => String(t || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const namesPage = (s, n) => new RegExp('\\bpages?\\b[^.]*\\b' + n + '\\b').test(s);

module.exports = { notRun, need, nl, STANDARD, PLAIN, labelOk, hideBars, pageOnly, contactSheets, writeMeasure, listRow, sentences, namesPage };
