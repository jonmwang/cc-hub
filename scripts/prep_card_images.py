"""Normalise the user's card images for the web.

Sources vary wildly: different formats, sizes, aspect ratios, and several carry
a white or transparent margin around a card that already has rounded corners.
Rendering those as-is gives the "weird border" look.

For each image:
  1. Trim any uniform border (white, near-white, or transparent).
  2. Cover-crop to the real credit-card ratio (1.586) so every card matches.
  3. Round the corners in the alpha channel, so the page can use drop-shadow
     and get a shadow that hugs the card instead of a rectangle behind it.
  4. Save as WebP with alpha.
"""

from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'card images')
OUT = os.path.join(ROOT, 'public', 'cards')

MAPPING = {
    'card_freedomFlex_MC.webp': 'chase_freedom_flex',
    'card_freedomUtld_V.avif': 'chase_freedom_unlimited',
    'sapphire-preferredcard2026.png': 'chase_sapphire_preferred',
    '565192b2-c5cc-4edc-89ae-b8bba7a63750.webp': 'chase_sapphire_reserve',
    'white-gold-amex-card.png': 'amex_gold',
    'e6901d88-1a35-4373-b3e1-9a2a445490a0.png': 'amex_platinum',
    '73e79a4a-2cdd-4bf0-abd8-fd194139ebae.png': 'c1_venture_x',
    'd950b9f0-9598-11f1-a59a-dd0fb44348a0.webp': 'c1_savor',
    'images.jpg': 'discover_it',
    'wfauto.jpg': 'wf_autograph',
}

RATIO = 1.586
TARGET_W = 560
TARGET_H = round(TARGET_W / RATIO)
CORNER = 0.055  # fraction of width; matches a real card's corner radius


def is_bg(px, bg, tol=14):
    if px[3] < 24:                      # effectively transparent
        return True
    if bg is None:
        return False
    return all(abs(px[i] - bg[i]) <= tol for i in range(3)) and px[3] > 200


def trim(img):
    """Remove a uniform border, judged from the four corners."""
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]

    opaque = [c for c in corners if c[3] >= 24]
    if opaque:
        # Only treat it as a border if all opaque corners agree.
        first = opaque[0]
        if not all(all(abs(c[i] - first[i]) <= 14 for i in range(3)) for c in opaque):
            return img, 'corners disagree — not trimmed'
        bg = first[:3]
    else:
        bg = None  # fully transparent border

    def row_is_bg(y):
        return all(is_bg(px[x, y], bg) for x in range(w))

    def col_is_bg(x):
        return all(is_bg(px[x, y], bg) for y in range(h))

    top = 0
    while top < h - 1 and row_is_bg(top):
        top += 1
    bottom = h - 1
    while bottom > top and row_is_bg(bottom):
        bottom -= 1
    left = 0
    while left < w - 1 and col_is_bg(left):
        left += 1
    right = w - 1
    while right > left and col_is_bg(right):
        right -= 1

    if (left, top, right, bottom) == (0, 0, w - 1, h - 1):
        return img, 'no border found'

    return img.crop((left, top, right + 1, bottom + 1)), f'trimmed {left}L {top}T {w-1-right}R {h-1-bottom}B'


def cover_crop(img, ratio):
    w, h = img.size
    cur = w / h
    if abs(cur - ratio) < 0.005:
        return img
    if cur > ratio:                      # too wide -> trim sides
        new_w = round(h * ratio)
        off = (w - new_w) // 2
        return img.crop((off, 0, off + new_w, h))
    new_h = round(w / ratio)             # too tall -> trim top/bottom
    off = (h - new_h) // 2
    return img.crop((0, off, w, off + new_h))


def round_corners(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1],
                                           radius=radius, fill=255)
    out = img.copy()
    # Keep any existing transparency as well as the new rounded mask.
    existing = out.getchannel('A')
    mask = Image.composite(mask, Image.new('L', img.size, 0), existing.point(lambda v: 255 if v > 24 else 0))
    out.putalpha(mask)
    return out


os.makedirs(OUT, exist_ok=True)
print(f'{"card":30} {"source size":>13}  {"trim":34} {"final":>11}  bytes')
print('-' * 104)

for src_name, card_id in MAPPING.items():
    path = os.path.join(SRC, src_name)
    img = Image.open(path).convert('RGBA')
    before = f'{img.size[0]}x{img.size[1]}'

    img, note = trim(img)
    img = cover_crop(img, RATIO)
    img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    img = round_corners(img, round(TARGET_W * CORNER))

    dest = os.path.join(OUT, f'{card_id}.webp')
    img.save(dest, 'WEBP', quality=90, method=6)
    size = os.path.getsize(dest)
    print(f'{card_id:30} {before:>13}  {note:34} {TARGET_W}x{TARGET_H}  {size/1024:6.1f} KB')

print('\nwrote', len(MAPPING), 'files to', OUT)


# ── Merchant logos ───────────────────────────────────────────────────────────
# Same idea as the cards: sources arrive as a logo floating in a big white
# rectangle. Trimmed and padded to a transparent square so it drops into the
# round icon tile on Quick Picks without a white block around it.

LOGO_SRC = os.path.join(ROOT, 'other images')
LOGO_OUT = os.path.join(ROOT, 'public', 'logos')
LOGO_SIZE = 192


def prep_logos():
    if not os.path.isdir(LOGO_SRC):
        return
    os.makedirs(LOGO_OUT, exist_ok=True)
    print(f'\n{"logo":24} {"source":>13}  {"trim":30} {"final":>10}  bytes')
    print('-' * 92)

    for name in sorted(os.listdir(LOGO_SRC)):
        if name.startswith('.'):
            continue
        path = os.path.join(LOGO_SRC, name)
        try:
            img = Image.open(path).convert('RGBA')
        except Exception:
            continue
        before = f'{img.size[0]}x{img.size[1]}'
        img, note = trim(img)

        # Pad the trimmed logo to a square, centred, on transparency, leaving a
        # little breathing room so it isn't flush to the tile edge.
        w, h = img.size
        side = max(w, h)
        pad = round(side * 0.08)
        canvas = Image.new('RGBA', (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
        canvas.paste(img, ((canvas.size[0] - w) // 2, (canvas.size[1] - h) // 2), img)
        canvas = canvas.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS)

        stem = os.path.splitext(name)[0].lower().replace(' ', '-')
        dest = os.path.join(LOGO_OUT, f'{stem}.webp')
        canvas.save(dest, 'WEBP', quality=92, method=6)
        print(f'{stem:24} {before:>13}  {note:30} {LOGO_SIZE}x{LOGO_SIZE}  {os.path.getsize(dest)/1024:6.1f} KB')


prep_logos()
