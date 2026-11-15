import sys, os, numpy as np, pdfplumber, glob
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wbox import components
def img_squares(pdf, imgdir, thr=225, lo=7, hi=16):
    files = sorted(glob.glob(os.path.join(imgdir, 'im-*.png'))); k = 0; out = {}
    for pi, page in enumerate(pdfplumber.open(pdf).pages, 1):
        for im in page.images:
            f = files[k]; k += 1
            a = np.asarray(Image.open(f).convert('L')).astype(int); H, W = a.shape
            sx = (im['x1'] - im['x0']) / W; sy = (im['bottom'] - im['top']) / H
            ink = a < thr
            for x0, y0, x1, y1, n in components(ink):
                w, h = x1 - x0, y1 - y0
                if lo <= w * sx <= hi and lo <= h * sy <= hi and abs(w - h) <= 2:
                    sub = ink[y0:y1, x0:x1]
                    if sub[3:-3, 3:-3].mean() < 0.1 and min(sub[:3].any(axis=0).mean(), sub[-3:].any(axis=0).mean(), sub[:, :3].any(axis=1).mean(), sub[:, -3:].any(axis=1).mean()) > 0.85:
                        out.setdefault(pi, []).append([round(im['x0'] + x0 * sx, 2), round(im['top'] + y0 * sy, 2), round(im['x0'] + x1 * sx, 2), round(im['top'] + y1 * sy, 2)])
    return out
if __name__ == '__main__':
    o = img_squares(sys.argv[1], sys.argv[2])
    for p, L in o.items(): print(p, [[round(v / 0.72) for v in b] for b in L])
