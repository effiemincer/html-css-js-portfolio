#!/usr/bin/env python3
"""
Throwaway spike: probe Sefaria's links API for a mix of famous and obscure
pesukim, then print link counts grouped by category.

Goal: confirm whether liturgical references are tagged in a way that actually
separates well-known from obscure verses before committing to a build script.
"""

import json
import time
import urllib.request
import urllib.parse
from collections import Counter

LINKS_BASE = "https://www.sefaria.org/api/links/"

FAMOUS = [
    ("Deuteronomy 6:4", "Shema"),
    ("Genesis 1:1", "Bereishis opening"),
    ("Exodus 20:2", "Anokhi"),
    ("Psalms 23:1", "Mizmor l'David"),
    ("Psalms 145:1", "Ashrei opening"),
    ("Numbers 6:24", "Birkat Kohanim"),
    ("Deuteronomy 6:5", "V'ahavta"),
    ("Exodus 15:18", "Hashem yimloch"),
]

OBSCURE = [
    ("I Chronicles 7:25", "genealogy"),
    ("Nehemiah 11:23", "admin"),
    ("Ezra 2:43", "Nethinim list"),
    ("II Kings 15:30", "king assassination"),
    ("Numbers 33:22", "journey stop"),
    ("Joshua 15:42", "tribal border"),
]


def fetch_links(ref):
    encoded = urllib.parse.quote(ref)
    url = f"{LINKS_BASE}{encoded}?with_text=0"
    req = urllib.request.Request(url, headers={"User-Agent": "PesukimSpike/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def summarize(ref, label):
    try:
        links = fetch_links(ref)
    except Exception as e:
        print(f"\n{ref} ({label}): ERROR {e}")
        return

    cats = Counter()
    types = Counter()
    cat_cat = Counter()  # for deeper drilling
    sample_liturgy = []

    for link in links:
        cat = link.get("category", "?")
        typ = link.get("type", "?")
        cats[cat] += 1
        types[typ] += 1
        if cat == "Liturgy":
            sample_liturgy.append(link.get("index_title") or link.get("ref") or "?")
        # secondary collection name if present
        coll = link.get("collectiveTitle", {})
        if isinstance(coll, dict):
            coll_en = coll.get("en")
            if coll_en:
                cat_cat[coll_en] += 1

    print(f"\n=== {ref} ({label}) ===")
    print(f"  total links: {len(links)}")
    print(f"  top categories: {cats.most_common(8)}")
    print(f"  top types: {types.most_common(6)}")
    if sample_liturgy:
        unique_lit = sorted(set(sample_liturgy))[:10]
        print(f"  liturgy hits ({cats['Liturgy']}): {unique_lit}")
    else:
        print(f"  liturgy hits: 0")


def main():
    print("# FAMOUS PESUKIM")
    for ref, label in FAMOUS:
        summarize(ref, label)
        time.sleep(0.5)

    print("\n\n# OBSCURE PESUKIM")
    for ref, label in OBSCURE:
        summarize(ref, label)
        time.sleep(0.5)


if __name__ == "__main__":
    main()
