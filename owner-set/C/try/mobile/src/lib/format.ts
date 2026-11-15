import { NS } from '../core';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Any = any;

export const usd = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const usdc = (c: number) =>
  (c < 0 ? '−$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function date(iso: string, style?: 'my' | 'long' | 'wd') {
  if (!iso) return '';
  const d = NS.dates.parse(iso);
  const o: Intl.DateTimeFormatOptions =
    style === 'my'
      ? { month: 'short', year: 'numeric' }
      : style === 'long'
        ? { month: 'long', day: 'numeric', year: 'numeric' }
        : style === 'wd'
          ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
          : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
}

export const last4 = (s: string) => String(s || '').replace(/\s/g, '').slice(-4);
export const today = (): string => NS.dates.today();

/** Time to redemption as a duration, with the projected date beneath (same rule as the web portal). */
export function redemption(o: Any): [string, string] {
  const now = today();
  const e = o.exit || {};
  const M = NS.dates.monthsBetween;
  const span = NS.dates.span;
  const yrs = (m: number) => Math.max(1, Math.round(m / 12));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  switch (e.basis) {
    case 'maturity':
      return now >= e.date ? ['Matured', `Matured ${date(e.date)}`] : [span(M(now, e.date)), `Matures ${date(e.date)}`];
    case 'range': {
      const a = M(now, e.from);
      const b = M(now, e.to);
      const fy = e.from.slice(0, 4);
      const ty = e.to.slice(0, 4);
      const proj = `Projected ${fy === ty ? fy : fy + '–' + ty}`;
      if (b < 0) return ['Past projected window', proj];
      if (a <= 0) return [`Now through ${date(e.to, 'my')}`, proj];
      if (a >= 12 && yrs(a) === yrs(b)) return [`About ${plural(yrs(a), 'year')}`, proj];
      return [a < 12 ? `${plural(a, 'month')} to ${plural(yrs(b), 'year')}` : `${yrs(a)}–${yrs(b)} years`, proj];
    }
    case 'open':
      return ['No set term', 'Open-ended'];
    case 'exited':
      return ['Completed', e.date ? date(e.date) : ''];
    default:
      if (!e.date) return ['Not set', ''];
      return now >= e.date ? ['Past projected date', `Projected ${date(e.date, 'my')}`] : [span(M(now, e.date)), `Projected ${date(e.date, 'my')}`];
  }
}
