#!/usr/bin/env python3
"""Gate: every string the panels ask for exists in all 9 language files.

A missing key isn't a crash — Studio just leaves the English source text on
screen, which is exactly the bug the Ulanzi team reported in #3. So it has to
be checked, not eyeballed.

Run from the repo root:  python3 tools/check-locales.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "com.claudedeck.deck.plugin.ulanziPlugin"
LANGS = ["en", "es_ES", "fr", "de_DE", "pt_PT", "ja_JP", "ko_KR", "zh_CN", "zh_HK"]

# data-localize="key" in the markup, and t('key', 'fallback') in panel scripts.
# The lookbehind keeps createElement('div') and friends out of the results.
HTML_KEY = re.compile(r'data-localize="([^"]+)"')
JS_KEY = re.compile(r"(?<![A-Za-z0-9_$])t\('([a-z0-9_]+)'")


def used_keys() -> set:
    keys = set()
    for f in sorted((ROOT / "property-inspector").glob("*.html")):
        keys |= set(HTML_KEY.findall(f.read_text(encoding="utf-8")))
    for f in sorted((ROOT / "property-inspector").glob("*.js")):
        keys |= set(JS_KEY.findall(f.read_text(encoding="utf-8")))
    return keys


def main() -> int:
    need = used_keys()
    failed = False
    for lang in LANGS:
        loc = json.loads((ROOT / f"{lang}.json").read_text(encoding="utf-8"))["Localization"]
        missing = sorted(need - set(loc))
        unused = sorted(set(loc) - need)
        blank = sorted(k for k, v in loc.items() if not str(v).strip())
        placeholders = sorted(
            k for k in need & set(loc)
            if "{n}" in json.loads((ROOT / "en.json").read_text(encoding="utf-8"))["Localization"].get(k, "")
            and "{n}" not in loc[k]
        )
        bad = missing or blank or placeholders
        failed = failed or bool(bad)
        print(f"{lang:6} keys={len(loc):3} used={len(need):3} missing={missing} blank={blank} "
              f"lost_placeholder={placeholders} unused={len(unused)}")
        if unused and lang == "en":
            print(f"       (unused in en, safe but dead: {unused})")
    print("LOCALES OK" if not failed else "LOCALES FAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
