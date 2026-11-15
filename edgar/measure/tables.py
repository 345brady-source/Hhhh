#!/usr/bin/env python3
"""Baseline tables from one or more summary.json files (each a set), and from all of them together.

  python3 -I tables.py <name>=<summary.json> [<name>=<summary.json> ...] > baseline.md
"""
import sys, json
from collections import defaultdict

KEYS = ['sponsorWork', 'placeNoField', 'strayNoPlace', 'strayOverText', 'overlaps', 'marked', 'fields', 'fillCandidates', 'fillWithField', 'consoleErrors']


def agg(rows):
    ok = [r for r in rows if 'fields' in r]
    t = {k: sum(r.get(k) or 0 for r in ok) for k in KEYS}
    t['documents'] = len(rows)
    t['broken'] = len(rows) - len(ok)
    t['ready'] = sum(1 for r in ok if r.get('readyToSend'))
    t['unreadable'] = sum(r.get('unreadable') or 0 for r in ok)
    t['timedOut'] = sum(r.get('timedOut') or 0 for r in ok)
    t['offer'] = sum(1 for r in ok if r.get('offer', 'none') != 'none')
    t['noSignature'] = sum(1 for r in ok if r.get('noSignature') == 1)
    t['noSigUnknown'] = sum(1 for r in ok if r.get('noSignature') is None)
    t['zeroFields'] = sum(1 for r in ok if not r.get('fields'))
    t['coverage'] = round(100.0 * t['fillWithField'] / t['fillCandidates'], 1) if t['fillCandidates'] else None
    t['marked%'] = round(100.0 * t['marked'] / t['fields'], 1) if t['fields'] else 0
    t['seconds'] = round(sum(r.get('seconds') or 0 for r in ok), 1)
    w = sorted(r.get('sponsorWork') or 0 for r in ok)
    t['workMedian'] = w[len(w) // 2] if w else None
    return t


HEAD = '| set | docs | ready to send | sponsor work (median a doc) | places with a field % | place, no field | stray: no place | stray: over text | overlaps | marked % | no signature (unknown) | picture offer | zero fields | unreadable / timed out / broken | reading s |'


def line(name, t):
    return '| %s | %d | %d | %d (%s) | %s | %d | %d | %d | %d | %s | %d (%d) | %d | %d | %d / %d / %d | %s |' % (
        name, t['documents'], t['ready'], t['sponsorWork'], t['workMedian'], t['coverage'], t['placeNoField'], t['strayNoPlace'], t['strayOverText'], t['overlaps'], t['marked%'],
        t['noSignature'], t['noSigUnknown'], t['offer'], t['zeroFields'], t['unreadable'], t['timedOut'], t['broken'], t['seconds'])


def main():
    sets = []
    for a in sys.argv[1:]:
        name, f = a.split('=', 1)
        sets.append((name, json.load(open(f))))
    allrows = []
    out = ['## Totals', '', HEAD, '|' + '---|' * 15]
    for name, s in sets:
        rows = s['docs']
        allrows += [dict(r, set=name) for r in rows]
        out.append(line(name, agg(rows)))
    if len(sets) > 1:
        out.append(line('**together**', agg(allrows)))
    for key, label in (('made', 'how the PDF was made'), ('content', 'page content')):
        g = defaultdict(list)
        for r in allrows:
            g[((r.get('meta') or {}).get(key) or '?')].append(r)
        out += ['', '## By ' + label, '', HEAD.replace('| set |', '| ' + key + ' |'), '|' + '---|' * 15]
        for k in sorted(g, key=lambda k: -len(g[k])):
            out.append(line(k, agg(g[k])))
    worst = sorted([r for r in allrows if 'fields' in r], key=lambda r: -(r.get('sponsorWork') or 0))[:15]
    out += ['', '## Most sponsor work', '', '| doc | made | pages | fields | sponsor work | place, no field | strays (no place / over text) | marked | offer |', '|---|---|---|---|---|---|---|---|---|']
    for r in worst:
        out.append('| %s | %s | %s | %s | %s | %s | %s / %s | %s | %s |' % (r['id'], (r.get('meta') or {}).get('made', ''), r.get('pages'), r.get('fields'), r.get('sponsorWork'), r.get('placeNoField'), r.get('strayNoPlace'), r.get('strayOverText'), r.get('marked'), r.get('offer')))
    ready = [r['id'] for r in allrows if r.get('readyToSend')]
    out += ['', 'Ready to send: ' + (', '.join(ready) if ready else 'none')]
    print('\n'.join(out))


main()
