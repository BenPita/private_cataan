"""Shared helpers for the procedural art generator (noise, shading, drawing).

All game art is generated from code here, so every asset is original.
Run `python packages/client/art-src/generate.py` to rebuild public/art/.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

SQRT3 = math.sqrt(3)


def rng(seed):
    return np.random.default_rng(seed)


def fbm(h, w, seed, octaves=6, base=4, persistence=0.42):
    """Fractal value noise in [0, 1]."""
    r = rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = base * 2 ** o
        grid = r.random((cells + 3, cells + 3)).astype(np.float32)
        layer = ndimage.zoom(grid, ((h + 2) / (cells + 3) * 1.0001, (w + 2) / (cells + 3) * 1.0001), order=3)[:h, :w]
        out += layer * amp
        total += amp
        amp *= persistence
    out /= total
    out -= out.min()
    out /= max(out.max(), 1e-6)
    return out


def ridged(h, w, seed, octaves=6, base=3):
    n = fbm(h, w, seed, octaves, base, 0.55)
    return 1 - np.abs(n * 2 - 1)


def hillshade(height, strength=1.0, light=(-1.0, -1.2)):
    gy, gx = np.gradient(height)
    lx, ly = light
    norm = math.hypot(lx, ly)
    shade = -(gx * lx + gy * ly) / norm * strength
    return np.clip(0.5 + shade, 0, 1)


def ramp(values, stops):
    """Map [0,1] values through colour stops [(pos, (r,g,b)), ...]."""
    out = np.zeros(values.shape + (3,), np.float32)
    pos = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    for c in range(3):
        out[..., c] = np.interp(values, pos, cols[:, c])
    return out


def apply_shade(rgb, shade, amount=0.6):
    s = (shade - 0.5) * 2 * amount
    out = rgb * (1 + s[..., None])
    return np.clip(out, 0, 255)


def to_image(rgb):
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')


def hex_mask(w, h, inset=0):
    """Pointy-top hexagon filling a w x h image."""
    m = Image.new('L', (w, h), 0)
    cx, cy = w / 2, h / 2
    r = h / 2 - inset
    pts = [(cx + r * math.cos(math.radians(60 * i - 90)), cy + r * math.sin(math.radians(60 * i - 90))) for i in range(6)]
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def shadow_blob(draw_img, xy, rx, ry, alpha=90, blur=0):
    """Soft elliptical shadow drawn onto an RGBA layer."""
    layer = Image.new('RGBA', draw_img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=(20, 15, 5, alpha))
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    draw_img.alpha_composite(layer)


def shaded_ellipse(img, cx, cy, rx, ry, base, light=1.25, dark=0.65, steps=6):
    """Ellipse with a simple top-left highlight (painterly volume)."""
    d = ImageDraw.Draw(img)
    for i in range(steps):
        t = i / steps
        k = dark + (light - dark) * t
        col = tuple(int(min(255, c * k)) for c in base)
        sx = rx * (1 - t * 0.55)
        sy = ry * (1 - t * 0.55)
        ox = -rx * 0.28 * t
        oy = -ry * 0.32 * t
        d.ellipse([cx + ox - sx, cy + oy - sy, cx + ox + sx, cy + oy + sy], fill=col + (255,))


def jitter(base, r, amount=18):
    return tuple(int(np.clip(c + r.integers(-amount, amount + 1), 0, 255)) for c in base)


def poisson_points(r, w, h, count, min_dist, mask=None, tries=30):
    pts = []
    attempts = 0
    while len(pts) < count and attempts < count * tries:
        attempts += 1
        x, y = r.random() * w, r.random() * h
        if mask is not None and mask[int(y) % mask.shape[0], int(x) % mask.shape[1]] < 0.5:
            continue
        if all((x - px) ** 2 + (y - py) ** 2 >= min_dist ** 2 for px, py in pts):
            pts.append((x, y))
    return pts
