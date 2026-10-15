"""Builds all generated art into packages/client/public/art/.

    python packages/client/art-src/generate.py [only-this-asset]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from terrain import TERRAINS  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'art')


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in TERRAINS.items():
        for variant in range(2):
            key = f'hex-{name}-{variant}'
            if only and not key.startswith(only):
                continue
            img = fn(1000 + variant * 37 + sum(map(ord, name)))
            img.save(os.path.join(OUT_DIR, f'{key}.webp'), 'WEBP', quality=84, method=6)
            print('wrote', key)
    try:
        import extras  # noqa: F401  (sea frame, cards) — added in later steps
        extras.build(OUT_DIR, only)
    except ModuleNotFoundError:
        pass


if __name__ == '__main__':
    main()
