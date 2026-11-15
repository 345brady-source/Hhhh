import os, time, json, hashlib, urllib.parse, requests, fcntl
UA = "SubDocResearch research-bot@example.org"
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setb-work"
CACHE = W + "/cache"
LOCK = W + "/rate.lock"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip, deflate"})
S.verify = "/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else True
MIN_GAP = 0.34  # < 3 req/s

def _wait():
    # cross-process rate limit via lock file holding last request time
    with open(LOCK, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0); s = f.read().strip()
        last = float(s) if s else 0
        now = time.time()
        if now - last < MIN_GAP:
            time.sleep(MIN_GAP - (now - last))
        f.seek(0); f.truncate(); f.write(str(time.time()))
        fcntl.flock(f, fcntl.LOCK_UN)

def get(url, binary=False, cache=True, tries=4):
    key = hashlib.sha1(url.encode()).hexdigest()
    p = os.path.join(CACHE, key)
    if cache and os.path.exists(p):
        data = open(p, "rb").read()
        return data if binary else data.decode("utf-8", "replace")
    for i in range(tries):
        _wait()
        try:
            r = S.get(url, timeout=60)
        except Exception as e:
            time.sleep(2 + 3 * i); continue
        if r.status_code == 200:
            if cache:
                open(p, "wb").write(r.content)
            return r.content if binary else r.content.decode("utf-8", "replace")
        if r.status_code == 404:
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
    return json.loads(t) if t else None

def doc_url(cik, adsh, fn):
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{fn}"

def index_json(cik, adsh):
    t = get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/index.json")
    return json.loads(t) if t else None
