"""Newest final, non-yanked release on or before a cutoff for each saved PyPI JSON page.

Usage: python3 -I deps.py <json-dir> <cutoff YYYY-MM-DD>
Prints a tab-separated line per package: name, pin, uploaded, licence, homepage, linux wheel size.
"""
import glob
import json
import os
import re
import sys

jdir, cutoff = sys.argv[1], sys.argv[2]
FINAL = re.compile(r"^\d+(\.\d+)*$")


def key(v):
    return tuple(int(x) for x in v.split("."))


for f in sorted(glob.glob(os.path.join(jdir, "*.json"))):
    d = json.load(open(f))
    best = None
    for v, files in d["releases"].items():
        if not files or not FINAL.match(v) or any(x.get("yanked") for x in files):
            continue
        up = min(x["upload_time_iso_8601"] for x in files)
        if up[:10] <= cutoff and (best is None or key(v) > key(best[0])):
            best = (v, up[:10], files)
    v, up, files = best
    info = d["info"]  # latest release info; licence rarely changes between releases
    lic = info.get("license_expression") or (info.get("license") or "").split("\n")[0][:60]
    if not lic:
        lic = ";".join(c.split("::")[-1].strip() for c in info.get("classifiers") or [] if c.startswith("License"))
    urls = info.get("project_urls") or {}
    home = info.get("home_page") or next((u for k, u in urls.items() if k.lower() in ("homepage", "home", "source", "repository", "source code")), "")
    whl = [x for x in files if x["filename"].endswith(".whl") and ("none-any" in x["filename"] or ("cp313-cp313-" in x["filename"] or "abi3" in x["filename"]) and "x86_64" in x["filename"] and "manylinux" in x["filename"])]
    size = max((x["size"] for x in whl), default=0)
    print(f"{info['name']}\t{v}\t{up}\t{lic}\t{home}\t{size}\tlatest={info['version']}")
