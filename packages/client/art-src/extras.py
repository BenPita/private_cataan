"""Sea frame, resource cards, development card art and card backs."""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import terrain
from common import SQRT3, apply_shade, fbm, hillshade, jitter, ramp, rng, shaded_ellipse, shadow_blob, to_image

# Board geometry (must match packages/client/src/game/Board.tsx: S = 60, viewBox 10.6 * S).
S = 60
VIEW = 10.6 * S
SEA_PX = 1400
K = SEA_PX / VIEW


def hex_centers():
    out = []
    for r in range(-2, 3):
        for q in range(-2, 3):
            if abs(-q - r) <= 2:
                out.append((SQRT3 * (q + r / 2) * S, 1.5 * r * S))
    return out


def sea_frame(path):
    n = SEA_PX
    land = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(land)
    for x, y in hex_centers():
        cx, cy = n / 2 + x * K, n / 2 + y * K
        rr = S * K * 1.02
        d.polygon([(cx + rr * math.cos(math.radians(60 * i - 90)), cy + rr * math.sin(math.radians(60 * i - 90))) for i in range(6)], fill=255)
    land_m = np.array(land) > 0
    dist = ndimage.distance_transform_edt(~land_m) / (S * K)  # in hex radii
    wobble = (fbm(n, n, 77, 5, 6) - 0.5) * 0.22
    dd = dist + wobble

    deep = np.array([18, 104, 140], np.float32)
    mid = np.array([30, 146, 176], np.float32)
    shallow = np.array([96, 206, 214], np.float32)
    sand = np.array([234, 210, 150], np.float32)
    wet = np.array([206, 182, 124], np.float32)

    t_sh = np.clip(dd / 1.1, 0, 1)[..., None]
    water = shallow * (1 - t_sh) + mid * t_sh
    t_deep = np.clip((dd - 1.1) / 2.0, 0, 1)[..., None]
    water = water * (1 - t_deep) + deep * t_deep
    ripple = fbm(n, n, 91, 6, 10)
    water *= (0.9 + ripple[..., None] * 0.2)
    # Foam bands parallel to the coast
    foam = np.clip(np.sin(dd * 26 - ripple * 6) * 1.2 - 0.85, 0, 1) * np.clip(1 - dd / 0.9, 0, 1)
    water = water * (1 - foam[..., None] * 0.55) + 255 * foam[..., None] * 0.55

    beach = (dd < 0.2)
    sand_tex = ramp(fbm(n, n, 55, 6, 12), [(0, (220, 194, 132)), (1, (244, 224, 170))])
    wet_t = np.clip((dd - 0.12) / 0.08, 0, 1)[..., None]
    beach_col = sand_tex * (1 - wet_t) + wet * wet_t
    rgb = np.where(beach[..., None], beach_col, water)
    rgb = np.where(land_m[..., None], sand_tex * 0.95, rgb)  # under the tiles: sandy gaps between hexes

    img = to_image(rgb).convert('RGBA')
    # Coastal rocks
    r = rng(5)
    ys, xs = np.nonzero((dd > 0.14) & (dd < 0.3))
    for i in r.choice(len(xs), 70, replace=False):
        shaded_ellipse(img, xs[i], ys[i], 6 + r.random() * 6, 4 + r.random() * 4, (120, 112, 100), 1.35, 0.55, 3)
    # Fade outer edge to the page's deep sea colour.
    yy, xx = np.mgrid[0:n, 0:n]
    rad = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
    alpha = np.clip((1.02 - rad) / 0.1, 0, 1)
    arr = np.array(img)
    arr[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', quality=80, method=6)


# --------------------------------------------------------------------------
# Cards
CARD = (360, 504)  # supersampled; saved at half size


def card_base(art, frame=(243, 230, 196), line=(120, 90, 50)):
    w, h = CARD
    img = Image.new('RGBA', (w, h), frame + (255,))
    d = ImageDraw.Draw(img)
    tex = ramp(fbm(h, w, 3, 5, 8), [(0, (232, 216, 178)), (1, (250, 240, 214))])
    img = to_image(tex).convert('RGBA')
    d = ImageDraw.Draw(img)
    m = 18
    box = (m, m, w - m, h - m)
    art = art.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
    img.alpha_composite(art, (box[0], box[1]))
    d.rectangle(box, outline=line + (255,), width=4)
    d.rectangle((6, 6, w - 7, h - 7), outline=(200, 172, 112, 255), width=3)
    return img


def terrain_crop(name, seed):
    terrain.RAW[0] = True
    img = terrain.TERRAINS[name](seed)
    terrain.RAW[0] = False
    w, h = img.size
    cw, ch = int(w * 0.8), int(w * 0.8 * 1.4)
    ch = min(ch, h)
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    return img.crop((x0, y0, x0 + cw, y0 + ch))


def hero_logs(img):
    w, h = img.size
    cx, cy = w / 2, h * 0.6
    shadow_blob(img, (cx + 20, cy + 90), 170, 40, 120, 8)
    d = ImageDraw.Draw(img)
    for row in range(3):
        for i in range(4 - row):
            lx = cx - 120 + i * 80 + row * 40
            ly = cy + 50 - row * 54
            d.rounded_rectangle([lx - 40, ly - 26, lx + 30, ly + 26], 24, fill=(112, 70, 34, 255), outline=(52, 30, 12, 255), width=5)
            d.line([lx - 34, ly - 12, lx + 20, ly - 12], fill=(150, 100, 52, 255), width=4)
            d.ellipse([lx + 6, ly - 26, lx + 50, ly + 26], fill=(226, 186, 128, 255), outline=(62, 36, 14, 255), width=5)
            for rr in (14, 7):
                d.ellipse([lx + 28 - rr, ly - rr, lx + 28 + rr, ly + rr], outline=(176, 124, 66, 255), width=3)


def hero_bricks(img):
    w, h = img.size
    cx, cy = w / 2, h * 0.66
    shadow_blob(img, (cx + 20, cy + 50), 180, 40, 120, 8)
    d = ImageDraw.Draw(img)
    r = rng(9)
    for row in range(5):
        n = 5 - row
        for i in range(n):
            x0 = cx - n * 36 + i * 72
            y0 = cy - row * 40
            base = jitter((186, 74, 36), r, 18)
            d.rectangle([x0, y0 - 36, x0 + 68, y0], fill=base + (255,), outline=(92, 34, 14, 255), width=4)
            d.line([x0 + 5, y0 - 30, x0 + 62, y0 - 30], fill=tuple(min(255, int(c * 1.3)) for c in base) + (255,), width=5)
            d.line([x0 + 5, y0 - 4, x0 + 62, y0 - 4], fill=tuple(int(c * 0.7) for c in base) + (255,), width=4)


def hero_sheep(img):
    w, h = img.size
    terrain.sheep(img, rng(3), w * 0.42, h * 0.62, 4.2)


def hero_wheat(img):
    w, h = img.size
    cx, cy = w / 2, h * 0.86
    shadow_blob(img, (cx + 30, cy), 120, 26, 120, 8)
    d = ImageDraw.Draw(img)
    r = rng(4)
    for k in range(-7, 8):
        ang = -math.pi / 2 + k * 0.07
        top = (cx + math.cos(ang) * 360, cy + math.sin(ang) * 360)
        d.line([cx, cy, top[0], top[1]], fill=(170, 130, 40, 255), width=6)
        for j in range(7):
            t = 0.62 + j * 0.055
            px, py = cx + math.cos(ang) * 360 * t, cy + math.sin(ang) * 360 * t
            for side in (-1, 1):
                col = jitter((236, 190, 64), r, 16)
                d.ellipse([px + side * 9 - 8, py - 13, px + side * 9 + 8, py + 13], fill=col + (255,), outline=(150, 108, 28, 255), width=2)
    d.rectangle([cx - 46, cy - 120, cx + 46, cy - 96], fill=(196, 150, 70, 255), outline=(110, 74, 24, 255), width=4)


def hero_ore(img):
    w, h = img.size
    cx, cy = w / 2, h * 0.62
    shadow_blob(img, (cx + 20, cy + 110), 170, 40, 130, 8)
    d = ImageDraw.Draw(img)
    pts = [(cx - 150, cy + 100), (cx - 110, cy - 40), (cx - 20, cy - 110), (cx + 100, cy - 70), (cx + 160, cy + 60), (cx + 40, cy + 120)]
    d.polygon(pts, fill=(110, 116, 126, 255), outline=(48, 52, 58, 255))
    d.polygon([(cx - 110, cy - 40), (cx - 20, cy - 110), (cx - 10, cy + 10), (cx - 120, cy + 40)], fill=(170, 176, 186, 255))
    d.polygon([(cx - 20, cy - 110), (cx + 100, cy - 70), (cx + 60, cy + 20), (cx - 10, cy + 10)], fill=(140, 146, 156, 255))
    d.polygon([(cx - 10, cy + 10), (cx + 60, cy + 20), (cx + 160, cy + 60), (cx + 40, cy + 120), (cx - 150, cy + 100), (cx - 120, cy + 40)], fill=(92, 96, 106, 255))
    for x, y in [(cx - 40, cy + 50), (cx + 70, cy + 70), (cx - 90, cy + 70), (cx + 20, cy - 40)]:
        d.ellipse([x - 9, y - 6, x + 9, y + 6], fill=(232, 204, 92, 255))
        d.ellipse([x - 3, y - 3, x + 1, y], fill=(255, 250, 210, 255))


RESOURCES = {
    'lumber': ('forest', hero_logs),
    'brick': ('hills', hero_bricks),
    'wool': ('pasture', hero_sheep),
    'grain': ('fields', hero_wheat),
    'ore': ('mountains', hero_ore),
}


def resource_card(name, path):
    terr, hero = RESOURCES[name]
    art = terrain_crop(terr, 4000 + sum(map(ord, name)))
    # Soften the background so the hero object reads first.
    art = art.filter(ImageFilter.GaussianBlur(3))
    veil = Image.new('RGBA', art.size, (255, 246, 220, 60))
    art.alpha_composite(veil)
    hero(art)
    card = card_base(art)
    card.resize((CARD[0] // 2, CARD[1] // 2), Image.LANCZOS).save(path, 'WEBP', quality=86, method=6)


# --------------------------------------------------------------------------
# Development card illustrations (title is rendered as text in the UI)
ART = (480, 360)


def sky_and_hills(seed, sky=((126, 182, 222), (236, 214, 170)), hills=((96, 140, 60), (70, 110, 46))):
    w, h = ART
    yy = np.linspace(0, 1, h)[:, None]
    top, bottom = np.array(sky[0]), np.array(sky[1])
    rgb = np.repeat((top * (1 - yy) + bottom * yy)[:, None, :].reshape(h, 1, 3), w, axis=1).astype(np.float32)
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    r = rng(seed)
    for layer, col in enumerate(hills):
        base_y = h * (0.62 + layer * 0.14)
        pts = [(0, h)]
        for x in range(0, w + 20, 20):
            pts.append((x, base_y - 26 * math.sin(x / (90 + layer * 40) + seed + layer) - r.random() * 6))
        pts.append((w, h))
        d.polygon(pts, fill=col + (255,))
    return img


def dev_knight(path):
    img = sky_and_hills(1)
    w, h = ART
    d = ImageDraw.Draw(img)
    cx, cy = w / 2, h * 0.52
    shadow_blob(img, (cx + 14, cy + 120), 110, 20, 110, 6)
    # Shield
    shield = [(cx - 90, cy - 110), (cx + 90, cy - 110), (cx + 90, cy + 10), (cx, cy + 120), (cx - 90, cy + 10)]
    d.polygon(shield, fill=(40, 86, 160, 255), outline=(30, 30, 40, 255))
    d.polygon([(cx - 90, cy - 110), (cx, cy - 110), (cx, cy + 120), (cx - 90, cy + 10)], fill=(56, 110, 196, 255))
    d.line([cx - 90, cy - 110, cx + 90, cy - 110, cx + 90, cy + 10, cx, cy + 120, cx - 90, cy + 10, cx - 90, cy - 110], fill=(214, 176, 74, 255), width=10)
    # Crossed swords behind
    for sgn in (-1, 1):
        d.line([cx - 150 * sgn, cy - 150, cx + 140 * sgn, cy + 140], fill=(206, 212, 220, 255), width=14)
        d.line([cx - 150 * sgn, cy - 150, cx + 140 * sgn, cy + 140], fill=(150, 158, 170, 255), width=4)
        d.line([cx + 96 * sgn, cy + 70, cx + 150 * sgn, cy + 20], fill=(150, 108, 40, 255), width=14)
    # Emblem: tower
    d.rectangle([cx - 26, cy - 60, cx + 26, cy + 40], fill=(236, 226, 196, 255))
    for k in range(3):
        d.rectangle([cx - 26 + k * 20, cy - 74, cx - 14 + k * 20, cy - 60], fill=(236, 226, 196, 255))
    d.rectangle([cx - 9, cy + 10, cx + 9, cy + 40], fill=(60, 40, 24, 255))
    img.save(path, 'WEBP', quality=86, method=6)


def dev_vp(path):
    img = sky_and_hills(2, sky=((240, 196, 120), (250, 232, 190)))
    w, h = ART
    d = ImageDraw.Draw(img)
    cx, base = w / 2, h * 0.7
    shadow_blob(img, (cx + 20, base + 6), 150, 20, 110, 6)
    # A grand hall with towers and a banner
    d.rectangle([cx - 120, base - 120, cx + 120, base], fill=(222, 206, 170, 255), outline=(110, 80, 50, 255), width=4)
    d.polygon([(cx - 140, base - 120), (cx, base - 200), (cx + 140, base - 120)], fill=(170, 60, 40, 255), outline=(90, 30, 20, 255))
    for tx in (cx - 150, cx + 120):
        d.rectangle([tx, base - 170, tx + 30, base], fill=(206, 190, 154, 255), outline=(110, 80, 50, 255), width=3)
        d.polygon([(tx - 8, base - 170), (tx + 15, base - 214), (tx + 38, base - 170)], fill=(150, 50, 32, 255))
    for k in range(4):
        x = cx - 90 + k * 54
        d.rectangle([x, base - 90, x + 22, base - 40], fill=(70, 50, 30, 255))
    d.rectangle([cx - 20, base - 60, cx + 20, base], fill=(90, 56, 28, 255))
    d.line([cx, base - 200, cx, base - 260], fill=(80, 60, 40, 255), width=5)
    d.polygon([(cx, base - 260), (cx + 60, base - 246), (cx, base - 232)], fill=(226, 180, 40, 255))
    img.save(path, 'WEBP', quality=86, method=6)


def dev_roads(path):
    img = sky_and_hills(3)
    w, h = ART
    d = ImageDraw.Draw(img)
    pts = [(w * 0.5 + math.sin(t * 3) * 90 * (1 - t), h * (0.98 - t * 0.42)) for t in np.linspace(0, 1, 60)]
    for i, (x, y) in enumerate(pts):
        rr = 70 * (1 - i / 70)
        d.ellipse([x - rr, y - rr * 0.32, x + rr, y + rr * 0.32], fill=(196, 160, 104, 255))
    # Cart with planks
    cx, cy = w * 0.36, h * 0.8
    shadow_blob(img, (cx + 20, cy + 40), 90, 16, 110, 5)
    d.rectangle([cx - 80, cy - 30, cx + 70, cy + 14], fill=(140, 92, 46, 255), outline=(70, 42, 18, 255), width=4)
    for k in range(3):
        d.rectangle([cx - 90, cy - 54 + k * 9, cx + 90, cy - 46 + k * 9], fill=(196, 146, 84, 255), outline=(90, 56, 24, 255), width=2)
    for wx in (cx - 50, cx + 40):
        d.ellipse([wx - 24, cy - 2, wx + 24, cy + 46], fill=(90, 58, 28, 255), outline=(40, 24, 10, 255), width=4)
        d.ellipse([wx - 6, cy + 16, wx + 6, cy + 28], fill=(40, 24, 10, 255))
    img.save(path, 'WEBP', quality=86, method=6)


def dev_invention(path):
    w, h = ART
    tex = ramp(fbm(h, w, 8, 5, 6), [(0, (120, 78, 40)), (1, (160, 110, 60))])
    img = to_image(tex).convert('RGBA')
    d = ImageDraw.Draw(img)
    for y in range(0, h, 26):
        d.line([0, y, w, y + 6], fill=(100, 62, 30, 255), width=2)
    # Scroll with a drawing
    shadow_blob(img, (w * 0.45 + 14, h * 0.6 + 20), 160, 70, 110, 8)
    d.rounded_rectangle([w * 0.12, h * 0.22, w * 0.72, h * 0.86], 18, fill=(244, 232, 200, 255), outline=(150, 120, 80, 255), width=4)
    for k in range(5):
        d.line([w * 0.18, h * (0.34 + k * 0.1), w * 0.5, h * (0.34 + k * 0.1)], fill=(140, 110, 70, 255), width=4)
    d.ellipse([w * 0.5, h * 0.3, w * 0.66, h * 0.5], outline=(80, 60, 40, 255), width=4)
    # Gear
    gx, gy, gr = w * 0.8, h * 0.4, 52
    for k in range(10):
        a = k * math.pi / 5
        d.rectangle([gx + math.cos(a) * gr - 10, gy + math.sin(a) * gr - 10, gx + math.cos(a) * gr + 10, gy + math.sin(a) * gr + 10], fill=(196, 160, 70, 255))
    shaded_ellipse(img, gx, gy, gr, gr, (210, 170, 70))
    d.ellipse([gx - 14, gy - 14, gx + 14, gy + 14], fill=(120, 78, 40, 255))
    # Quill
    d.line([w * 0.7, h * 0.92, w * 0.92, h * 0.6], fill=(60, 40, 24, 255), width=5)
    d.polygon([(w * 0.92, h * 0.6), (w * 0.82, h * 0.66), (w * 0.95, h * 0.5)], fill=(250, 250, 244, 255))
    img.save(path, 'WEBP', quality=86, method=6)


def dev_monopoly(path):
    w, h = ART
    tex = ramp(fbm(h, w, 12, 5, 6), [(0, (110, 70, 36)), (1, (150, 100, 54))])
    img = to_image(tex).convert('RGBA')
    d = ImageDraw.Draw(img)
    # Market awning
    for k in range(8):
        col = (196, 52, 40) if k % 2 == 0 else (244, 232, 204)
        d.polygon([(k * w / 8, 0), ((k + 1) * w / 8, 0), ((k + 1) * w / 8, h * 0.22), (k * w / 8 + w / 16, h * 0.28), (k * w / 8, h * 0.22)], fill=col + (255,))
    # Sacks and coins
    for sx, sy, col in [(w * 0.28, h * 0.7, (196, 166, 110)), (w * 0.72, h * 0.72, (186, 156, 100))]:
        shadow_blob(img, (sx + 16, sy + 60), 80, 16, 110, 5)
        shaded_ellipse(img, sx, sy, 76, 70, col)
        d.rectangle([sx - 20, sy - 82, sx + 20, sy - 64], fill=(120, 90, 50, 255))
    r = rng(2)
    for k in range(26):
        x, y = w * 0.5 + (r.random() - 0.5) * 120, h * 0.84 - r.random() * 20 - (k % 8) * 9
        d.ellipse([x - 22, y - 8, x + 22, y + 8], fill=(232, 186, 50, 255), outline=(150, 108, 20, 255), width=3)
    img.save(path, 'WEBP', quality=86, method=6)


def card_back(path, color, emblem):
    w, h = CARD
    tex = ramp(fbm(h, w, 21, 5, 8), [(0, tuple(int(c * 0.85) for c in color)), (1, color)])
    img = to_image(tex).convert('RGBA')
    d = ImageDraw.Draw(img)
    d.rectangle((14, 14, w - 15, h - 15), outline=emblem + (255,), width=5)
    d.rectangle((26, 26, w - 27, h - 27), outline=emblem + (160,), width=2)
    cx, cy, rr = w / 2, h / 2, 90
    pts = [(cx + rr * math.cos(math.radians(60 * i - 90)), cy + rr * math.sin(math.radians(60 * i - 90))) for i in range(6)]
    d.polygon(pts, outline=emblem + (255,), width=8)
    rr2 = 52
    pts2 = [(cx + rr2 * math.cos(math.radians(60 * i - 90)), cy + rr2 * math.sin(math.radians(60 * i - 90))) for i in range(6)]
    d.polygon(pts2, fill=emblem + (255,))
    img.resize((w // 2, h // 2), Image.LANCZOS).save(path, 'WEBP', quality=86, method=6)


def wood(path):
    w, h = 900, 520
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n = fbm(h, w, 31, 5, 3)
    grain = np.sin(yy * 0.09 + n * 14 + np.sin(xx * 0.004) * 3) * 0.5 + 0.5
    fine = fbm(h, w, 32, 6, 40)
    v = grain * 0.6 + fine * 0.4
    rgb = ramp(v, [(0, (74, 42, 18)), (0.5, (108, 66, 32)), (1, (138, 90, 46))])
    # Plank seams
    for y in (170, 350):
        rgb[y - 2:y + 2] *= 0.45
    to_image(rgb).save(path, 'WEBP', quality=78, method=6)


def parchment(path):
    w, h = 600, 600
    n = fbm(h, w, 41, 6, 5)
    rgb = ramp(n, [(0, (236, 220, 180)), (0.6, (246, 234, 202)), (1, (252, 244, 220))])
    yy, xx = np.mgrid[0:h, 0:w]
    vign = 1 - 0.08 * ((np.hypot(xx - w / 2, yy - h / 2) / (w / 2)) ** 2)
    to_image(rgb * vign[..., None]).save(path, 'WEBP', quality=78, method=6)


def build(out_dir, only=None):
    jobs = {
        'sea': lambda: sea_frame(os.path.join(out_dir, 'sea.webp')),
        **{f'card-{n}': (lambda n=n: resource_card(n, os.path.join(out_dir, f'card-{n}.webp'))) for n in RESOURCES},
        'dev-knight': lambda: dev_knight(os.path.join(out_dir, 'dev-knight.webp')),
        'dev-victoryPoint': lambda: dev_vp(os.path.join(out_dir, 'dev-victoryPoint.webp')),
        'dev-roadBuilding': lambda: dev_roads(os.path.join(out_dir, 'dev-roadBuilding.webp')),
        'dev-yearOfPlenty': lambda: dev_invention(os.path.join(out_dir, 'dev-yearOfPlenty.webp')),
        'dev-monopoly': lambda: dev_monopoly(os.path.join(out_dir, 'dev-monopoly.webp')),
        'back-resource': lambda: card_back(os.path.join(out_dir, 'back-resource.webp'), (236, 220, 180), (176, 140, 80)),
        'wood': lambda: wood(os.path.join(out_dir, 'wood.webp')),
        'parchment': lambda: parchment(os.path.join(out_dir, 'parchment.webp')),
        'back-dev': lambda: card_back(os.path.join(out_dir, 'back-dev.webp'), (176, 64, 48), (236, 196, 110)),
    }
    for key, job in jobs.items():
        if only and not key.startswith(only):
            continue
        job()
        print('wrote', key)
