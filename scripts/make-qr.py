"""
Makes the printable QR code: https://clearcreektrash.com with the 2026 badge
in the middle.

    pip install qrcode pillow
    python3 scripts/make-qr.py            # writes public/brand/qr-clearcreektrash.png

Error correction is H (up to 30% of the code can be covered), and the badge
covers well under that, so phones still read it. Modules under the badge are
cleared rather than drawn over, and the three corner finder squares stay solid.
"""

import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw

URL = "https://clearcreektrash.com"
ROOT = Path(__file__).resolve().parent.parent
BADGE = ROOT / "public/brand/badge-2026.webp"
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "public/brand/qr-clearcreektrash.png")

DARK = (19, 63, 42)  # river-900
BG = (255, 255, 255)
SCALE = 48  # pixels per module
QUIET = 4  # modules of white border
LOGO_FRACTION = 0.30  # badge width / code width

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
qr.add_data(URL)
qr.make(fit=True)
matrix = qr.get_matrix()
n = len(matrix)
size = (n + 2 * QUIET) * SCALE

img = Image.new("RGB", (size, size), BG)
draw = ImageDraw.Draw(img)

# Badge area, in modules, rounded out to whole modules plus a one-module gap.
logo_px = int(n * SCALE * LOGO_FRACTION)
logo_modules = -(-logo_px // SCALE) + 2
lo = (n - logo_modules) // 2
hi = lo + logo_modules


def in_finder(r: int, c: int) -> bool:
    return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)


def cleared(r: int, c: int) -> bool:
    # A circle, to match the round badge.
    cr = cc = (n - 1) / 2
    return (r - cr) ** 2 + (c - cc) ** 2 <= (logo_modules / 2) ** 2


# Data modules: rounded dots.
pad = SCALE * 0.03
for r, row in enumerate(matrix):
    for c, on in enumerate(row):
        if not on or in_finder(r, c) or cleared(r, c):
            continue
        x, y = (c + QUIET) * SCALE, (r + QUIET) * SCALE
        draw.rounded_rectangle(
            [x + pad, y + pad, x + SCALE - pad, y + SCALE - pad], radius=SCALE * 0.3, fill=DARK
        )

# Finder squares: solid, softly rounded.
for fr, fc in [(0, 0), (0, n - 7), (n - 7, 0)]:
    x, y = (fc + QUIET) * SCALE, (fr + QUIET) * SCALE
    s = SCALE
    draw.rounded_rectangle([x, y, x + 7 * s, y + 7 * s], radius=s * 0.9, fill=DARK)
    draw.rounded_rectangle([x + s, y + s, x + 6 * s, y + 6 * s], radius=s * 0.6, fill=BG)
    draw.rounded_rectangle([x + 2 * s, y + 2 * s, x + 5 * s, y + 5 * s], radius=s * 0.5, fill=DARK)

# Badge, centered.
badge = Image.open(BADGE).convert("RGBA").resize((logo_px, logo_px), Image.LANCZOS)
offset = (size - logo_px) // 2
img.paste(badge, (offset, offset), badge)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print(f"{OUT}: {size}x{size}px, {n}x{n} modules")
