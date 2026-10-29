"""Painted terrain hex tiles (forest, hills, pasture, fields, mountains, desert)."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from common import (
    SQRT3, apply_shade, fbm, hex_mask, hillshade, jitter, poisson_points, ramp, ridged, rng,
    shaded_ellipse, shadow_blob, to_image,
)

H = 888                    # supersampled tile height (pointy-top hex)
W = int(round(H * SQRT3 / 2))
OUT = (384, 444)           # final size
RAW = [False]              # set True to get the unmasked rectangle


def finish(img, seed):
    if RAW[0]:
        return img.convert('RGBA')
    """Mask to a hex, add a subtle bevel so the tile reads as thick cardboard."""
    img = img.convert('RGBA')
    mask = hex_mask(W, H)
    m = np.array(mask) > 0
    dist = ndimage.distance_transform_edt(m)
    arr = np.array(img).astype(np.float32)
    edge = np.clip(1 - dist / 22, 0, 1)
    # Darken toward the rim, with a light top-left highlight line.
    yy, xx = np.mgrid[0:H, 0:W]
    toward_light = ((W / 2 - xx) * 0.6 + (H / 2 - yy)) / H
    arr[..., :3] *= (1 - edge[..., None] * (0.32 - 0.3 * np.clip(toward_light, 0, 1)[..., None]))
    rim = (dist > 0) & (dist < 4)
    arr[rim, :3] = arr[rim, :3] * 0.55
    arr[..., 3] = np.array(mask)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    return out.resize(OUT, Image.LANCZOS)


# --------------------------------------------------------------------------
def forest(seed):
    r = rng(seed)
    n = fbm(H, W, seed, 6, 5)
    ground = ramp(n, [(0, (32, 52, 24)), (0.5, (52, 78, 34)), (1, (78, 96, 44))])
    ground = apply_shade(ground, hillshade(fbm(H, W, seed + 1, 5, 4) * 40), 0.4)
    img = to_image(ground).convert('RGBA')

    # A small lumber camp: dirt clearing with stacked logs.
    d = ImageDraw.Draw(img)
    cx, cy = W * 0.62, H * 0.66
    d.ellipse([cx - 110, cy - 60, cx + 110, cy + 60], fill=(112, 86, 52, 255))
    d.ellipse([cx - 95, cy - 50, cx + 95, cy + 50], fill=(132, 102, 62, 255))
    for row in range(3):
        for i in range(4 - row):
            lx = cx - 70 + i * 40 + row * 20
            ly = cy + 10 - row * 26
            d.rounded_rectangle([lx - 18, ly - 12, lx + 18, ly + 12], 10, fill=(92, 58, 28, 255), outline=(50, 30, 12, 255), width=3)
            d.ellipse([lx + 8, ly - 12, lx + 30, ly + 12], fill=(222, 184, 128, 255), outline=(60, 36, 14, 255), width=3)
            d.ellipse([lx + 15, ly - 5, lx + 23, ly + 5], outline=(168, 118, 64, 255), width=2)

    mask = np.ones((H, W))
    yy, xx = np.mgrid[0:H, 0:W]
    mask[((xx - cx) / 120) ** 2 + ((yy - cy) / 70) ** 2 < 1] = 0
    pts = poisson_points(r, W, H, 260, 34, mask)
    pts.sort(key=lambda p: p[1])
    for x, y in pts:
        shadow_blob(img, (x + 14, y + 18), 30, 16, 70)
    for x, y in pts:
        if r.random() < 0.35:
            # Conifer
            base = jitter((34, 82, 40), r, 14)
            dark = tuple(int(c * 0.6) for c in base)
            light = tuple(min(255, int(c * 1.35)) for c in base)
            s = 24 + r.random() * 12
            d = ImageDraw.Draw(img)
            for k in range(3):
                ty = y - s * 1.6 + k * s * 0.55
                w2 = s * (0.55 + k * 0.25)
                d.polygon([(x, ty - s * 0.4), (x - w2, ty + s * 0.6), (x + w2, ty + s * 0.6)], fill=dark + (255,))
                d.polygon([(x, ty - s * 0.4), (x - w2, ty + s * 0.6), (x - w2 * 0.1, ty + s * 0.6)], fill=light + (255,))
        else:
            base = jitter((58, 112, 44), r, 22)
            s = 26 + r.random() * 14
            for k in range(3):
                ox = (r.random() - 0.5) * s * 0.9
                oy = (r.random() - 0.5) * s * 0.6 - s * 0.4
                shaded_ellipse(img, x + ox, y + oy, s * 0.62, s * 0.55, base)
    return finish(img, seed)


def hills(seed):
    r = rng(seed)
    hgt = fbm(H, W, seed, 6, 3)
    patches = fbm(H, W, seed + 7, 4, 3)
    clay = ramp(hgt, [(0, (150, 70, 36)), (0.45, (190, 98, 52)), (0.8, (214, 130, 74)), (1, (226, 160, 102))])
    grass = ramp(hgt, [(0, (104, 112, 56)), (1, (136, 138, 78))])
    t = np.clip((patches - 0.62) * 4, 0, 1)[..., None]
    rgb = clay * (1 - t) + grass * t
    rgb = apply_shade(rgb, hillshade(hgt * 90), 0.7)
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)

    # Clay pit with terraces.
    px, py = W * 0.4, H * 0.42
    for k, col in enumerate([(120, 52, 24), (150, 66, 32), (176, 82, 42), (196, 98, 54)]):
        rx, ry = 150 - k * 30, 80 - k * 16
        d.ellipse([px - rx, py - ry, px + rx, py + ry], fill=col + (255,))

    # Brick stacks
    def bricks(bx, by, rows, cols):
        shadow_blob(img, (bx + 30, by + 20), cols * 24, 18, 80)
        dd = ImageDraw.Draw(img)
        for rrow in range(rows):
            for c in range(cols - rrow):
                x0 = bx + c * 34 + rrow * 17 - cols * 17
                y0 = by - rrow * 18
                base = jitter((188, 76, 38), r, 16)
                dd.rectangle([x0, y0 - 16, x0 + 32, y0], fill=base + (255,), outline=(90, 34, 14, 255), width=3)
                dd.line([x0 + 3, y0 - 13, x0 + 29, y0 - 13], fill=tuple(min(255, int(c2 * 1.3)) for c2 in base) + (255,), width=3)

    bricks(W * 0.66, H * 0.7, 4, 5)
    bricks(W * 0.3, H * 0.72, 3, 4)
    # Kiln: domed oven
    kx, ky = W * 0.72, H * 0.38
    shadow_blob(img, (kx + 20, ky + 40), 60, 22, 90)
    shaded_ellipse(img, kx, ky, 56, 50, (150, 72, 40))
    d.rectangle([kx - 18, ky + 4, kx + 18, ky + 44], fill=(40, 20, 10, 255))
    d.chord([kx - 18, ky - 14, kx + 18, ky + 22], 180, 360, fill=(40, 20, 10, 255))
    return finish(img, seed)


def sheep(img, r, x, y, s=1.0):
    shadow_blob(img, (x + 8 * s, y + 18 * s), 26 * s, 9 * s, 90)
    d = ImageDraw.Draw(img)
    for lx in (-12, -4, 6, 13):
        d.rectangle([x + lx * s - 2.5 * s, y + 6 * s, x + lx * s + 2.5 * s, y + 18 * s], fill=(40, 34, 30, 255))
    for k in range(7):
        ox = (r.random() - 0.5) * 30 * s
        oy = (r.random() - 0.5) * 12 * s - 2 * s
        shaded_ellipse(img, x + ox, y + oy, 11 * s, 10 * s, (232, 228, 214), 1.12, 0.78, 4)
    shaded_ellipse(img, x + 22 * s, y - 6 * s, 8 * s, 6.5 * s, (52, 44, 40), 1.4, 0.8, 3)


def pasture(seed):
    r = rng(seed)
    n = fbm(H, W, seed, 6, 4)
    streak = fbm(H, W, seed + 3, 5, 8)
    rgb = ramp(n * 0.7 + streak * 0.3, [(0, (74, 118, 40)), (0.5, (100, 146, 54)), (1, (138, 170, 76))])
    rgb = apply_shade(rgb, hillshade(fbm(H, W, seed + 5, 5, 3) * 50), 0.45)
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    # Flowers
    for _ in range(420):
        x, y = r.random() * W, r.random() * H
        col = [(250, 246, 220), (246, 214, 74), (232, 160, 190)][r.integers(0, 3)]
        d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=col + (255,))
    # Dry stone wall following a curve
    pts = [(W * 0.05 + t * W * 0.9, H * 0.58 + math.sin(t * 3.2 + 0.4) * 60) for t in np.linspace(0, 1, 70)]
    for x, y in pts:
        shaded_ellipse(img, x, y, 9, 7, jitter((150, 146, 136), r, 18), 1.3, 0.6, 3)
    # A couple of round trees
    for tx, ty in [(W * 0.2, H * 0.3), (W * 0.82, H * 0.74)]:
        shadow_blob(img, (tx + 20, ty + 34), 42, 16, 80)
        d.rectangle([tx - 5, ty + 10, tx + 5, ty + 34], fill=(80, 52, 26, 255))
        shaded_ellipse(img, tx, ty, 42, 38, (66, 120, 46))
    # Sheep
    spots = poisson_points(r, W * 0.7, H * 0.55, 7, 90)
    for x, y in sorted(spots, key=lambda p: p[1]):
        sheep(img, r, W * 0.15 + x, H * 0.2 + y, 1.25 + r.random() * 0.3)
    return finish(img, seed)


def fields(seed):
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    seeds = np.array([(r.random() * W, r.random() * H) for _ in range(9)])
    dist = np.stack([(xx - sx) ** 2 + (yy - sy) ** 2 for sx, sy in seeds])
    label = np.argmin(dist, axis=0)
    palette = [(232, 186, 58), (240, 206, 92), (214, 162, 44), (198, 176, 74), (236, 196, 70), (170, 170, 70), (226, 176, 52)]
    rgb = np.zeros((H, W, 3), np.float32)
    for i in range(len(seeds)):
        a = r.random() * math.pi
        stripes = 0.5 + 0.5 * np.sin((xx * math.cos(a) + yy * math.sin(a)) * 0.16)
        base = np.array(palette[i % len(palette)], np.float32)
        region = label == i
        shade = 0.9 + stripes * 0.16
        rgb[region] = base * shade[region][..., None]
    rgb = apply_shade(rgb, hillshade(fbm(H, W, seed + 2, 5, 3) * 45), 0.35)
    # Hedgerows along field borders
    edges = (ndimage.maximum_filter(label, 5) != ndimage.minimum_filter(label, 5))
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    ey, ex = np.nonzero(edges)
    idx = r.choice(len(ex), size=min(len(ex), 1400), replace=False)
    for i in idx:
        x, y = ex[i], ey[i]
        col = jitter((70, 104, 40), r, 14)
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=col + (255,))
    # Farmhouse with red roof and haystacks
    fx, fy = W * 0.6, H * 0.36
    shadow_blob(img, (fx + 26, fy + 46), 70, 22, 100)
    d.rectangle([fx - 50, fy - 10, fx + 50, fy + 40], fill=(238, 228, 204, 255), outline=(90, 70, 50, 255), width=3)
    d.polygon([(fx - 62, fy - 8), (fx, fy - 56), (fx + 62, fy - 8)], fill=(176, 58, 36, 255), outline=(90, 28, 14, 255))
    d.polygon([(fx, fy - 56), (fx + 62, fy - 8), (fx + 20, fy - 8)], fill=(140, 44, 26, 255))
    d.rectangle([fx - 12, fy + 10, fx + 8, fy + 40], fill=(92, 58, 30, 255))
    for hx, hy in [(W * 0.3, H * 0.68), (W * 0.42, H * 0.74), (W * 0.72, H * 0.7)]:
        shadow_blob(img, (hx + 12, hy + 20), 30, 10, 90)
        shaded_ellipse(img, hx, hy, 26, 24, (226, 186, 80))
    return finish(img, seed)


def mountains(seed):
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rid = ridged(H, W, seed, 6, 3)
    peaks = np.zeros((H, W), np.float32)
    for px, py, pr in [(W * 0.38, H * 0.38, 300), (W * 0.66, H * 0.52, 260), (W * 0.45, H * 0.72, 200)]:
        peaks += np.exp(-((xx - px) ** 2 + (yy - py) ** 2) / (2 * (pr * 0.45) ** 2))
    peaks = np.clip(peaks / peaks.max(), 0, 1)
    hgt = peaks * 0.62 + rid * 0.38 * (0.35 + peaks)
    rgb = ramp(hgt, [(0, (104, 108, 82)), (0.3, (122, 118, 108)), (0.55, (140, 140, 146)), (0.75, (164, 168, 178)), (1, (196, 202, 212))])
    snow = np.clip((hgt - 0.7) * 7, 0, 1)[..., None]
    rgb = rgb * (1 - snow) + np.array([244, 246, 250], np.float32) * snow
    rgb = apply_shade(rgb, hillshade(hgt * 110), 0.55)
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    # Mine entrance with timber frame and an ore cart
    mx, my = W * 0.24, H * 0.7
    d.chord([mx - 40, my - 50, mx + 40, my + 30], 180, 360, fill=(30, 26, 24, 255))
    d.rectangle([mx - 40, my - 10, mx + 40, my + 30], fill=(30, 26, 24, 255))
    d.line([mx - 44, my + 30, mx - 44, my - 14, mx + 44, my - 14, mx + 44, my + 30], fill=(112, 76, 40, 255), width=10)
    shaded_ellipse(img, mx + 80, my + 30, 22, 14, (90, 92, 98))
    for _ in range(14):
        ox, oy = r.random() * 30 - 15, r.random() * 10 - 18
        shaded_ellipse(img, mx + 80 + ox, my + 22 + oy, 7, 6, (120, 124, 130), 1.4, 0.6, 3)
    for _ in range(40):
        x, y = r.random() * W, r.random() * H
        shaded_ellipse(img, x, y, 7, 5, (88, 90, 92), 1.4, 0.6, 3)
    return finish(img, seed)


def desert(seed):
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = fbm(H, W, seed, 5, 3)
    a = 0.6
    dunes = np.sin((xx * math.cos(a) + yy * math.sin(a)) * 0.028 + n * 6)
    hgt = (dunes * 0.5 + 0.5) ** 1.5 * 0.7 + n * 0.3
    rgb = ramp(hgt, [(0, (204, 168, 104)), (0.5, (230, 200, 140)), (1, (246, 226, 176))])
    rgb = apply_shade(rgb, hillshade(hgt * 70), 0.55)
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    for _ in range(18):
        x, y = r.random() * W, r.random() * H
        shaded_ellipse(img, x, y, 10 + r.random() * 10, 7 + r.random() * 6, (150, 126, 96), 1.3, 0.6, 3)
    # Dry shrubs
    for _ in range(6):
        x, y = W * 0.15 + r.random() * W * 0.7, H * 0.2 + r.random() * H * 0.6
        for k in range(9):
            ang = -math.pi / 2 + (k - 4) * 0.28
            d.line([x, y, x + math.cos(ang) * 26, y + math.sin(ang) * 26], fill=(120, 96, 52, 255), width=3)
    return finish(img, seed)


def gold(seed):
    """Gold field: a rocky river gorge with gold glinting in the water and on the banks."""
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = fbm(H, W, seed, 5, 3)
    rid = ridged(H, W, seed + 3, 5, 3)
    # A river winding top to bottom through the gorge
    river_x = W * 0.5 + np.sin(yy / H * math.pi * 2.2 + 0.6) * W * 0.16 + (n - 0.5) * 60
    d_river = np.abs(xx - river_x) / (W * 0.09)
    banks = np.clip(d_river - 1, 0, 3) / 3
    hgt = banks * 0.55 + rid * 0.35 * banks + n * 0.1
    rgb = ramp(hgt, [(0, (112, 84, 44)), (0.3, (150, 112, 58)), (0.6, (176, 140, 82)), (1, (204, 176, 118))])
    rgb = apply_shade(rgb, hillshade(hgt * 120), 0.6)
    water = np.clip(1.15 - d_river, 0, 1)[..., None]
    rgb = rgb * (1 - water) + ramp(fbm(H, W, seed + 9, 5, 10), [(0, (64, 150, 168)), (1, (120, 200, 206))]) * water
    img = to_image(rgb).convert('RGBA')
    d = ImageDraw.Draw(img)
    # Gold nuggets along the river bed and banks, with a bright glint
    for _ in range(46):
        t = r.random()
        y = t * H
        x = W * 0.5 + math.sin(t * math.pi * 2.2 + 0.6) * W * 0.16 + (r.random() - 0.5) * W * 0.34
        s = 7 + r.random() * 9
        shaded_ellipse(img, x, y, s, s * 0.75, (232, 176, 32), 1.5, 0.55, 3)
        d.ellipse([x - s * 0.35, y - s * 0.45, x - s * 0.05, y - s * 0.15], fill=(255, 246, 196, 255))
    # A prospector's sluice box on the bank
    bx, by = W * 0.24, H * 0.36
    shadow_blob(img, (bx + 10, by + 26), 70, 16, 90)
    d.polygon([(bx - 70, by - 12), (bx + 60, by + 8), (bx + 60, by + 26), (bx - 70, by + 6)], fill=(122, 82, 42, 255), outline=(60, 38, 16, 255))
    for k in range(5):
        x0 = bx - 56 + k * 24
        d.line([x0, by - 6 + k * 3.5, x0, by + 10 + k * 3.5], fill=(80, 52, 24, 255), width=4)
    return finish(img, seed)


def sea(seed):
    """Open-sea tile matching the painted sea frame: rolling water with light wave crests."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = fbm(H, W, seed, 6, 4)
    waves = np.sin((xx * 0.5 + yy) * 0.05 + n * 7) * 0.5 + 0.5
    hgt = n * 0.7 + waves * 0.3
    rgb = ramp(hgt, [(0, (22, 112, 148)), (0.5, (32, 146, 178)), (1, (70, 186, 204))])
    crest = np.clip((waves - 0.86) * 6, 0, 1) * np.clip(n * 1.6 - 0.4, 0, 1)
    rgb = rgb * (1 - crest[..., None] * 0.45) + 255 * crest[..., None] * 0.45
    return finish(to_image(rgb), seed)


def fog(seed):
    """The Fog Islands: an undiscovered space — drifting mist over dim water, with a faint question mark."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = fbm(H, W, seed, 5, 3)
    m = fbm(H, W, seed + 11, 7, 2)
    drift = np.sin((xx * 0.8 - yy) * 0.012 + n * 5) * 0.5 + 0.5
    mist = np.clip(n * 0.55 + drift * 0.3 + m * 0.25, 0, 1)
    rgb = ramp(mist, [(0, (150, 176, 190)), (0.45, (206, 218, 224)), (0.8, (236, 241, 243)), (1, (250, 251, 252))])
    img = to_image(rgb)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', int(H * 0.42))
        glyph = Image.new('L', (W, H), 0)
        d = ImageDraw.Draw(glyph)
        d.text((W / 2, H / 2), '?', font=font, fill=255, anchor='mm')
        glyph = glyph.filter(ImageFilter.GaussianBlur(3))
        g = np.array(glyph).astype(np.float32)[..., None] / 255 * 0.55
        arr = np.array(img).astype(np.float32)
        arr = arr * (1 - g) + np.array([70, 92, 108], np.float32) * g
        img = to_image(arr)
    except OSError:
        pass
    return finish(img, seed)


TERRAINS = {
    'forest': forest,
    'hills': hills,
    'pasture': pasture,
    'fields': fields,
    'mountains': mountains,
    'desert': desert,
    'gold': gold,
    'sea': sea,
    'fog': fog,
}
