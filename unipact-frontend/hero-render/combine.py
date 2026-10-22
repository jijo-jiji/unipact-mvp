"""Combines the two Blender passes into the front page's hero picture and exports it for the web.

    python hero-render/combine.py <objects.png> <shadow.png> <output dir, e.g. public/home> <name, e.g. hero-level> [--contact]

The shadow pass is softened and laid underneath the objects at a light strength (a navy-tinted shadow
suits the pale blue panel it sits on). With --contact, a soft oval shadow is also drawn right under the
stand: the level camera sits almost at floor height, so the floor shadow Blender renders is hidden behind
the stand, and without one the picture looks pasted on. The result is cropped around the scene, and two
transparent WebPs are written: <name>-1400.webp for retina screens and <name>-700.webp for the rest.
Needs Pillow.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SHADOW_STRENGTH = 0.35
SHADOW_BLUR = 10
SIZES = {1400: 86, 700: 84}  # width: WebP quality
CONTACT_STRENGTH = 0.32
CONTACT_BLUR = 22
EDGE_FADE = 40  # px faded to transparent at every edge, so the soft shadow never ends in a straight line

objects_png, shadow_png, out_dir, name = sys.argv[1:5]
contact = '--contact' in sys.argv[5:]

objects = Image.open(objects_png).convert('RGBA')
shadow = Image.open(shadow_png).convert('RGBA')
alpha = shadow.split()[3].filter(ImageFilter.GaussianBlur(SHADOW_BLUR)).point(lambda a: int(a * SHADOW_STRENGTH))
if contact:
    # an oval as wide as the stand's base, just under its bottom edge
    solid = objects.split()[3].point(lambda a: 255 if a > 8 else 0)
    bottom = solid.getbbox()[3]
    base = solid.crop((0, bottom - 40, solid.width, bottom)).getbbox()
    width = base[2] - base[0]
    oval = Image.new('L', shadow.size, 0)
    ImageDraw.Draw(oval).ellipse((base[0] + width * 0.02, bottom - width * 0.035, base[2] - width * 0.02, bottom + width * 0.045), fill=255)
    oval = oval.filter(ImageFilter.GaussianBlur(CONTACT_BLUR)).point(lambda a: int(a * CONTACT_STRENGTH))
    alpha = ImageChops.lighter(alpha, oval)
picture = Image.new('RGBA', shadow.size, (10, 23, 72, 0))
picture.putalpha(alpha)
picture.alpha_composite(objects)

# Crop around the scene itself, with room for the shadow; the faintest shadow beyond is faded out below
bbox = objects.split()[3].point(lambda a: 255 if a > 8 else 0).getbbox()
pad = 80
picture = picture.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                        min(picture.width, bbox[2] + pad), min(picture.height, bbox[3] + pad)))

fade = Image.new('L', picture.size, 0)
for x in range(picture.width):
    for_x = min(x, picture.width - 1 - x, EDGE_FADE) / EDGE_FADE
    fade.paste(int(255 * for_x), (x, 0, x + 1, picture.height))
fade_y = Image.new('L', picture.size, 0)
for y in range(picture.height):
    fade_y.paste(int(255 * min(y, picture.height - 1 - y, EDGE_FADE) / EDGE_FADE), (0, y, picture.width, y + 1))
picture.putalpha(ImageChops.multiply(picture.split()[3], ImageChops.multiply(fade, fade_y)))

for width, quality in SIZES.items():
    height = round(picture.height * width / picture.width)
    path = os.path.join(out_dir, f'{name}-{width}.webp')
    picture.resize((width, height), Image.LANCZOS).save(path, 'WEBP', quality=quality, method=6)
    print(f'{path}: {width} x {height}, {os.path.getsize(path) // 1024} KB')
