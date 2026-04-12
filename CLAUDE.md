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

Single-page site with three source files and an assets directory:

- **index.html** — Semantic HTML5 with five content sections (Profile, About, Experience, Projects, Contact). Includes Schema.org JSON-LD structured data and Open Graph meta tags.
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

## Cross-File Couplings

These are easy to break if you only edit one file:

- **`toggleMenu()`** is called inline from `index.html` (`onclick="toggleMenu()"`) and defined as a global in `script.js`. Don't rename without updating both.
- **`SECTION_IDS`** in `script.js` (`['profile', 'about', 'experience', 'projects', 'contact']`) must match the `id` attributes on `<section>` elements in `index.html`. The scroll spy and nav highlighting depend on this.
- **Theme attribute**: JS sets `document.documentElement.dataset.theme`, CSS reads `:root[data-theme="dark"]`, and the HTML initializes with `data-theme="light"` on `<html>`. An inline `<script>` in `<head>` also reads `localStorage` key `'theme-preference'` (same as `THEME_KEY` in `script.js`) to prevent a theme flash on load. All four must agree on attribute name, location, and storage key.
- **Hero letter animation**: `splitHeroName()` in `script.js` replaces the text content of `.hero__name` with individual `<span class="hero__letter">` elements. CSS animations (`.hero__name.in-view .hero__letter` and `.hero__name.in-view .hero__letter--ready`) depend on this DOM structure. If you change the hero `<h1>` content in HTML, the JS will re-split it on load. The `--char-i` CSS variable on each span drives the stagger timing.
- **Theme toggle icons**: Both navs contain paired `<svg class="theme-toggle__sun">` and `<svg class="theme-toggle__moon">` inside `.theme-toggle` buttons. CSS shows/hides them based on `data-theme`. Don't remove one without the other.

## Theming

All colors are defined as CSS custom properties in OKLCH color space in `:root` (light default) and `:root[data-theme="dark"]` selectors in `style.css`. Three accent colors: `--accent` (warm orange/amber), `--teal`, and `--plum` — each with a `-soft` variant for backgrounds. The hero letter-breathe animation cycles through all three accents. To change the color scheme, modify the custom properties — don't hardcode color values elsewhere.

## Assets

The `assets/` directory contains profile images, project screenshots, social icons, a favicon, and a resume PDF. Image filenames are referenced directly in `index.html`.
