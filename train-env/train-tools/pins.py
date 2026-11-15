"""Read saved PyPI JSON pages and propose pins (read-only, installs nothing).

Usage: python3 -I pins.py <json-dir> <cutoff YYYY-MM-DD> name=researchversion ...
"""
import json
import re
import sys

jdir, cutoff = sys.argv[1], sys.argv[2]
wanted = [a.split("=") for a in sys.argv[3:]]
PRE = re.compile(r"(a|b|rc|dev|post)\d*", re.I)


def first_upload(files):
    ts = [f["upload_time_iso_8601"] for f in files if f.get("upload_time_iso_8601")]
    return min(ts) if ts else None


def wheel_for(files):
    best = None
    for f in files:
        fn = f["filename"]
        if fn.endswith(".whl") and "x86_64" in fn and ("cp313-cp313-" in fn or "abi3" in fn or "py3-none" in fn):
            if "musllinux" in fn:
                continue
            if "manylinux" in fn or "linux" in fn:
                if best is None or "cp313-cp313-" in fn:
                    best = f
    return best


out = []
for name, rver in wanted:
    d = json.load(open(f"{jdir}/{name}.json"))
    info = d["info"]
    rel = d["releases"]
    cands = []
    for v, files in rel.items():
        if not files or PRE.search(v.split("+")[0].replace(".", "")[-6:]) and re.search(r"[a-z]", v):
            continue
        if any(f.get("yanked") for f in files):
            continue
        up = first_upload(files)
        if up and up[:10] <= cutoff:
            cands.append((up, v))
    cands.sort()
    newest_before = cands[-1][1] if cands else None
    rfiles = rel.get(rver) or []
    rup = first_upload(rfiles)
    pin = rver if (rup and rup[:10] <= cutoff) else newest_before
    pfiles = rel[pin]
    pinfo = json.load(open(f"{jdir}/{name}.json"))  # top-level info is for the latest release
    w = wheel_for(pfiles)
    latest = info["version"]
    latest_up = first_upload(rel.get(latest) or [])
    rec = {
        "name": name,
        "research_version": rver,
        "research_version_uploaded": rup,
        "pin": pin,
        "pin_uploaded": first_upload(pfiles),
        "newest_on_or_before_cutoff": newest_before,
        "latest": latest,
        "latest_uploaded": latest_up,
        "license": info.get("license"),
        "license_expression": info.get("license_expression"),
        "classifiers_license": [c for c in info.get("classifiers") or [] if c.startswith("License")],
        "author": info.get("author"),
        "author_email_domain": (info.get("author_email") or "").split("@")[-1].strip("> ") or None,
        "maintainer": info.get("maintainer"),
        "home_page": info.get("home_page"),
        "project_urls": info.get("project_urls"),
        "requires_python": info.get("requires_python"),
        "requires_dist": info.get("requires_dist"),
        "wheel": w and {"filename": w["filename"], "size": w["size"], "sha256": w["digests"]["sha256"], "uploaded": w["upload_time_iso_8601"]},
    }
    out.append(rec)
print(json.dumps(out, indent=1))
