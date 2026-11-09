// CardDAV address books (iCloud Contacts, Fastmail, Nextcloud, Radicale…), read-only.
import { CalDavClient, CalDavError } from './caldav.js';
import { parseXml, findAll, find, textOf } from '../xml.js';
import { escapeXml } from '../xml.js';

const PROPS_HOME = '<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:resourcetype/><d:current-user-principal/><card:addressbook-home-set/><d:displayname/></d:prop></d:propfind>';
const PROPS_BOOKS = '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/><d:getetag/><d:getcontenttype/></d:prop></d:propfind>';

export class CardDavClient extends CalDavClient {
  /** Find the address books, starting from a server, principal, home or address book URL. */
  async discoverBooks() {
    let first;
    try {
      first = await this.propfind(this.base, 0, PROPS_HOME);
    } catch (e) {
      if (e.auth) throw e;
      first = await this.propfind(new URL('/.well-known/carddav', this.base).toString(), 0, PROPS_HOME);
    }
    const r0 = first[0];
    const isBook = (r) => r.props.some((p) => find(p, 'resourcetype') && find(find(p, 'resourcetype'), 'addressbook'));
    const hrefIn = (r, name) => {
      for (const p of r?.props || []) {
        const n = find(p, name);
        const h = n && find(n, 'href');
        if (h) return new URL(textOf(h), r.url).toString();
      }
      return null;
    };
    if (r0 && isBook(r0)) return [{ url: r0.href, name: textOf(r0.props.map((p) => find(p, 'displayname')).find(Boolean)) || 'Contacts' }];
    let home = hrefIn(r0, 'addressbook-home-set');
    if (!home) {
      const principal = hrefIn(r0, 'current-user-principal');
      if (principal) home = hrefIn((await this.propfind(principal, 0, PROPS_HOME))[0], 'addressbook-home-set');
    }
    if (!home) throw new CalDavError('No address book was found at this address.', 404);
    const list = await this.propfind(home, 1, PROPS_BOOKS);
    return list.filter(isBook).map((r) => ({ url: r.href.endsWith('/') ? r.href : `${r.href}/`, name: textOf(r.props.map((p) => find(p, 'displayname')).find(Boolean)) || 'Contacts' }));
  }

  /** Every card's href and etag in one address book. */
  async listCards(bookUrl) {
    const list = await this.propfind(bookUrl, 1, PROPS_BOOKS);
    const self = bookUrl.replace(/\/$/, '');
    return list
      .filter((r) => r.href.replace(/\/$/, '') !== self)
      .filter((r) => !r.props.some((p) => find(p, 'resourcetype') && find(find(p, 'resourcetype'), 'collection')))
      .map((r) => ({ href: r.href, etag: textOf(r.props.map((p) => find(p, 'getetag')).find(Boolean)) || null }));
  }

  /** Download cards in batches with addressbook-multiget. */
  async fetchCards(bookUrl, hrefs) {
    const out = [];
    for (let i = 0; i < hrefs.length; i += 100) {
      const batch = hrefs.slice(i, i + 100);
      const body = `<card:addressbook-multiget xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:getetag/><card:address-data/></d:prop>${batch.map((h) => `<d:href>${escapeXml(new URL(h).pathname)}</d:href>`).join('')}</card:addressbook-multiget>`;
      const r = await this.req('REPORT', bookUrl, { depth: 1, body, okStatuses: [207] });
      for (const resp of findAll(parseXml(r.text), 'response')) {
        const data = find(resp, 'address-data');
        if (!data) continue;
        out.push({ href: new URL(textOf(find(resp, 'href')), r.url).toString(), etag: textOf(find(resp, 'getetag')) || null, vcard: data.text });
      }
    }
    return out;
  }
}
