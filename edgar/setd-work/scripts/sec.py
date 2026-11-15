# set-d EDGAR client. One collection process only. Generic identity, in-process rate limiter (0.34 s minimum gap
# between request starts = under 3 requests/second) AND the fixed cross-process file lock (stamp flushed before
# unlock) so that even a stray second process cannot push the rate over 3/s. Back-off on 403/429/503, on-disk
# cache (setd-work/cache), read-through of the set-c cache (no request is repeated), every request logged to
# setd-work/progress.jsonl with its start time.
import os, time, json, hashlib, urllib.parse, requests, fcntl
UA = "SubDocResearch research-bot@example.org"
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work"
CACHE = W + "/cache"
OLDCACHE = os.path.dirname(W) + "/setc-work/cache"   # read-only
LOCK = W + "/rate.lock"
PROG = W + "/progress.jsonl"
os.makedirs(CACHE, exist_ok=True)
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip, deflate"})
S.verify = "/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else True
MIN_GAP = 0.34
_last = [0.0]
NREQ = [0]

def log(rec):
    rec["t"] = round(time.time(), 2)
    with open(PROG, "a") as f:
        f.write(json.dumps(rec) + "\n")

def _wait():
    # in-process gap
    d = time.time() - _last[0]
    if d < MIN_GAP: time.sleep(MIN_GAP - d)
    # cross-process gap (fixed lock)
    with open(LOCK, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0); s = f.read().strip()
        try: last = float(s) if s else 0.0
        except ValueError: last = time.time()
        now = time.time()
        if now - last < MIN_GAP: time.sleep(MIN_GAP - (now - last))
        _last[0] = time.time()
        f.seek(0); f.truncate(); f.write(str(_last[0])); f.flush(); os.fsync(f.fileno())
        fcntl.flock(f, fcntl.LOCK_UN)

def cached(url):
    key = hashlib.sha1(url.encode()).hexdigest()
    for c in (CACHE, OLDCACHE):
        p = os.path.join(c, key)
        if os.path.exists(p): return p
    return None

def get(url, binary=False, tries=4):
    key = hashlib.sha1(url.encode()).hexdigest()
    p = cached(url)
    if p:
        data = open(p, "rb").read()
        return data if binary else data.decode("utf-8", "replace")
    if os.path.exists(os.path.join(CACHE, key) + ".404") or os.path.exists(os.path.join(OLDCACHE, key) + ".404"):
        return None
    p = os.path.join(CACHE, key)
    for i in range(tries):
        _wait()
        st = round(_last[0], 3); NREQ[0] += 1
        try:
            r = S.get(url, timeout=90)
        except Exception as e:
            log({"ev": "req", "url": url, "err": type(e).__name__, "start": st})
            time.sleep(2 + 3 * i); continue
        log({"ev": "req", "url": url, "status": r.status_code, "bytes": len(r.content), "start": st})
        if r.status_code == 200:
            open(p + ".part", "wb").write(r.content); os.replace(p + ".part", p)
            return r.content if binary else r.content.decode("utf-8", "replace")
        if r.status_code == 404:
            open(p + ".404", "w").close(); return None
        time.sleep(5 + 10 * i)
    return None

def search(q, forms=None, start=None, end=None, frm=0):
    params = {"q": q}
    if forms: params["forms"] = forms
    if start: params.update({"dateRange": "custom", "startdt": start, "enddt": end})
    if frm: params["from"] = frm
    t = get("https://efts.sec.gov/LATEST/search-index?" + urllib.parse.urlencode(params))
    try: return json.loads(t) if t else None
    except Exception: return None

def doc_url(cik, adsh, fn):
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{fn}"

def index_url(cik, adsh):
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{adsh}-index.htm"

def index_htm(cik, adsh):
    return get(index_url(cik, adsh))
