# set-c EDGAR client: the set-b collector's client (same generic identity, 0.34 s minimum gap across
# processes, back-off on 403/429/503, on-disk cache), pointed at setc-work, and every network request
# appended to setc-work/progress.jsonl so a restart resumes from the cache and the log shows each request.
import os, time, json, hashlib, urllib.parse, requests, fcntl
UA = "SubDocResearch research-bot@example.org"
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
CACHE = W + "/cache"
LOCK = W + "/rate.lock"
PROG = W + "/progress.jsonl"
os.makedirs(CACHE, exist_ok=True)
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip, deflate"})
S.verify = "/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else True
MIN_GAP = 0.34  # < 3 req/s

def log(rec):
    rec["t"] = round(time.time(), 2)
    with open(PROG, "a") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(json.dumps(rec) + "\n")
        fcntl.flock(f, fcntl.LOCK_UN)

def _wait():
    with open(LOCK, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0); s = f.read().strip()
        try:
            last = float(s) if s else time.time()
        except ValueError:
            last = time.time()  # unreadable stamp: wait the full gap
        now = time.time()
        if now - last < MIN_GAP:
            time.sleep(MIN_GAP - (now - last))
        f.seek(0); f.truncate(); f.write(str(time.time()))
        f.flush()  # the stamp must be on disk before the lock is released (buffered write raced otherwise)
        fcntl.flock(f, fcntl.LOCK_UN)

def get(url, binary=False, cache=True, tries=4):
    key = hashlib.sha1(url.encode()).hexdigest()
    p = os.path.join(CACHE, key)
    if cache and os.path.exists(p):
        data = open(p, "rb").read()
        return data if binary else data.decode("utf-8", "replace")
    if cache and os.path.exists(p + ".404"):
        return None
    for i in range(tries):
        _wait()
        st = round(time.time(), 3)  # request start, after the shared gap
        try:
            r = S.get(url, timeout=60)
        except Exception as e:
            log({"ev": "req", "url": url, "err": type(e).__name__, "start": st})
            time.sleep(2 + 3 * i); continue
        log({"ev": "req", "url": url, "status": r.status_code, "bytes": len(r.content), "start": st})
        if r.status_code == 200:
            if cache:
                open(p + ".part", "wb").write(r.content); os.replace(p + ".part", p)
            return r.content if binary else r.content.decode("utf-8", "replace")
        if r.status_code == 404:
            if cache: open(p + ".404", "w").close()
            return None
        time.sleep(5 + 10 * i)
    return None

def search(q, forms=None, start=None, end=None, frm=0):
    params = {"q": q}
    if forms: params["forms"] = forms
    if start:
        params.update({"dateRange": "custom", "startdt": start, "enddt": end})
    if frm: params["from"] = frm
    url = "https://efts.sec.gov/LATEST/search-index?" + urllib.parse.urlencode(params)
    t = get(url)
    try:
        return json.loads(t) if t else None
    except Exception:
        return None

def doc_url(cik, adsh, fn):
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{fn}"

def index_htm(cik, adsh):
    return get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{adsh}-index.htm")
