// gate: none
// A layout model written by hand to plan 12-02's shape (12-02-PLAN.md <interfaces>), drawn by assets/js/reports-pdf.js
// in plan 12-03's check. Every string is what a renderer prints as typed; the composer formats no number itself.
// The test images were made once with python3 -I and PIL (a 160x100 JPEG photo, a 120x40 PNG logo with transparency and
// the same logo as JPEG) and are kept here as base64, each under 4 KB.
'use strict';

const rows = [];
for (let n = 1; n <= 60; n++) rows.push([{ v: 'Line ' + n, s: 'Line ' + n }, { v: 100000 + n, s: '$1,000.' + String(n).padStart(2, '0') }]);

const model = {
  v: 1,
  kind: 'quarterly',
  title: 'Quarterly report',
  subtitle: 'Quarter ended December 31, 2026',
  period: { from: '2026-10-01', to: '2026-12-31' },
  recipient: { id: 'INV-7', name: 'Łukasz Żółć' },
  firm: {
    name: 'Société Àrbre Capital',
    legalName: 'Société Àrbre Capital Management, LLC',
    colors: { primary: '#1F3A5F', accent: '#C8963E' },
    logo: { type: 'wing', letters: 'SA' },
    support: { team: 'Investor relations', email: 'ir@arbre-capital.example', phone: '+1 212 555 0148' }
  },
  cover: { on: true, style: 'band', accent: '#1F3A5F', photoId: '', lines: ['Prepared for Łukasz Żółć', 'Cedar Row Income Fund'] },
  footer: 'Société Àrbre Capital Management, LLC',
  meta: { title: 'Quarterly report - Quarter ended December 31, 2026', author: 'Société Àrbre Capital Management, LLC' },
  when: '2027-01-20T12:00:00.000Z',
  blocks: [
    { k: 'h1', text: 'Letter to investors' },
    {
      k: 'p',
      runs: [
        { s: 'Dear Łukasz, this quarter the fund ', b: false, i: false },
        { s: 'closed its second acquisition', b: true, i: false },
        { s: ' and ', b: false, i: false },
        { s: 'kept every distribution on schedule', b: false, i: true },
        { s: '. Occupancy held above ninety percent across the portfolio, and the lender extended the facility on the same terms.', b: false, i: false }
      ]
    },
    {
      k: 'ul',
      items: [
        [{ s: 'Rent collections reached ', b: false, i: false }, { s: 'ninety-eight percent', b: true, i: false }],
        [{ s: 'The roof at Mill Street was replaced on budget', b: false, i: false }],
        [{ s: 'A refinance is ', b: false, i: false }, { s: 'under review', b: false, i: true }]
      ]
    },
    {
      k: 'tiles',
      items: [
        { label: 'Ending capital', value: '$345,000.00', v: 34500000, t: 'money' },
        { label: 'TVPI', value: '1.17x', v: 1.17, t: 'ratio' },
        { label: 'DPI', value: '0.02x', v: 0.02, t: 'ratio' },
        { label: 'Net IRR', value: '12.3%', v: 0.123, t: 'pct' }
      ]
    },
    { k: 'table', title: 'Operating lines', currency: 'USD', cols: [{ h: 'Item', t: 'text' }, { h: 'Amount', t: 'money' }], rows, total: [{ v: 'Total', s: 'Total' }, { v: 6001830, s: '$60,018.30' }] },
    {
      k: 'chart',
      kind: 'columns',
      title: 'Distributions by quarter',
      labels: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      values: [150000, 300000, 450000, 600000],
      shown: ['$1,500.00', '$3,000.00', '$4,500.00', '$6,000.00'],
      ticks: [{ at: 0, s: '$0' }, { at: 0.5, s: '$3,000' }, { at: 1, s: '$6,000' }]
    },
    {
      k: 'chart',
      kind: 'line',
      title: 'Month-end capital',
      labels: ['Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026'],
      values: [31000000, 31800000, 32500000, 33400000, 33900000, 34500000],
      shown: ['$310,000', '$318,000', '$325,000', '$334,000', '$339,000', '$345,000'],
      ticks: [{ at: 0, s: '$0' }, { at: 1, s: '$345,000' }]
    },
    {
      k: 'chart',
      kind: 'bar100',
      title: 'Fair value by holding',
      labels: ['Cedar Row', 'Harbor Point', 'Mill Street'],
      values: [0.5, 0.3, 0.2],
      shown: ['50.0%', '30.0%', '20.0%'],
      ticks: []
    },
    { k: 'photo', id: 'p1', caption: 'Cedar Row, east elevation' },
    { k: 'note', text: 'Book capital, not tax capital. Past results do not promise future results.' },
    { k: 'break' },
    { k: 'h2', text: 'Outlook for 2027' },
    { k: 'p', runs: [{ s: 'We expect to complete the Harbor Point lease-up by the second quarter.', b: false, i: false }] }
  ]
};

// base64 of the test images (python3 -I with PIL 12.3.0, once)
const b64 = {
  photo: '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',
  logoPng: 'iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAYAAAA16j4lAAAAg0lEQVR42u3bsQmAMBBA0USyh2uIhavYZyB7V7EQ18gkcQdF8OC9CY77XBNIHue1px9r554Tjw1WIDACIzACIzACI7DACIzACIzAvFGiDn5tS5fPBQtsBQIjMAIjMAIjMAILjMCEEPYteqqHHw8uGIEFRmAERmAERmAEFhiBERiB+doN8IQIVBLd/SUAAAAASUVORK5CYII=',
  logoJpg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAoAHgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDhKKKK9I4QooooAK+oa+Xq+nLm5hs7dp532RpjLYJxk47VzYhpJNnRRV7ktFZf/CS6R/z9/wDkN/8ACj/hJdI/5+//ACG/+FcPt6X8y+86fZz7M1KKy/8AhJdI/wCfv/yG/wDhR/wkukf8/f8A5Df/AAo9vS/mX3h7OfZmpRWX/wAJLpH/AD9/+Q3/AMKP+El0j/n7/wDIb/4Ue3pfzL7w9nPszUorL/4SXSP+fv8A8hv/AIUf8JLpH/P3/wCQ3/wo9vS/mX3h7OfZmpRWX/wkukf8/f8A5Df/AAoo9vS/mX3h7OfZnzlRRRXrnnBRRRQAV9G+Jf8AkAXP/AP/AEIV85V9OXNtDeW7QTpvjfGVyRnBz2rjxkXKHKuqZ04d2lf0PNKK7z/hGtI/59P/ACI/+NH/AAjWkf8APp/5Ef8Axr5/+z6vdf18j1frUOzODorvP+Ea0j/n0/8AIj/40f8ACNaR/wA+n/kR/wDGj+z6vdf18g+tQ7M4Oiu8/wCEa0j/AJ9P/Ij/AONH/CNaR/z6f+RH/wAaP7Pq91/XyD61Dszg6K7z/hGtI/59P/Ij/wCNH/CNaR/z6f8AkR/8aP7Pq91/XyD61Dszg6K7z/hGtI/59P8AyI/+NFH9n1e6/r5B9ah2Z85UUUV9YeCFFFFABX1DRRXNiOhvR6hRRRXMbhRRRQAUUUUAFFFFABRRRQB//9k='
};

module.exports = { model, b64 };
