#!/usr/bin/env python3
"""
Compute a prominence score (q) for each verse in data/tanach.json.

Signal: Sefaria's links API, fetched at chapter granularity (~929 calls).
Each link is categorized and weighted; per-verse totals are log-transformed
and normalized to 0-255 on a `q` field written back into tanach.json.

Cached raw link counts live under scripts/.cache/links/ so interrupted
runs resume cheaply.

Usage:
    python scripts/score_pesukim.py             # fetch + score + write
    python scripts/score_pesukim.py --report    # scoring + report only (use cache)
    python scripts/score_pesukim.py --dry-run   # don't write tanach.json
"""

import argparse
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SEFARIA_LINKS_BASE = "https://www.sefaria.org/api/links/"
REPO_ROOT = Path(__file__).parent.parent
TANACH_JSON = REPO_ROOT / "data" / "tanach.json"
CACHE_DIR = Path(__file__).parent / ".cache" / "links"

# Matches the order/indices in build_tanach_data.py (book_idx == position here)
SEFARIA_BOOK_NAMES = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "I Samuel", "II Samuel", "I Kings", "II Kings",
    "Isaiah", "Jeremiah", "Ezekiel", "Hosea", "Joel", "Amos", "Obadiah",
    "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi",
    "Psalms", "Proverbs", "Job", "Song of Songs", "Ruth", "Lamentations",
    "Ecclesiastes", "Esther", "Daniel", "Ezra", "Nehemiah",
    "I Chronicles", "II Chronicles",
]

CATEGORY_WEIGHTS = {
    "Liturgy": 5.0,
    "Talmud": 3.0,
    "Midrash": 3.0,
    "Mishnah": 3.0,
    "Chasidut": 1.5,
    "Kabbalah": 1.5,
    "Jewish Thought": 1.5,
    "Musar": 1.5,
    "Halakhah": 1.5,
    "Commentary": 0.3,
    "Quoting Commentary": 0.3,
    # Reference / Essay / Targum / Tanakh omitted (≈ 0 signal)
}

REQUEST_DELAY = 0.4
MAX_RETRIES = 3


def fetch_links_for_chapter(book_name, chapter):
    """Fetch Sefaria links for a whole chapter (e.g. 'Psalms 145')."""
    ref = f"{book_name} {chapter}"
    url = SEFARIA_LINKS_BASE + urllib.parse.quote(ref) + "?with_text=0"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PesukimScorer/1.0"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                print(f"    retry in {wait}s after: {e}")
                time.sleep(wait)
            else:
                raise


VERSE_RANGE_RE = re.compile(r"^(.*?)\s+(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$")


def expand_anchor_ref(anchor_ref, anchor_expanded):
    """
    Turn an anchorRef into a list of (chapter, verse) tuples for the anchor's book.
    Prefers anchorRefExpanded (array of per-verse refs) when available.
    """
    refs = anchor_expanded if isinstance(anchor_expanded, list) and anchor_expanded else [anchor_ref]
    out = []
    for r in refs:
        if not isinstance(r, str):
            continue
        m = VERSE_RANGE_RE.match(r)
        if not m:
            continue
        _, c1, v1, c2, v2 = m.groups()
        c1 = int(c1); v1 = int(v1)
        if v2 is None:
            out.append((c1, v1))
        else:
            v2i = int(v2)
            c2i = int(c2) if c2 else c1
            if c1 == c2i:
                for vv in range(v1, v2i + 1):
                    out.append((c1, vv))
            else:
                out.append((c1, v1))  # multi-chapter range: just count first verse
    return out


def summarize_chapter_links(links):
    """
    Reduce a Sefaria chapter-links response to:
        {(chapter, verse): {category: count, ...}}
    """
    per_verse = defaultdict(lambda: defaultdict(int))
    for link in links:
        cat = link.get("category") or ""
        if cat not in CATEGORY_WEIGHTS:
            continue
        anchor_ref = link.get("anchorRef") or ""
        anchor_expanded = link.get("anchorRefExpanded")
        for (c, v) in expand_anchor_ref(anchor_ref, anchor_expanded):
            per_verse[(c, v)][cat] += 1
    # convert inner defaultdicts to plain dicts for JSON serialization
    return {f"{c}:{v}": dict(cats) for (c, v), cats in per_verse.items()}


def cache_path(book_idx, chapter):
    return CACHE_DIR / f"{book_idx:02d}_{chapter:03d}.json"


def load_cached(book_idx, chapter):
    p = cache_path(book_idx, chapter)
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_cached(book_idx, chapter, summary):
    p = cache_path(book_idx, chapter)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False)


def fetch_all_chapters(chapters_by_book, skip_fetch=False):
    """
    Returns: {(book_idx, chapter, verse): {category: count}}
    Uses cache; fetches missing chapters unless skip_fetch is True.
    """
    result = {}
    total = sum(len(chs) for chs in chapters_by_book.values())
    done = 0

    for book_idx, chapters in sorted(chapters_by_book.items()):
        book_name = SEFARIA_BOOK_NAMES[book_idx]
        for chapter in sorted(chapters):
            done += 1
            summary = load_cached(book_idx, chapter)
            if summary is None:
                if skip_fetch:
                    print(f"  [{done}/{total}] {book_name} {chapter}: MISSING (skip_fetch)")
                    continue
                print(f"  [{done}/{total}] {book_name} {chapter}: fetching…")
                try:
                    links = fetch_links_for_chapter(book_name, chapter)
                except Exception as e:
                    print(f"    FAILED: {e}")
                    continue
                summary = summarize_chapter_links(links)
                save_cached(book_idx, chapter, summary)
                time.sleep(REQUEST_DELAY)
            for key, cats in summary.items():
                c_str, v_str = key.split(":")
                c_int = int(c_str)
                # Only trust a chapter's cache for verses in that chapter.
                # Range-anchored links ("Genesis 1:1-2:3") get expanded into
                # both chapters' caches with partial data, and last-write-wins
                # would silently discard the authoritative chapter's counts.
                if c_int != chapter:
                    continue
                result[(book_idx, c_int, int(v_str))] = cats
    return result


def compute_scores(tanach, link_data):
    """Weighted link-category sum per verse, in tanach['verses'] order."""
    raw_scores = []
    for verse in tanach["verses"]:
        key = (verse["b"], verse["c"], verse["v"])
        cats = link_data.get(key, {})
        weighted = sum(CATEGORY_WEIGHTS[c] * cnt for c, cnt in cats.items() if c in CATEGORY_WEIGHTS)
        raw_scores.append(weighted)
    return raw_scores


def normalize_to_byte(raw_scores):
    """Log-transform + min/max to 0-255. Handles the long tail."""
    if not raw_scores:
        return []
    log_scores = [math.log1p(max(0.0, s)) for s in raw_scores]
    lo = min(log_scores)
    hi = max(log_scores)
    span = hi - lo
    if span <= 0:
        return [0] * len(log_scores)
    out = []
    for ls in log_scores:
        val = round(255 * (ls - lo) / span)
        out.append(max(0, min(255, val)))
    return out


def search_name(tanach, name_he):
    """Recreate the JS search for the report — contains-name within a word boundary."""
    sofit = {"\u05DA": "\u05DB", "\u05DD": "\u05DE", "\u05DF": "\u05E0",
             "\u05E3": "\u05E4", "\u05E5": "\u05E6"}

    def norm(c):
        return sofit.get(c, c)

    letters = re.findall(r"[\u05D0-\u05EA]", name_he)
    if not letters:
        return []

    pattern = re.compile(r"(?:^|[^\u05D0-\u05EA])" + re.escape(name_he) + r"(?:$|[^\u05D0-\u05EA])")
    name_first = norm(letters[0])
    name_last = norm(letters[-1])

    results = []  # (kind, verse_idx)
    for i, v in enumerate(tanach["verses"]):
        hs = v.get("hs") or v.get("h") or ""
        contains = bool(pattern.search(hs))
        letter_match = (v.get("fl") == name_first and v.get("ll") == name_last)
        if contains and letter_match:
            kind = "super"
        elif contains:
            kind = "contains"
        elif letter_match:
            kind = "letters"
        else:
            continue
        results.append((kind, i))
    return results


def print_report(tanach, q_scores):
    verses = tanach["verses"]
    books = tanach["books"]

    def fmt_verse(i, q):
        v = verses[i]
        ref = f"{books[v['b']]['e']} {v['c']}:{v['v']}"
        heb = v.get("h", "")
        # truncate Hebrew for display
        if len(heb) > 90:
            heb = heb[:90] + "…"
        return f"  [{q:3d}] {ref:30s} {heb}"

    print("\n" + "=" * 60)
    print("TOP 20 OVERALL")
    print("=" * 60)
    order = sorted(range(len(verses)), key=lambda i: -q_scores[i])
    for i in order[:20]:
        print(fmt_verse(i, q_scores[i]))

    print("\n" + "=" * 60)
    print("BOTTOM 20 OVERALL (first 20 with score 0)")
    print("=" * 60)
    zeros = [i for i in range(len(verses)) if q_scores[i] == 0]
    for i in zeros[:20]:
        print(fmt_verse(i, q_scores[i]))

    print("\n" + "=" * 60)
    print("PER-NAME TOP 10 (sorted by q, across all three match buckets)")
    print("=" * 60)
    for name in ["\u05D0\u05D1\u05E8\u05D4\u05DD",  # אברהם
                 "\u05D3\u05D5\u05D3",              # דוד
                 "\u05DE\u05E9\u05D4",              # משה
                 "\u05E9\u05E8\u05D4",              # שרה
                 "\u05E8\u05D7\u05DC",              # רחל
                 "\u05D0\u05E4\u05E8\u05D9\u05DD",  # אפרים
                 "\u05E0\u05E4\u05EA\u05DC\u05D9"]: # נפתלי
        print(f"\n--- {name} ---")
        matches = search_name(tanach, name)
        if not matches:
            print("  (no matches)")
            continue
        # bucket counts
        buckets = defaultdict(int)
        for kind, _ in matches:
            buckets[kind] += 1
        print(f"  buckets: super={buckets['super']}, contains={buckets['contains']}, letters={buckets['letters']}")
        ranked = sorted(matches, key=lambda t: -q_scores[t[1]])
        for kind, i in ranked[:10]:
            tag = {"super": "★", "contains": "∋", "letters": "↔"}[kind]
            print(f"  {tag} " + fmt_verse(i, q_scores[i]).lstrip())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="use cache only, don't fetch")
    parser.add_argument("--dry-run", action="store_true", help="don't write tanach.json")
    args = parser.parse_args()

    print(f"Loading {TANACH_JSON}…")
    with open(TANACH_JSON, "r", encoding="utf-8") as f:
        tanach = json.load(f)
    print(f"  {len(tanach['verses'])} verses, {len(tanach['books'])} books")

    chapters_by_book = defaultdict(set)
    for v in tanach["verses"]:
        chapters_by_book[v["b"]].add(v["c"])

    total_chapters = sum(len(chs) for chs in chapters_by_book.values())
    print(f"\nFetching link data for {total_chapters} chapters (cached under {CACHE_DIR})…")
    link_data = fetch_all_chapters(chapters_by_book, skip_fetch=args.report)
    print(f"  got link data for {len(link_data)} verses")

    print("\nComputing raw scores…")
    raw_scores = compute_scores(tanach, link_data)
    nonzero = sum(1 for s in raw_scores if s > 0)
    print(f"  {nonzero}/{len(raw_scores)} verses have nonzero weighted links")

    print("Normalizing to 0-255 (log + min/max)…")
    q_scores = normalize_to_byte(raw_scores)

    print_report(tanach, q_scores)

    if args.dry_run:
        print("\n--dry-run, skipping write")
        return

    print(f"\nWriting q scores back into {TANACH_JSON}…")
    for v, q in zip(tanach["verses"], q_scores):
        v["q"] = q
    tanach["meta"]["has_quality"] = True

    with open(TANACH_JSON, "w", encoding="utf-8") as f:
        json.dump(tanach, f, ensure_ascii=False)

    size_mb = TANACH_JSON.stat().st_size / (1024 * 1024)
    print(f"  Done. {TANACH_JSON} is {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
