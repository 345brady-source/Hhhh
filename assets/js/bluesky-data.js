/*
 * The state notice table: one row per jurisdiction of the Form D states-of-solicitation list (the 50 states, the District
 * of Columbia and Puerto Rico), loaded as a script (never fetched).
 *
 * A row is filled only from the official state fee matrix, with the address it was read from (source) and the date it
 * was read (readOn), and only then marked confirmed. Until a row is confirmed it holds no fee, no deadline and no renewal,
 * and nothing on screen shows an amount for that state. Every row below is unconfirmed: the matrix has not been read yet.
 *
 *   asOf        the date of the matrix the confirmed rows were read from ('' until one is)
 *   systemFee   the filing system's own fee: { confirmed, cents, appliesTo: 'initial' | 'all' | null, source, readOn }
 *   table[code] { code, name, confirmed, noticeRequired, online, fee, days, renewal, source, readOn }
 *     fee       { kind: 'fixed', cents } | { kind: 'tiered', basis: 'offered' | 'soldInState', tiers: [ { upTo: dollars | null, cents } ] }
 *               | { kind: 'percent', basis, rate, minCents, maxCents }
 *     days      the days after the first sale in the state within which the notice is due (null: not known)
 *     renewal   { months, fee? } | null: how long a notice lasts and, where the matrix gives one, the renewal fee (same shapes)
 */
(function (NS) {
  'use strict';
  const NAMES = [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
    ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
    ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
    ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['PR', 'Puerto Rico']
  ];
  const table = {};
  NAMES.forEach(([code, name]) => {
    table[code] = { code, name, confirmed: false, noticeRequired: null, online: null, fee: null, days: null, renewal: null, source: '', readOn: '' };
  });
  const DATA = { asOf: '', systemFee: { confirmed: false, cents: null, appliesTo: null, source: '', readOn: '' }, table };
  if (NS) NS.blueskyData = DATA;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
