#!/usr/bin/env python3
"""Build the greyscale "no session" variants of every action icon.

When no Claude Code session is tracked, the plugin shows each key its own
artwork in black & white instead of a shared placeholder, so the key on the
deck always matches the icon in Ulanzi Studio's action list.

Run from the repo root:  python3 tools/make-offline-icons.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "com.claudedeck.deck.plugin.ulanziPlugin" / "resources"
OUT = RESOURCES / "offline"

# how much luminance survives — dims the art so "inactive" reads at a glance
DIM = 0.72


def offline_variant(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    grey = im.convert("L").point(lambda v: int(v * DIM))
    out = Image.merge("RGBA", (grey, grey, grey, im.getchannel("A")))
    out.save(dst)
    print(f"{src.name} -> {dst.relative_to(RESOURCES)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(RESOURCES.glob("action-*.png")):
        offline_variant(src, OUT / src.name)


if __name__ == "__main__":
    main()
