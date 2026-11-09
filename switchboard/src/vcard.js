// vCard 3.0/4.0 reader for address books synced over CardDAV.

const unescape = (v) => String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Parse one or more vCards. Returns [{uid, name, company, notes, emails: [{type, value}], phones: [{type, value}]}]. */
export function parseVCards(text) {
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const cards = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^BEGIN:VCARD$/i.test(line)) { cur = { uid: null, name: '', n: '', company: '', notes: '', emails: [], phones: [] }; continue; }
    if (/^END:VCARD$/i.test(line)) {
      if (cur) {
        if (!cur.name) cur.name = cur.n || cur.company || cur.emails[0]?.value || cur.phones[0]?.value || '';
        delete cur.n;
        cards.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [nameWithGroup, ...params] = head.split(';');
    const name = nameWithGroup.replace(/^[^.]+\./, '').toUpperCase(); // "item1.TEL" -> "TEL"
    const types = params.flatMap((p) => {
      const [k, v] = p.split('=');
      if (!v) return [k.toLowerCase()];
      return k.toUpperCase() === 'TYPE' ? v.replace(/"/g, '').toLowerCase().split(',') : [];
    }).filter((t) => t && !['internet', 'pref', 'voice'].includes(t));
    const type = types[0] || '';
    switch (name) {
      case 'UID': cur.uid = value.trim(); break;
      case 'FN': cur.name = unescape(value).trim(); break;
      case 'N': {
        const [family, given, middle, prefix, suffix] = value.split(';').map(unescape);
        cur.n = [prefix, given, middle, family, suffix].filter(Boolean).join(' ').trim();
        break;
      }
      case 'ORG': cur.company = unescape(value.split(';')[0]).trim(); break;
      case 'NOTE': cur.notes = unescape(value); break;
      case 'EMAIL': if (value.trim()) cur.emails.push({ type, value: value.trim().replace(/^mailto:/i, '') }); break;
      case 'TEL': if (value.trim()) cur.phones.push({ type, value: value.trim().replace(/^tel:/i, '') }); break;
    }
  }
  return cards;
}

/** Comparable key for a phone number: its last 10 digits (ignores +1, spaces, dashes, parentheses). */
export function phoneKey(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}
