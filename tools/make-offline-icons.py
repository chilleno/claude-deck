#!/usr/bin/env python3
"""Build the greyscale "no session" variants of every action icon.

When no Claude Code session is tracked, the plugin shows each key its own
artwork in black & white instead of a shared placeholder, so the key on the
deck always matches the icon in Ulanzi Studio's action list.

Run from the repo root:  python3 tools/make-offline-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "com.claudedeck.deck.plugin.ulanziPlugin" / "resources"
OUT = RESOURCES / "offline"
SETUP_OUT = RESOURCES / "setup"

# how much luminance survives — dims the art so "inactive" reads at a glance
DIM = 0.72

# "setup needed" badge: an amber dot in the corner of the greyed art, so a
# machine with no Claude Code installed never looks like one that simply has
# no session running
BADGE = "#e8a33d"
BADGE_RING = "#1e1f22"


def greyscale(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    grey = im.convert("L").point(lambda v: int(v * DIM))
    return Image.merge("RGBA", (grey, grey, grey, im.getchannel("A")))


def offline_variant(src: Path, dst: Path) -> None:
    greyscale(src).save(dst)
    print(f"{src.name} -> {dst.relative_to(RESOURCES)}")


def setup_variant(src: Path, dst: Path) -> None:
    im = greyscale(src)
    w, h = im.size
    r = int(w * 0.17)
    cx, cy = w - r - int(w * 0.06), r + int(w * 0.06)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4], fill=BADGE_RING)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BADGE)
    # exclamation mark inside the dot
    bar = max(2, int(r * 0.22))
    d.rounded_rectangle([cx - bar, cy - int(r * 0.55), cx + bar, cy + int(r * 0.15)],
                        radius=bar, fill=BADGE_RING)
    d.ellipse([cx - bar, cy + int(r * 0.33), cx + bar, cy + int(r * 0.33) + 2 * bar], fill=BADGE_RING)
    im.save(dst)
    print(f"{src.name} -> {dst.relative_to(RESOURCES)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SETUP_OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(RESOURCES.glob("action-*.png")):
        offline_variant(src, OUT / src.name)
        setup_variant(src, SETUP_OUT / src.name)


if __name__ == "__main__":
    main()
