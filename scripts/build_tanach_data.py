#!/usr/bin/env python3
"""
Fetch all Tanach verses from the Sefaria API and produce data/tanach.json.

39 API calls (one per book, fetching Hebrew + English together).
Output: ~5 MB JSON with books metadata and flat verse array.
"""

import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path

SEFARIA_BASE = "https://www.sefaria.org/api/v3/texts/"
ENGLISH_VERSION = "The Koren Jerusalem Bible"

SOFIT_MAP = {
    "\u05DA": "\u05DB",  # ך → כ
    "\u05DD": "\u05DE",  # ם → מ
    "\u05DF": "\u05E0",  # ן → נ
    "\u05E3": "\u05E4",  # ף → פ
    "\u05E5": "\u05E6",  # ץ → צ
}

NIKUD_RE = re.compile(r"[\u0591-\u05C7]")
HTML_RE = re.compile(r"<[^>]+>")
ENTITY_RE = re.compile(r"&[a-z]+;")
BRACE_RE = re.compile(r"\s*\{[^\}]+\}\s*")
KETIV_QERE_RE = re.compile(r"\([^)]*\)\s*\[[^\]]*\]")
PARENS_NOTE_RE = re.compile(r"\*?\([^)]*\)")
BRACKET_RE = re.compile(r"\[([^\]]*)\]")
CGJ_RE = re.compile(r"[\u034F]")
TETRA_RE = re.compile(r"\u05D9\u05D4\u05D5\u05D4")
ELOKIM_RE = re.compile(r"\u05D0\u05DC\u05D4\u05D9\u05DD")
MULTI_SPACE_RE = re.compile(r" {2,}")
HEBREW_LETTER_RE = re.compile(r"[\u05D0-\u05EA]")

HEBREW_NAMES = {
    "Genesis": "בראשית", "Exodus": "שמות", "Leviticus": "ויקרא",
    "Numbers": "במדבר", "Deuteronomy": "דברים", "Joshua": "יהושע",
    "Judges": "שופטים", "I Samuel": "שמואל א", "II Samuel": "שמואל ב",
    "I Kings": "מלכים א", "II Kings": "מלכים ב", "Isaiah": "ישעיהו",
    "Jeremiah": "ירמיהו", "Ezekiel": "יחזקאל", "Hosea": "הושע",
    "Joel": "יואל", "Amos": "עמוס", "Obadiah": "עובדיה",
    "Jonah": "יונה", "Micah": "מיכה", "Nahum": "נחום",
    "Habakkuk": "חבקוק", "Zephaniah": "צפניה", "Haggai": "חגי",
    "Zechariah": "זכריה", "Malachi": "מלאכי", "Psalms": "תהלים",
    "Proverbs": "משלי", "Job": "איוב", "Song of Songs": "שיר השירים",
    "Ruth": "רות", "Lamentations": "איכה", "Ecclesiastes": "קהלת",
    "Esther": "אסתר", "Daniel": "דניאל", "Ezra": "עזרא",
    "Nehemiah": "נחמיה", "I Chronicles": "דברי הימים א",
    "II Chronicles": "דברי הימים ב",
}

# 39 Tanach books: (Sefaria name, Ashkenazi name, section index)
# section: 0 = Torah, 1 = Neviim, 2 = Kesuvim
BOOKS = [
    # Torah
    ("Genesis", "Bereishis", 0),
    ("Exodus", "Shemos", 0),
    ("Leviticus", "Vayikra", 0),
    ("Numbers", "Bamidbar", 0),
    ("Deuteronomy", "Devarim", 0),
    # Neviim
    ("Joshua", "Yehoshua", 1),
    ("Judges", "Shoftim", 1),
    ("I Samuel", "Shmuel I", 1),
    ("II Samuel", "Shmuel II", 1),
    ("I Kings", "Melachim I", 1),
    ("II Kings", "Melachim II", 1),
    ("Isaiah", "Yeshayahu", 1),
    ("Jeremiah", "Yirmiyahu", 1),
    ("Ezekiel", "Yechezkel", 1),
    ("Hosea", "Hoshea", 1),
    ("Joel", "Yoel", 1),
    ("Amos", "Amos", 1),
    ("Obadiah", "Ovadiah", 1),
    ("Jonah", "Yonah", 1),
    ("Micah", "Michah", 1),
    ("Nahum", "Nachum", 1),
    ("Habakkuk", "Chavakuk", 1),
    ("Zephaniah", "Tzefaniah", 1),
    ("Haggai", "Chaggai", 1),
    ("Zechariah", "Zechariah", 1),
    ("Malachi", "Malachi", 1),
    # Kesuvim
    ("Psalms", "Tehillim", 2),
    ("Proverbs", "Mishlei", 2),
    ("Job", "Iyov", 2),
    ("Song of Songs", "Shir HaShirim", 2),
    ("Ruth", "Rus", 2),
    ("Lamentations", "Eichah", 2),
    ("Ecclesiastes", "Koheles", 2),
    ("Esther", "Esther", 2),
    ("Daniel", "Daniel", 2),
    ("Ezra", "Ezra", 2),
    ("Nehemiah", "Nechemyah", 2),
    ("I Chronicles", "Divrei HaYamim I", 2),
    ("II Chronicles", "Divrei HaYamim II", 2),
]


def fetch_json(url, retries=1):
    """Fetch JSON from URL with retry."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TanachBuildScript/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt < retries:
                print(f"  Retry after error: {e}")
                time.sleep(2)
            else:
                raise


def _clean_common(text):
    """Shared cleanup: HTML, maqaf, ketiv/qere, entities, braces, names."""
    text = HTML_RE.sub("", text)
    text = text.replace("\u05BE", " ")  # maqaf → space
    text = KETIV_QERE_RE.sub(
        lambda m: (re.search(r"\[([^\]]*)\]", m.group()) or type("", (), {"group": lambda s, *a: ""})()).group(1),
        text,
    )
    text = PARENS_NOTE_RE.sub("", text)
    text = BRACKET_RE.sub(r"\1", text)
    text = ENTITY_RE.sub(" ", text)
    text = BRACE_RE.sub(" ", text)
    text = CGJ_RE.sub("", text)
    text = text.replace("\u05F4", "").replace("*", "")
    return text


def clean_hebrew_display(text):
    """Clean for display: keeps nikud, replaces divine names."""
    text = _clean_common(text)
    # Replace divine names (on nikud-bearing text, match with optional nikud between letters)
    # Tetragrammaton: יהוה with possible nikud
    text = re.sub(r"\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*", "\u05D4'", text)
    # Elokim: אלהים with possible nikud
    text = re.sub(r"\u05D0[\u0591-\u05C7]*\u05DC[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D9[\u0591-\u05C7]*\u05DD[\u0591-\u05C7]*",
                  "\u05D0\u05DC\u05E7\u05D9\u05DD", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip()
    return text


def clean_hebrew_search(text):
    """Clean for search: strips nikud, replaces divine names."""
    text = _clean_common(text)
    text = NIKUD_RE.sub("", text)
    text = TETRA_RE.sub("\u05D4'", text)
    text = ELOKIM_RE.sub("\u05D0\u05DC\u05E7\u05D9\u05DD", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip()
    return text


def clean_english(text):
    """Strip HTML tags from English text."""
    return HTML_RE.sub("", text)


def sofit_normalize(ch):
    """Normalize a final-form Hebrew letter to its regular form."""
    return SOFIT_MAP.get(ch, ch)


def get_first_last_hebrew(text):
    """Get first and last Hebrew letters in text, sofit-normalized."""
    letters = HEBREW_LETTER_RE.findall(text)
    if not letters:
        return None, None
    return sofit_normalize(letters[0]), sofit_normalize(letters[-1])


def flatten_text(data):
    """
    Sefaria v3 returns text as nested arrays: [chapter][verse].
    Flattens to a list of (chapter_num, verse_num, text) tuples.
    """
    results = []
    if not isinstance(data, list):
        return results

    for c_idx, chapter in enumerate(data):
        if chapter is None:
            continue
        if isinstance(chapter, str):
            results.append((1, c_idx + 1, chapter))
            continue
        if isinstance(chapter, list):
            for v_idx, verse in enumerate(chapter):
                if verse is None or verse == "" or verse == []:
                    continue
                if isinstance(verse, list):
                    verse = " ".join(v for v in verse if isinstance(v, str) and v)
                if isinstance(verse, str) and verse.strip():
                    results.append((c_idx + 1, v_idx + 1, verse))
    return results


def fetch_book(sefaria_name):
    """Fetch both Hebrew and English text for a book in a single API call."""
    name_encoded = sefaria_name.replace(" ", "%20")
    en_version = ENGLISH_VERSION.replace(" ", "%20")
    url = f"{SEFARIA_BASE}{name_encoded}?version=source&version=english|{en_version}"

    data = fetch_json(url)
    versions = data.get("versions", [])

    he_text, en_text = [], []
    for v in versions:
        if v.get("language") == "he" and not he_text:
            he_text = v.get("text", [])
        elif v.get("language") == "en" and not en_text:
            en_text = v.get("text", [])

    if not he_text:
        raise ValueError(f"No Hebrew text found for {sefaria_name}")

    # If Koren wasn't available, try fallback with default English
    if not en_text:
        print(f"  Koren not available, trying default English...")
        fallback_url = f"{SEFARIA_BASE}{name_encoded}?version=source"
        fallback_data = fetch_json(fallback_url)
        for v in fallback_data.get("versions", []):
            if v.get("language") == "en":
                en_text = v.get("text", [])
                break

    return he_text, en_text


def build():
    output_path = Path(__file__).parent.parent / "data" / "tanach.json"
    books_meta = []
    all_verses = []

    for book_idx, (sefaria_name, ashkenazi_name, section) in enumerate(BOOKS):
        print(f"[{book_idx + 1}/39] Fetching {sefaria_name} ({ashkenazi_name})...")

        he_text, en_text = fetch_book(sefaria_name)
        he_verses = flatten_text(he_text)
        en_verses = flatten_text(en_text)
        time.sleep(0.5)

        en_lookup = {(c, v): t for c, v, t in en_verses}

        books_meta.append({
            "h": HEBREW_NAMES.get(sefaria_name, ""),
            "e": ashkenazi_name,
            "s": section,
        })

        verse_count = 0
        for c_num, v_num, he_raw in he_verses:
            he_display = clean_hebrew_display(he_raw)
            he_search = clean_hebrew_search(he_raw)
            en_raw = en_lookup.get((c_num, v_num), "")
            en_clean = clean_english(en_raw) if en_raw else ""

            fl, ll = get_first_last_hebrew(he_search)
            if fl is None:
                continue

            all_verses.append({
                "h": he_display,
                "hs": he_search,
                "e": en_clean,
                "b": book_idx,
                "c": c_num,
                "v": v_num,
                "fl": fl,
                "ll": ll,
            })
            verse_count += 1

        print(f"  -> {verse_count} verses")

    result = {
        "meta": {"v": "1.0", "count": len(all_verses)},
        "books": books_meta,
        "verses": all_verses,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"\nDone! {len(all_verses)} verses written to {output_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    build()
