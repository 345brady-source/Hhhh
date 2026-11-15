import time, requests, json, os
UA = "SubDocResearch research-bot@example.org"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Encoding": "gzip, deflate"})
_last = [0.0]
def get(url, tries=4):
    for i in range(tries):
        wait = 0.34 - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            r = S.get(url, timeout=60)
        except Exception as e:
            time.sleep(2 + 3*i); continue
        if r.status_code == 200: return r
        if r.status_code in (403, 429, 503):
            time.sleep(5 + 10*i); continue
        return r
    return None
