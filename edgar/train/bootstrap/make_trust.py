#!/usr/bin/env python3 -I
"""Apply plan 22's pre-registered trust rule to the measured numbers and write trust.json."""
import collections, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
q = json.load(open(os.path.join(HERE, 'quality.json')))
s = json.load(open(os.path.join(HERE, 'sample-results.json')))
t = q['totals']


def pct(a, b):
    return round(100.0 * a / b, 2) if b else 0.0


gold_auto = pct(t['auto'] - t['strays'], t['auto'])
gold_kind = pct(t['found'] - t['kindDiff'], t['found'])
gold_person = pct(t['found'] - t['ownerDiff'], t['found'])
gold_recall = pct(t['found'], t['places'])
prop = pct(t['propFound'], t['places'])
g = collections.defaultdict(collections.Counter)
for i, r in q['docs'].items():
    for k in ('auto', 'strays'):
        g[r['made']][k] += r[k]
        if r['bd']:
            g['broker-dealer form'][k] += r[k]
per = {k: pct(v['auto'] - v['strays'], v['auto']) for k, v in g.items()}
samp = pct(s['box_ok'], s['confirmed'])
geo = gold_auto >= 98 and samp >= 98 and min(per.values()) >= 95
kind = geo and gold_kind >= 98
person = geo and gold_person >= 98
bg = 'full' if prop >= 97 else 'masked'
ga = s['gold_after']
trust = dict(
    plan='01.4-22', written='2026-11-15', run='out-18',
    rule=dict(text='Pre-registered (plan 22 must_haves, written before any training reads it): geometry trusted when auto-place precision is at least 98 percent on the gold documents and on the review sample, with no how-made kind below 95 percent; kind trusted at 98 percent kind precision; person trusted at 98 percent person precision; an untrusted part of the auto labels is not used (that target is learned only from hand and reviewed sheets); background full when proposal recall on gold is at least 97 percent, else masked (training loss on auto-labelled pages ignores everything within 24 pt of a proposal or a printed line or box that is not an accepted place); if geometry is not trusted, auto labels are not used at all. Weight 0.5 for trusted auto places.',
              geometry_gold=98.0, geometry_sample=98.0, geometry_min_how_made=95.0, kind=98.0, person=98.0, background_full_recall=97.0, mask_pt=24, weight_trusted=0.5),
    geometry=dict(trusted=geo, gold_auto_precision=gold_auto, gold_auto_places=t['auto'], sample_auto_precision=samp, sample_confirmed=s['confirmed'],
                  per_how_made=per, lowest_how_made=min(per, key=per.get)),
    kind=dict(trusted=kind, gold_kind_precision=gold_kind, note='' if geo else 'not used: geometry is not trusted'),
    person=dict(trusted=person, gold_person_precision=gold_person, note='' if geo else 'not used: geometry is not trusted'),
    background=dict(mode=bg, gold_proposal_recall=prop, mask_pt=24, note='applies to any page whose labels are not a complete hand sheet'),
    weight=dict(auto_places=0.5 if geo else 0.0, why='trusted auto places' if geo else 'auto labels are not used at all (geometry not trusted)'),
    use_auto_labels=geo,
    reviewed_disagreements_only=dict(
        trusted=False, documents=6, gold_precision=pct(ga['n'] - ga['strays'], ga['n']), gold_kind_precision=pct(ga['found'] - ga['kindDiff'], ga['found']),
        gold_person_precision=pct(ga['found'] - ga['ownerDiff'], ga['found']), gold_recall=pct(ga['found'], ga['places']),
        note='Sheets reviewed on disagreements only (auto places kept unreviewed) measured below the same 98 percent bar on 6 blind gold documents. The pre-registered rule does not name them, so the same bar is applied: they are not used as complete sheets. Later adjudication (plans 24 to 29) confirms every auto place (confirm-all) because geometry is not trusted.'),
    measured=dict(gold_documents=len(q['docs']), gold_auto_precision=gold_auto, gold_kind_precision=gold_kind, gold_person_precision=gold_person,
                  gold_auto_recall=gold_recall, gold_proposal_recall=prop, sample_auto_precision=samp,
                  sample_place_and_kind_precision=pct(s['both_ok'], s['confirmed']), per_how_made_auto_precision=per, d28_gold_left_out=len(q['skipped_d28'])))
json.dump(trust, open(os.path.join(HERE, 'trust.json'), 'w'), indent=1)
print(json.dumps({k: trust[k] for k in ('geometry', 'kind', 'person', 'background', 'weight', 'reviewed_disagreements_only')}))
