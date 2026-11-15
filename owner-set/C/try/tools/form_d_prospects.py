#!/usr/bin/env python3
"""
Find prospective Carrow & Vale clients in SEC Form D filings.

Every private fund or syndication that sells interests under Regulation D
files a Form D within 15 days of its first sale. This script pulls the new
Form D notices filed in the last N days for the fund types Carrow & Vale
serves (real estate, private equity, venture, hedge, other investment funds,
oil and gas), leaves out platform SPV series, wealth-platform feeders, large
institutional managers and foreign filers, adds each issuer's address, phone
and filing history from EDGAR, and scores each one for fit.

    python3 tools/form_d_prospects.py --days 60 --out prospects.csv

The SEC asks automated tools to identify themselves. Set SEC_USER_AGENT to
"Company Name contact@yourdomain.com" (your own details) when you run it;
with a contact set, --details also reads each filing for the amount being
raised, the amount sold so far, the number of investors and the minimum.
Uses only the Python standard library. Keeps under the SEC's 10 requests a
second.
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = os.environ.get('SEC_USER_AGENT', 'CarrowVale-ProspectResearch/1.0')
SEARCH = 'https://efts.sec.gov/LATEST/search-index'
SUBMISSIONS = 'https://data.sec.gov/submissions/CIK{:010d}.json'
ARCHIVE = 'https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/primary_doc.xml'

# Fund types as Form D labels them, with how well each fits Carrow & Vale's service.
CATEGORIES = [
    ('Real estate', 'Residential', 25),
    ('Real estate', 'Commercial', 25),
    ('Real estate', 'Other Real Estate', 25),
    ('Real estate', 'REITS and Finance', 22),
    ('Private equity', 'Private Equity Fund', 20),
    ('Oil and gas', 'Oil and Gas', 20),
    ('Venture capital', 'Venture Capital Fund', 18),
    ('Other investment fund', 'Other Investment Fund', 18),
    ('Hedge fund', 'Hedge Fund', 15),
]
EXEMPTIONS = {'06B': '506(b)', '06C': '506(c)', '06': '506', '04': 'Rule 504', '4A5': '4(a)(5)', '04a5': '4(a)(5)', '3C': ''}
exemption = lambda code: EXEMPTIONS.get(code) if code in EXEMPTIONS else re.sub(r'^3C\.(\d+)$', r'3(c)(\1)', code)
US = set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY'.split())

# Vehicles that already have an administrator by construction.
PLATFORM = re.compile(
    r'\bseries of\b|\baccess fund\b|\bcapital access\b|\bseries\s+(?:[a-z]{0,2}\d+|[ivx]+)\b|-\s*series\b|\bspv\b|\broll[- ]?up vehicle\b|\bruv\b|'
    r'\b(?:icapital|cais|moonfare|yieldstreet|fundrise|crowdstreet|realtymogul|equitymultiple|arrived|ark7|percent|'
    r'angellist|sydecar|assure|allocations|carta|republic|microventures|wefunder|startengine|forge|hiive|augment|'
    r'opto|alto|ipm|delta alts|titan|masterworks|rally|otis|acretrader|farmtogether|crowdfunz|groundfloor|cadre|ieq|'
    r'pathway|realty mogul|1031 crowdfunding|fundthrough|mainvest|honeycomb|netcapital|seedinvest|ourcrowd)\b', re.I)
INSTITUTIONAL = re.compile(
    r'\b(?:blackstone|kkr|apollo|carlyle|brookfield|goldman|morgan stanley|j\.?p\.? ?morgan|blackrock|ares|tpg|bain capital|'
    r'blue owl|starwood|fidelity|vanguard|citadel|bridgewater|two sigma|millennium|point72|sequoia|andreessen|a16z|'
    r'tiger global|insight partners|general atlantic|warburg|hellman|silver lake|thoma bravo|vista equity|oaktree|pimco|'
    r'neuberger|franklin|invesco|nuveen|hines|cantor|cnl|inland|griffin|stepstone|hamilton lane|pantheon|adams street|'
    r'harbourvest|ubs|credit suisse|barclays|wells fargo|bank of america|merrill|citigroup|jefferies|lazard|evercore|'
    r'man group|aqr|d\.?e\.? shaw|elliott|baupost|blue mountain|golub|hps|sixth street|owl rock|benefit street)\b', re.I)
TAX_CREDIT = re.compile(r'\b(?:nmtc|new markets|lihtc|low[- ]income housing tax|tax credit|historic tax)\b', re.I)
STRUCTURE = re.compile(r'\b(?:offshore|cayman|parallel|aiv|intermediate|blocker|lux(?:embourg)?|scsp|icav|ireland)\b', re.I)
FUND_NO = re.compile(r'\b(?:fund|partners|ventures|equity|opportunities|credit|infrastructure|income|growth|capital)\s+([IVXL]{1,6}|\d{1,2})\b', re.I)
ROMAN = {'I': 1, 'V': 5, 'X': 10, 'L': 50}


def fund_number(name):
    """The series number of a numbered fund ("Fund VII" → 7), else 0."""
    m = FUND_NO.search(name)
    if not m:
        return 0
    t = m.group(1).upper()
    if t.isdigit():
        return int(t)
    total = 0
    for i, ch in enumerate(t):
        v = ROMAN[ch]
        total += -v if i + 1 < len(t) and ROMAN[t[i + 1]] > v else v
    return total


DEAL_SPV = re.compile(r'\b20\d\d,?\s*(?:llc|l\.l\.c\.|lp|l\.p\.)\b|\bco-?invest(?:ment)?\b.*\b20\d\d\b', re.I)
NUMBERED = re.compile(r'\b(?:fund|partners|capital|ventures|opportunit(?:y|ies)|income|growth|equity)\s+(?:i{2,3}|iv|v|vi{1,3}|ix|x|[2-9])\b', re.I)

last_call = [0.0]


def get(url, accept='application/json'):
    """GET with the SEC's rate limit and a few retries."""
    for attempt in range(4):
        wait = 0.13 - (time.time() - last_call[0])
        if wait > 0:
            time.sleep(wait)
        last_call[0] = time.time()
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            time.sleep(2 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 * (attempt + 1))
    return None


def search(phrase, start, end, cap):
    """Every Form D notice in the date range whose fund type or industry is `phrase`."""
    hits = []
    offset = 0
    while offset < cap:
        q = urllib.parse.urlencode({'q': f'"{phrase}"', 'forms': 'D', 'dateRange': 'custom', 'startdt': start, 'enddt': end, 'from': offset})
        raw = get(f'{SEARCH}?{q}')
        if not raw:
            break
        page = json.loads(raw).get('hits', {})
        batch = page.get('hits', [])
        hits.extend(batch)
        offset += len(batch)
        if not batch or offset >= page.get('total', {}).get('value', 0):
            break
    return hits


def clean_name(display):
    return re.sub(r'\s*\(CIK \d+\)\s*$', '', display or '').strip()


def details(cik, adsh):
    """Amounts and investor count from the filing itself (needs SEC_USER_AGENT with a contact)."""
    raw = get(ARCHIVE.format(cik=int(cik), acc=adsh.replace('-', '')), accept='application/xml')
    if not raw:
        return {}
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return {}
    t = lambda path: (root.findtext(path) or '').strip()
    out = {
        'offering_amount': t('.//offeringSalesAmounts/totalOfferingAmount'),
        'amount_sold': t('.//offeringSalesAmounts/totalAmountSold'),
        'investors': t('.//investors/totalNumberAlreadyInvested'),
        'minimum': t('.//minimumInvestmentAccepted'),
        'related_persons': '; '.join(
            ' '.join(filter(None, [p.findtext('relatedPersonName/firstName'), p.findtext('relatedPersonName/lastName')])).strip()
            + (f" ({', '.join(r.text for r in p.findall('relatedPersonRelationshipList/relationship') if r.text)})" if p.find('relatedPersonRelationshipList') is not None else '')
            for p in root.findall('.//relatedPersonsList/relatedPersonInfo')[:4]
        ),
    }
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--days', type=int, default=60, help='look back this many days (default 60)')
    ap.add_argument('--out', default='prospects.csv', help='CSV file to write')
    ap.add_argument('--lookups', type=int, default=4000, help='how many of the best matches to look up in EDGAR (default 4000)')
    ap.add_argument('--top', type=int, default=300, help='sponsors to keep in the sponsor list (default 300)')
    ap.add_argument('--cap', type=int, default=3000, help='most filings to read per fund type (default 3000)')
    ap.add_argument('--details', action='store_true', help='also read each filing for amounts and investors (set SEC_USER_AGENT first)')
    ap.add_argument('--cache', default='', help='where to keep EDGAR company lookups between runs (default: next to --out)')
    a = ap.parse_args()

    end = dt.date.today()
    start = end - dt.timedelta(days=a.days)
    s, e = start.isoformat(), end.isoformat()
    print(f'Form D notices filed {s} to {e}', file=sys.stderr)

    banking = {h['_source'].get('adsh') for h in search('Commercial Banking', s, e, a.cap)}
    found = {}
    for label, phrase, weight in CATEGORIES:
        hits = search(phrase, s, e, a.cap)
        kept = 0
        for h in hits:
            src = h['_source']
            if src.get('file_type') != 'D' or (phrase == 'Commercial' and src.get('adsh') in banking):
                continue
            cik = (src.get('ciks') or [None])[0]
            if not cik:
                continue
            name = clean_name((src.get('display_names') or [''])[0])
            state = (src.get('biz_states') or [''])[0]
            if state not in US or PLATFORM.search(name) or INSTITUTIONAL.search(name) or TAX_CREDIT.search(name):
                continue
            prev = found.get(cik)
            if prev and prev['filed'] <= src['file_date']:
                continue
            found[cik] = {
                'cik': cik,
                'name': name,
                'category': label,
                'industry': phrase,
                'weight': weight,
                'filed': src['file_date'],
                'adsh': src['adsh'],
                'location': (src.get('biz_locations') or [''])[0],
                'state': state,
                'exemptions': ', '.join(x for x in (exemption(i) for i in src.get('items') or []) if x),
                'items': src.get('items') or [],
            }
            kept += 1
        print(f'  {phrase}: {len(hits)} filings, {kept} new US notices kept', file=sys.stderr)

    rows = list(found.values())
    for r in rows:
        pre = r['weight']
        pre += 10 if '06C' in r['items'] else 0
        pre += 8 if NUMBERED.search(r['name']) else 0
        pre -= 15 if DEAL_SPV.search(r['name']) else 0
        pre -= 5 if '3C.7' in r['items'] and '06C' not in r['items'] and '3C.1' not in r['items'] else 0
        r['pre'] = pre
    rows.sort(key=lambda r: (-r['pre'], r['filed']))
    rows = rows[: a.lookups]
    print(f'Looking up {len(rows)} issuers in EDGAR...', file=sys.stderr)

    cache_path = a.cache or os.path.join(os.path.dirname(os.path.abspath(a.out)), '.form-d-cache.json')
    try:
        cache = json.load(open(cache_path))
    except (OSError, ValueError):
        cache = {}
    fresh = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    for n, r in enumerate(rows, 1):
        hit = cache.get(r['cik'])
        if not hit or hit.get('fetched', '') < fresh:
            raw = get(SUBMISSIONS.format(int(r['cik'])))
            sub = json.loads(raw) if raw else {}
            biz = (sub.get('addresses') or {}).get('business') or {}
            rec = (sub.get('filings') or {}).get('recent') or {}
            dates = rec.get('filingDate') or []
            forms = rec.get('form') or []
            hit = {
                'phone': re.sub(r'\D', '', sub.get('phone') or ''),
                'address': ', '.join(x for x in [biz.get('street1'), biz.get('street2'), biz.get('city'), biz.get('stateOrCountry'), biz.get('zipCode')] if x),
                'website': sub.get('website') or '',
                'first_sec_filing': min(dates) if dates else r['filed'],
                'form_d_count': sum(1 for f in forms if f in ('D', 'D/A')),
                'fetched': dt.date.today().isoformat(),
            }
            if raw:
                cache[r['cik']] = hit
        r.update({k: v for k, v in hit.items() if k != 'fetched'})
        if a.details:
            r.update(details(r['cik'], r['adsh']))
        if n % 100 == 0:
            print(f'  {n}', file=sys.stderr)
    try:
        json.dump(cache, open(cache_path, 'w'))
    except OSError:
        pass

    # A phone shared by unrelated issuers in several cities belongs to a filing agent, not the sponsor.
    cities = {}
    for r in rows:
        if len(r['phone']) >= 10 and set(r['phone']) != {'0'}:
            cities.setdefault(r['phone'], set()).add(r['location'].lower())
    agents = {p for p, c in cities.items() if len(c) >= 3}
    for r in rows:
        if r['phone'] in agents or len(r['phone']) < 10 or set(r['phone']) == {'0'}:
            r['agent_phone'] = r['phone'] if r['phone'] in agents else ''
            r['phone'] = ''
        r['score'] = r['pre'] + (15 if r['first_sec_filing'] >= start.isoformat() else 0) + (5 if r['phone'] else 0)
        r['edgar'] = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={int(r['cik'])}&type=D&dateb=&owner=include&count=40"
        r['filing'] = f"https://www.sec.gov/Archives/edgar/data/{int(r['cik'])}/{r['adsh'].replace('-', '')}/"

    # One sponsor, many vehicles: group by the sponsor's phone, else its street address.
    def sponsor_key(r):
        if r['phone']:
            return 'p' + r['phone']
        street = r.get('address', '').split(',')[0].strip().lower()
        if street and not re.search(r'\b(?:suite|ste)\b.*\b(?:wilmington|dover|lewes)\b|registered agent|corporation trust|1209 orange', r.get('address', ''), re.I):
            return 'a' + street + r.get('address', '')[-5:]
        return 'n' + re.sub(r'\W+', ' ', r['name'].lower())[:24]
    groups = {}
    for r in rows:
        groups.setdefault(sponsor_key(r), []).append(r)

    def sponsor_name(vs):
        names = [v['name'] for v in vs]
        if len(names) == 1:
            return names[0]
        words = [re.sub(r'[,.]', '', n).split() for n in names]
        common = []
        for i in range(min(len(w) for w in words)):
            if len({w[i].lower() for w in words}) == 1:
                common.append(words[0][i])
            else:
                break
        stem = ' '.join(common).strip()
        return stem if len(stem) >= 4 else names[0]

    def institutional(vs):
        """Large managers with their own fund administrators: many parallel or offshore vehicles, high fund numbers, institution-only funds."""
        n = len(vs)
        open_market = any('06C' in v['items'] for v in vs)
        qp_only = any('3C.7' in v['items'] for v in vs)
        structure = any(STRUCTURE.search(v['name']) for v in vs)
        top_no = max(fund_number(v['name']) for v in vs)
        if n >= 15:
            return True
        if open_market:
            return False
        return n >= 10 or top_no >= 9 or (qp_only and (structure or top_no >= 6 or n >= 5))

    sponsors = []
    dropped = 0
    for vs in groups.values():
        if institutional(vs):
            dropped += 1
            continue
        vs.sort(key=lambda v: (-v['score'], v['filed']))
        top = vs[0]
        cats = sorted({v['category'] for v in vs})
        ex = sorted({x for v in vs for x in v['exemptions'].split(', ') if x})
        why = [f"{len(vs)} new offering{'s' if len(vs) > 1 else ''} filed {min(v['filed'] for v in vs)} to {max(v['filed'] for v in vs)}" if len(vs) > 1 else f"new {top['category'].lower()} offering filed {top['filed']}"]
        if any('06C' in v['items'] for v in vs):
            why.append('Rule 506(c): marketing openly to accredited investors, so many individual investors to serve')
        if any(v['first_sec_filing'] >= start.isoformat() for v in vs):
            why.append('new vehicle being set up now')
        if any(NUMBERED.search(v['name']) for v in vs):
            why.append('numbered fund: a repeat sponsor')
        if any(DEAL_SPV.search(v['name']) for v in vs):
            why.append('includes single-deal vehicles')
        if any('Real estate' == v['category'] for v in vs):
            why.append('real estate: regular distributions and K-1s')
        if any('Oil and gas' == v['category'] for v in vs):
            why.append('oil and gas: monthly distributions')
        sponsors.append({
            'score': max(0, min(100, top['score'] + min(15, 5 * (len(vs) - 1)))),
            'sponsor': sponsor_name(vs),
            'vehicles': len(vs),
            'vehicle_names': '; '.join(v['name'] for v in vs[:8]) + (f'; and {len(vs) - 8} more' if len(vs) > 8 else ''),
            'fund_types': ', '.join(cats),
            'exemptions': ', '.join(ex),
            'latest_filing': max(v['filed'] for v in vs),
            'location': top['location'],
            'state': top['state'],
            'phone': next((v['phone'] for v in vs if v['phone']), ''),
            'address': next((v['address'] for v in vs if v.get('address')), ''),
            'website': next((v['website'] for v in vs if v.get('website')), ''),
            'why': '; '.join(why),
            'offering_amount': top.get('offering_amount', ''),
            'amount_sold': top.get('amount_sold', ''),
            'investors': top.get('investors', ''),
            'minimum': top.get('minimum', ''),
            'related_persons': top.get('related_persons', ''),
            'edgar': top['edgar'],
            'filing': top['filing'],
        })
    sponsors.sort(key=lambda x: (-x['score'], -x['vehicles'], x['latest_filing']), reverse=False)
    sponsors = sponsors[: a.top]
    cols = ['score', 'sponsor', 'vehicles', 'vehicle_names', 'fund_types', 'exemptions', 'latest_filing', 'location', 'state', 'phone', 'address', 'website', 'why', 'offering_amount', 'amount_sold', 'investors', 'minimum', 'related_persons', 'edgar', 'filing']
    with open(a.out, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for x in sponsors:
            w.writerow(x)
    vcols = ['score', 'name', 'category', 'industry', 'exemptions', 'filed', 'location', 'state', 'phone', 'agent_phone', 'address', 'first_sec_filing', 'form_d_count', 'cik', 'edgar', 'filing']
    vout = re.sub(r'(\.csv)?$', '-vehicles.csv', a.out, count=1)
    with open(vout, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=vcols, extrasaction='ignore')
        w.writeheader()
        for r in sorted(rows, key=lambda r: (-r['score'], r['filed'])):
            w.writerow({c: r.get(c, '') for c in vcols})
    print(f'Left out {dropped} institutional sponsors. Wrote {len(sponsors)} sponsors to {a.out} and {len(rows)} vehicles to {vout}', file=sys.stderr)


if __name__ == '__main__':
    main()
