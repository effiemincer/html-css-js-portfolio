# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal portfolio website (effiemincer.dev) built with vanilla HTML, CSS, and JavaScript. No frameworks, no build tools, no package manager.

## Running Locally

Open `index.html` directly in a browser, or use a local server:
```bash
python -m http.server 8000
# or
npx http-server
```

There is no build step, linting, or test suite.

## Architecture

Single-page site with three source files, a data file, a build script, and an assets directory:

- **index.html** — Semantic HTML5 with six content sections (Profile, About, Experience, Pesukim, Projects, Contact). Includes Schema.org JSON-LD structured data and Open Graph meta tags.
- **style.css** — All styling, organized around CSS custom properties in OKLCH color space. Light theme is the default; dark theme activates via `data-theme="dark"` on `<html>` (`:root`). Uses `clamp()` for responsive typography with three accent colors (`--accent`, `--teal`, `--plum`). Typography uses Bricolage Grotesque (headings) and Hanken Grotesk (body). Includes hero letter animation keyframes (`letter-in`, `letter-glow`, `letter-breathe`).
- **mediaqueries.css** — Three responsive tiers: mobile (<768px, single-column stacked layout), tablet (768px+, 2-column grids, side-by-side projects), desktop (1024px+, full-viewport hero, wider sidebar). The 1023px/1024px breakpoint toggles between mobile nav and desktop nav.
- **script.js** — All interactivity, initialized on `DOMContentLoaded`. Key systems:
  - Mobile hamburger menu with Escape key support
  - Smooth anchor scrolling with header offset calculation
  - Dark/light theme toggle persisted to `localStorage`
  - Scroll spy for active nav highlighting
  - Intersection Observer-based reveal animations
  - Hero letter animation: `splitHeroName()` splits the `<h1>` into individual `<span>` elements, triggers a staggered entrance animation (letter-by-letter reveal + three-color glow sweep), then hands off to a looping idle glow (`letter-breathe`). Uses double-`requestAnimationFrame` to guarantee at least one paint before animating.
  - Hero scroll parallax: on desktop (1024px+), the `.hero` container fades and drifts upward on scroll
  - Respects `prefers-reduced-motion` (disables entrance motion; keeps the idle color glow) and `prefers-color-scheme`
  - Pesukim search module (`setupPesukim()`): loads `data/tanach.json` lazily, searches by Hebrew name for first/last-letter match, contains-name match, and "Super Match" (both). Results group into Super/Contains/Letters × Torah/Neviim/Kesuvim panels, 10 per page with numbered pagination (Prev / page numbers with ellipses / Next; rendered by `renderPagination()` and navigated via `goToPage()`). Hebrew keyboard overlay. Layout has three regions: (1) the intro paragraph lives outside `.pesukim-app` as a full-width lead, (2) a primary CTA row with only the `Find Pesukim` button, and (3) a results `.pesukim-toolbar` (lang Hebrew/English/Both, sort quality/chronological, scores icon-toggle) that is hidden until a search runs and then revealed via `data-visible="true"` (max-height + opacity transition). All state persists to `localStorage`. Cantillation marks are stripped at render time via `TAAMIM_RE` (`U+0591–U+05AF` + `U+05BD` Meteg/Silluq); nikud is preserved. Shareable links: every successful search mirrors the current name into the URL as `?name=<encoded>#pesukim` via `history.replaceState`, and on load any `?name=` param pre-fills the input, auto-runs the search after `loadData()` resolves, and scrolls the `#pesukim` section into view (respects `prefers-reduced-motion`). A prominent `.pesukim-share` button is rendered next to each name `<h3>` inside `.pesukim-name-group__header` (built by `buildNameHeader()`). All share buttons share the same URL — the full live `input.value` at click time — so a multi-name search like `גבריאל ישראל` produces a single shareable link containing both names. On touch-primary phones (`pointer:coarse` AND `hover:none` AND `max-width:900px`) the button invokes `navigator.share({title,text,url})`, otherwise it copies the URL via `navigator.clipboard.writeText` (falling back to textarea + `document.execCommand('copy')`, then `window.prompt`). Detection happens at click time via `shouldUseNativeShare()` so window resizes are respected. The button label flips between "Share" and "Copy link" accordingly; a successful copy flashes "Link copied!" via `data-copied="true"` for 1.5s.

## Data & Build Scripts

- **`data/tanach.json`** — Flat JSON with `meta`, `books` (39 entries with Hebrew/Ashkenazi names and Torah/Neviim/Kesuvim section index), and `verses` (each with display Hebrew `h` including nikud+trope, search Hebrew `hs` without nikud, English `e`, book index `b`, chapter `c`, verse `v`, first/last sofit-normalized Hebrew letter `fl`/`ll`, and prominence score `q` 0–255).
- **`scripts/build_tanach_data.py`** — Fetches all 39 Tanach books from Sefaria (Koren Jerusalem Bible) and regenerates `tanach.json`. Does not populate `q`.
- **`scripts/score_pesukim.py`** — Populates the `q` field by fetching Sefaria link data chapter-by-chapter (~929 API calls, ~8 min cold; seconds warm from `scripts/.cache/links/`). Each verse's weighted category counts (Liturgy 5×, Talmud/Midrash/Mishnah 3×, Chasidut/Kabbalah/Jewish Thought/Musar/Halakhah 1.5×, Commentary/Quoting Commentary 0.3×) are log-transformed and min/max-normalized to 0–255. Usage: `python scripts/score_pesukim.py` (write), `--report` (use cache, print sanity report), `--dry-run` (skip write). `scripts/.cache/` is gitignored.

## Cross-File Couplings

These are easy to break if you only edit one file:

- **`toggleMenu()`** is called inline from `index.html` (`onclick="toggleMenu()"`) and defined as a global in `script.js`. Don't rename without updating both.
- **`SECTION_IDS`** in `script.js` (`['profile', 'about', 'experience', 'pesukim', 'projects', 'contact']`) must match the `id` attributes on `<section>` elements in `index.html`. The scroll spy and nav highlighting depend on this.
- **Theme attribute**: JS sets `document.documentElement.dataset.theme`, CSS reads `:root[data-theme="dark"]`, and the HTML initializes with `data-theme="light"` on `<html>`. An inline `<script>` in `<head>` also reads `localStorage` key `'theme-preference'` (same as `THEME_KEY` in `script.js`) to prevent a theme flash on load. All four must agree on attribute name, location, and storage key.
- **Hero letter animation**: `splitHeroName()` in `script.js` replaces the text content of `.hero__name` with individual `<span class="hero__letter">` elements. CSS animations (`.hero__name.in-view .hero__letter` and `.hero__name.in-view .hero__letter--ready`) depend on this DOM structure. If you change the hero `<h1>` content in HTML, the JS will re-split it on load. The `--char-i` CSS variable on each span drives the stagger timing.
- **Theme toggle icons**: Both navs contain paired `<svg class="theme-toggle__sun">` and `<svg class="theme-toggle__moon">` inside `.theme-toggle` buttons. CSS shows/hides them based on `data-theme`. Don't remove one without the other.
- **Pesukim verse `q` score**: `setupPesukim()` in `script.js` reads `verse.q` from `data/tanach.json` to sort results in "Most famous first" mode. If you regenerate `tanach.json` via `build_tanach_data.py`, `q` is missing — re-run `scripts/score_pesukim.py` to restore it. The `.pesukim-verse-q` badge and its tooltip are only visible when `.pesukim-results--show-scores` is set on the results container.
- **Pesukim toggles**: Three toggles live inside `.pesukim-toolbar` (language, sort, show-scores) and are wired by class selector in `setupPesukim()`; they persist to `localStorage` keys `pesukim-sort` and `pesukim-show-scores` (the language toggle is session-only). Renaming any of `.pesukim-lang-toggle`, `.pesukim-sort-toggle`, `.pesukim-score-toggle`, or their `__btn` children breaks the handler. The toolbar itself is revealed by setting `data-visible="true"` inside `doSearch()` after a successful render — collapsed by default via `max-height:0` + `opacity:0`.
- **Pesukim share button**: `.pesukim-share` is rendered per name-group by `buildNameHeader()` and handled via event delegation on `.pesukim-results` (alongside pagination and verse-expand clicks). It uses two icon SVGs + two label `<span>`s — the `--success` variants are revealed by CSS when `data-copied="true"` is set. The share URL is derived from `input.value.trim()` at click time (not from any per-button data attribute), so the live search query is always what gets shared. Renaming `.pesukim-share`, `.pesukim-share__icon--success`, or `.pesukim-share__label--success` breaks the success-state CSS.
- **Pesukim pagination**: `renderPagination()` emits `.pesukim-pagination` containing `.pesukim-pagination__arrow` (Prev/Next) and `.pesukim-pagination__page` (numbered) buttons, plus `.pesukim-pagination__ellipsis` spans. Buttons carry `data-page-key` (panel id) and `data-page` (1-based) attributes, both required by the delegated click handler in `wireUpResultsDelegation()`. `goToPage()` re-slices the verse list and uses `replaceWith` to swap the bar; `applySortAndRerender()` rebuilds the bar at page 1 after a sort change. Per-panel pagination state lives on `pageState[panelKey].currentPage`.
- **Pesukim URL param**: `setupPesukim()` both reads and writes the `?name=` query param. `doSearch()` calls `history.replaceState` after a successful render; `runSearchFromUrl()` (called at the end of `setupPesukim()`) reads the param on load. The param name is the single source of truth — changing it requires updating both sites.

## Theming

All colors are defined as CSS custom properties in OKLCH color space in `:root` (light default) and `:root[data-theme="dark"]` selectors in `style.css`. Three accent colors: `--accent` (warm orange/amber), `--teal`, and `--plum` — each with a `-soft` variant for backgrounds. The hero letter-breathe animation cycles through all three accents. To change the color scheme, modify the custom properties — don't hardcode color values elsewhere.

## Assets

The `assets/` directory contains profile images, project screenshots, social icons, a favicon, and a resume PDF. Image filenames are referenced directly in `index.html`.
