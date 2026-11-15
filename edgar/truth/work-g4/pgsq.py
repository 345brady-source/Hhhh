import os, subprocess, numpy as np, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wbox import components
def page_squares(doc, pdf, pg, dpi=200, lo=5, hi=14):
    base = 'r200/%s-%d' % (doc, pg); os.makedirs('r200', exist_ok=True)
    if not os.path.exists(base + '.png'):
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', pdf, base], check=True)
    a = np.asarray(Image.open(base + '.png').convert('L')).astype(int); k = dpi / 72
    ink = a < 200; out = []
    for x0, y0, x1, y1, n in components(ink):
        w, h = x1 - x0, y1 - y0
        if not (lo * k <= w <= hi * k and lo * k <= h <= hi * k and abs(w - h) <= 3 * k / 2): continue
        sub = ink[y0:y1, x0:x1]
        ctr = sub[3:h - 6, 3:w - 6]
        edges = [sub[:2].any(axis=0).mean(), sub[:, :2].any(axis=1).mean(), sub[-4:].any(axis=0).mean(), sub[:, -4:].any(axis=1).mean()]
        if ctr.size and ctr.mean() < 0.08 and min(edges) > 0.85:
            out.append([round(x0 / k, 2), round(y0 / k, 2), round(x1 / k, 2), round(y1 / k, 2)]); continue
        # shadow-only box: an L of right column + bottom rows
        right = sub[:, -4:].any(axis=1).mean(); bottom = sub[-4:].any(axis=0).mean()
        rest = sub[:h - 6, :w - 6].mean() if h > 8 and w > 8 else 1
        if right > 0.85 and bottom > 0.85 and rest < 0.05:
            out.append([round(x0 / k, 2), round(y0 / k, 2), round(x1 / k, 2), round(y1 / k, 2)])
    return out
if __name__ == '__main__':
    print(page_squares(sys.argv[1], sys.argv[2], int(sys.argv[3])))
