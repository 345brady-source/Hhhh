# Stage-2 look: every page of one candidate as a grid (fetches the remaining page pictures of an HTML exhibit through
# the rate-limited client), to confirm a signature page. usage: python3 -I allpages.py <key> [<key> ...]
import sys, os, json, subprocess, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
W = sec.W; R = W + '/review'
cands = {}
for l in open(W + '/cands.jsonl'):
    r = json.loads(l); cands.setdefault(r['adsh'] + ':' + r['fn'], r)
for j, key in enumerate(sys.argv[1:], 1):
    r = cands[key]; td = os.path.join(R, f'all-{j:02d}'); os.makedirs(td, exist_ok=True)
    for f in glob.glob(td + '/*'): os.remove(f)
    th = []
    if r['ext'] == 'pdf':
        n = min(r['feats']['pages'], 40)
        subprocess.run(['pdftoppm', '-l', str(n), '-r', '30', '-png', os.path.join(r['dir'], 'source.pdf'), os.path.join(td, 'p')], capture_output=True, timeout=300)
        th = sorted(glob.glob(td + '/p*.png'))
    else:
        base = r['url'].rsplit('/', 1)[0] + '/'
        for k, im in enumerate(r['imgs'][:40]):
            p = os.path.join(r['dir'], os.path.basename(im))
            if not os.path.exists(p):
                b = sec.get(base + im, binary=True)
                if b: open(p, 'wb').write(b)
            if os.path.exists(p):
                o = os.path.join(td, f'p{k:03d}.png'); subprocess.run(['convert', p + '[0]', '-resize', '250x325', o], capture_output=True, timeout=60)
                if os.path.exists(o): th.append(o)
    subprocess.run(['montage'] + th + ['-tile', '8x', '-geometry', '250x325+2+2', '-title', key[-40:], '-pointsize', '20', os.path.join(R, f'all-{j:02d}.png')], capture_output=True, timeout=300)
    print(j, key, len(th))
