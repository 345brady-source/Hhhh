"""Write a pip --require-hashes file from saved per-version PyPI JSON pages.

Usage: python3 -I hashed.py <dir-with-NAME_VERSION.json> <torch-wheel-path> <torch-sha256> > out.txt
"""
import glob
import json
import os
import sys

jdir, torch_whl, torch_sha = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
for f in sorted(glob.glob(os.path.join(jdir, "*.json"))):
    d = json.load(open(f))
    name, ver = d["info"]["name"], d["info"]["version"]
    if name.lower() == "torch":
        continue
    hashes = sorted({u["digests"]["sha256"] for u in d["urls"]})
    lines.append(f"{name}=={ver} " + " ".join(f"--hash=sha256:{h}" for h in hashes))
lines.append(f"torch @ file://{torch_whl} --hash=sha256:{torch_sha}")
print("\n".join(lines))
