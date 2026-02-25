#!/usr/bin/env python3
"""Generate dark square PWA icons with a white lightning bolt for Max Dashboard."""

from PIL import Image, ImageDraw
import os

BG_COLOR = (26, 31, 36)       # #1a1f24
ACCENT_COLOR = (124, 58, 237) # #7c3aed

def draw_lightning(draw, w, h, color):
    pts = [
        (w * 0.58, h * 0.12),
        (w * 0.35, h * 0.50),
        (w * 0.52, h * 0.50),
        (w * 0.42, h * 0.88),
        (w * 0.65, h * 0.50),
        (w * 0.48, h * 0.50),
    ]
    draw.polygon(pts, fill=color)

def make_icon(size, path):
    img = Image.new('RGB', (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)
    # Purple shadow (slightly offset)
    pts_shadow = [
        ((size * 0.58) + 4, (size * 0.12) + 4),
        ((size * 0.35) + 4, (size * 0.50) + 4),
        ((size * 0.52) + 4, (size * 0.50) + 4),
        ((size * 0.42) + 4, (size * 0.88) + 4),
        ((size * 0.65) + 4, (size * 0.50) + 4),
        ((size * 0.48) + 4, (size * 0.50) + 4),
    ]
    draw.polygon(pts_shadow, fill=ACCENT_COLOR)
    # White lightning bolt
    draw_lightning(draw, size, size, (255, 255, 255))
    img.save(path, 'PNG')
    print(f'✅ {path} ({size}x{size})')

out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')
os.makedirs(out_dir, exist_ok=True)
make_icon(192, os.path.join(out_dir, 'icon-192.png'))
make_icon(512, os.path.join(out_dir, 'icon-512.png'))
print('Icons generated!')
