"""Generates FinWise PWA icons into public/icons. Run: python3 scripts/generate_icons.py"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)
BRAND, ACCENT, WHITE = (6, 125, 111), (82, 244, 212), (255, 255, 255)

def draw(size, maskable=False, rounded=True):
    s = 4  # supersample
    W = size * s
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, W, W], fill=BRAND)
    else:
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 14 / 64), fill=BRAND)
    # Content box: maskable icons keep artwork inside the 80% safe zone
    pad = W * (0.2 if maskable else 0.0)
    scale = (W - 2 * pad) / 64
    def P(x, y): return (pad + x * scale, pad + y * scale)
    lw = 6 * scale
    for x, y0 in [(16, 30), (26, 24), (36, 32), (46, 18)]:
        a, b = P(x, y0), P(x, 44)
        d.line([a, b], fill=WHITE, width=int(lw))
        for c in (a, b):
            d.ellipse([c[0] - lw / 2, c[1] - lw / 2, c[0] + lw / 2, c[1] + lw / 2], fill=WHITE)
    cx, cy = P(46, 18)
    r = 4 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)

for sz in (192, 512):
    draw(sz).save(os.path.join(OUT, f'icon-{sz}.png'))
    draw(sz, maskable=True).save(os.path.join(OUT, f'maskable-{sz}.png'))
draw(180, rounded=False).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
draw(32).save(os.path.join(OUT, 'favicon-32.png'))
print('icons written to', os.path.abspath(OUT))
