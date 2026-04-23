const THEME_KEY = 'theme-preference';
const SECTION_IDS = ['profile', 'about', 'experience', 'pesukim', 'projects', 'contact'];
const PESUKIM_SCROLL_KEY = 'pesukim-reload-scroll-y';
let heroAnimTimeout = null;
let tanachData = null;
let tanachLoadPromise = null;

// On pages with a pesukim shareable link (?name=), manage scroll restoration ourselves.
// doSearch() renders hundreds of verses into the pesukim section after the browser has
// already restored scroll, which triggers scroll anchoring and shifts scrollY down.
// Manual restoration pins scrollY to its pre-refresh value.
if (history.scrollRestoration) {
  try {
    if (new URLSearchParams(location.search).get('name')) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) { /* ignore */ }
}

window.addEventListener('pagehide', function () {
  try { sessionStorage.setItem(PESUKIM_SCROLL_KEY, String(window.scrollY)); } catch (e) {}
});

function toggleMenu(forceOpen) {
  const menu = document.querySelector('.menu-links');
  const icon = document.querySelector('.hamburger-icon');
  if (!menu || !icon) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !menu.classList.contains('open');
  menu.classList.toggle('open', shouldOpen);
  icon.classList.toggle('open', shouldOpen);
  icon.setAttribute('aria-expanded', String(shouldOpen));
  menu.setAttribute('aria-hidden', String(!shouldOpen));
}

function getHeaderOffset() {
  const header = document.querySelector('header');
  return header ? Math.ceil(header.getBoundingClientRect().height + 10) : 74;
}

function setupMobileMenu() {
  const menu = document.querySelector('.menu-links');
  const hamburger = document.querySelector('.hamburger-icon');
  if (!menu || !hamburger) return;

  document.querySelectorAll('.menu-links a').forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !hamburger.contains(event.target)) {
      toggleMenu(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleMenu(false);
      hamburger.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) toggleMenu(false);
  }, { passive: true });
}

function setupSmoothAnchorScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const offset = getHeaderOffset();
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });

      if (history.replaceState) {
        history.replaceState(null, '', href);
      }
    });
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

function setupTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const stored = localStorage.getItem(THEME_KEY);
  const initial = stored || (prefersDark.matches ? 'dark' : 'light');
  applyTheme(initial);

  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  });

  prefersDark.addEventListener('change', (event) => {
    if (localStorage.getItem(THEME_KEY)) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });
}

function setupScrollSpy() {
  const sections = SECTION_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;

  const activate = (id) => {
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    });

    document.querySelectorAll(`.nav-link[href="#${id}"]`).forEach((link) => {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    });
  };

  let ticking = false;

  function update() {
    const offset = getHeaderOffset();
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // At page bottom, activate the last section
    if (docHeight - scrollBottom < 2) {
      activate(sections[sections.length - 1].id);
      ticking = false;
      return;
    }

    // Current section = last one whose top has scrolled past the header offset
    let current = null;
    for (const section of sections) {
      if (window.scrollY >= section.offsetTop - offset) {
        current = section.id;
      }
    }

    if (current) activate(current);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

function setupRevealAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
    return;
  }

  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  elements.forEach((el) => observer.observe(el));
}

function splitHeroName() {
  const name = document.querySelector('.hero__name');
  if (!name) return;

  name.setAttribute('aria-label', name.textContent.trim());
  let charIndex = 0;
  let html = '';

  name.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const ch of node.textContent) {
        if (ch.trim() === '') {
          html += ch;
        } else {
          html += '<span class="hero__letter" style="--char-i:' + charIndex + '" aria-hidden="true">' + ch + '</span>';
          charIndex++;
        }
      }
    } else if (node.nodeName === 'BR') {
      html += '<br>';
    }
  });

  name.innerHTML = html;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    name.classList.add('in-view');
    name.querySelectorAll('.hero__letter').forEach((l) => {
      l.style.opacity = '1';
      l.style.transform = 'none';
      l.classList.add('hero__letter--ready');
    });
    return;
  }

  // Double-rAF guarantees at least one paint with letters hidden
  // before the animation starts — so the user actually sees it
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      name.classList.add('in-view');
      var letters = name.querySelectorAll('.hero__letter');
      var total = letters.length;
      var entranceDone = (total - 1) * 55 + 500;
      var glowDone = 900 + (total - 1) * 40 + 1500;
      var animDone = Math.max(entranceDone, glowDone);

      heroAnimTimeout = setTimeout(function () {
        letters.forEach(function (l) {
          l.style.opacity = '1';
          l.style.transform = 'translateY(0)';
          l.style.animation = '';
          l.classList.add('hero__letter--ready');
        });
        heroAnimTimeout = null;
      }, animDone + 100);
    });
  });
}

function setupHeroParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 1024) return;

  const hero = document.querySelector('.hero');
  if (!hero) return;

  hero.style.willChange = 'transform, opacity';
  let ticking = false;

  function update() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    if (scrollY > vh) { ticking = false; return; }

    const progress = Math.min(scrollY / (vh * 0.65), 1);
    hero.style.opacity = String(1 - progress);
    hero.style.transform = 'translateY(' + (scrollY * 0.12) + 'px)';
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function setupPesukim() {
  var SECTION_NAMES = ['Torah', 'Neviim', 'Kesuvim'];
  var PAGE_SIZE = 10;
  var SOFIT_MAP = {'\u05DA':'\u05DB','\u05DD':'\u05DE','\u05DF':'\u05E0','\u05E3':'\u05E4','\u05E5':'\u05E6'};
  var KB_ROWS = [
    ['\u05D0','\u05D1','\u05D2','\u05D3','\u05D4','\u05D5','\u05D6','\u05D7','\u05D8'],
    ['\u05D9','\u05DB','\u05DC','\u05DE','\u05E0','\u05E1','\u05E2','\u05E4','\u05E6'],
    ['\u05E7','\u05E8','\u05E9','\u05EA','\u05DA','\u05DD','\u05DF','\u05E3','\u05E5']
  ];

  var SORT_KEY = 'pesukim-sort';
  var SCORES_KEY = 'pesukim-show-scores';
  var SCORE_TOOLTIP = 'Prominence score 0\u2013255: citations in siddur/liturgy, Talmud, Midrash, and commentaries. Higher means more widely referenced in Jewish tradition.';
  var TAAMIM_RE = /[\u0591-\u05AF\u05BD]/g;

  var input = document.getElementById('pesukim-name');
  var searchBtn = document.querySelector('.pesukim-search');
  var statusEl = document.getElementById('pesukim-status');
  var resultsEl = document.querySelector('.pesukim-results');
  var kbToggle = document.querySelector('.pesukim-kb-toggle');
  var kbContainer = document.getElementById('pesukim-keyboard');
  var langToggle = document.querySelector('.pesukim-lang-toggle');
  var sortToggle = document.querySelector('.pesukim-sort-toggle');
  var scoreToggle = document.querySelector('.pesukim-score-toggle');
  var copyLinkBtn = document.querySelector('.pesukim-copy-link');
  if (!input || !searchBtn || !statusEl || !resultsEl || !kbToggle || !kbContainer) return;

  // Current display language: 'he', 'en', or 'both'
  var displayLang = 'both';
  resultsEl.dataset.lang = displayLang;

  // Sort mode: 'quality' (default) or 'chronological'
  var sortMode = localStorage.getItem(SORT_KEY) === 'chronological' ? 'chronological' : 'quality';
  // Score visibility: defaults off
  var showScores = localStorage.getItem(SCORES_KEY) === 'true';
  resultsEl.classList.toggle('pesukim-results--show-scores', showScores);

  // Page state for Show More buttons: keyed by "nameIdx-criteriaType-sectionIdx"
  var pageState = {};

  function sortIndicesByMode(indices) {
    if (sortMode === 'quality') {
      indices.sort(function (a, b) {
        var qa = tanachData.verses[a].q || 0;
        var qb = tanachData.verses[b].q || 0;
        if (qb !== qa) return qb - qa;
        return a - b; // stable tiebreak: chronological
      });
    } else {
      indices.sort(function (a, b) { return a - b; });
    }
  }

  // --- Data loading ---
  function loadData() {
    if (tanachLoadPromise) return tanachLoadPromise;
    tanachLoadPromise = fetch('./data/tanach.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        tanachData = data;
        updateButtonState();
      })
      .catch(function () {
        statusEl.textContent = 'Failed to load verse data. Please refresh the page.';
        tanachLoadPromise = null;
      });
    return tanachLoadPromise;
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(function () { loadData(); });
  } else {
    setTimeout(function () { loadData(); }, 2000);
  }

  // --- Button state ---
  function updateButtonState() {
    var hasInput = !!input.value.trim();
    searchBtn.disabled = !(hasInput && tanachData);
    if (copyLinkBtn) copyLinkBtn.disabled = !hasInput;
  }

  input.addEventListener('input', updateButtonState);

  // --- Keyboard ---
  function buildKeyboard() {
    KB_ROWS.forEach(function (row) {
      row.forEach(function (letter) {
        var key = document.createElement('button');
        key.type = 'button';
        key.className = 'pesukim-keyboard__key';
        key.textContent = letter;
        key.dataset.char = letter;
        kbContainer.appendChild(key);
      });
    });

    // Utility row: backspace, hyphen, space
    var backspace = document.createElement('button');
    backspace.type = 'button';
    backspace.className = 'pesukim-keyboard__key pesukim-keyboard__key--backspace';
    backspace.textContent = '\u232B';
    backspace.dataset.action = 'backspace';
    backspace.setAttribute('aria-label', 'Backspace');
    kbContainer.appendChild(backspace);

    var hyphen = document.createElement('button');
    hyphen.type = 'button';
    hyphen.className = 'pesukim-keyboard__key';
    hyphen.textContent = '-';
    hyphen.dataset.char = '-';
    kbContainer.appendChild(hyphen);

    var space = document.createElement('button');
    space.type = 'button';
    space.className = 'pesukim-keyboard__key pesukim-keyboard__key--space';
    space.textContent = '\u2423';
    space.dataset.char = ' ';
    space.setAttribute('aria-label', 'Space');
    kbContainer.appendChild(space);
  }

  buildKeyboard();

  // Event delegation on keyboard
  kbContainer.addEventListener('click', function (e) {
    var key = e.target.closest('.pesukim-keyboard__key');
    if (!key) return;

    var start = input.selectionStart || 0;
    var end = input.selectionEnd || 0;
    var val = input.value;

    if (key.dataset.action === 'backspace') {
      if (start !== end) {
        input.value = val.slice(0, start) + val.slice(end);
        input.selectionStart = input.selectionEnd = start;
      } else if (start > 0) {
        input.value = val.slice(0, start - 1) + val.slice(start);
        input.selectionStart = input.selectionEnd = start - 1;
      }
    } else if (key.dataset.char) {
      var ch = key.dataset.char;
      input.value = val.slice(0, start) + ch + val.slice(end);
      input.selectionStart = input.selectionEnd = start + ch.length;
    }

    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Toggle keyboard
  kbToggle.addEventListener('click', function () {
    var isOpen = !kbContainer.classList.contains('pesukim-keyboard--closed');
    kbContainer.classList.toggle('pesukim-keyboard--closed', isOpen);
    kbContainer.setAttribute('aria-hidden', String(isOpen));
    kbToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Language toggle
  if (langToggle) {
    langToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.pesukim-lang-toggle__btn');
      if (!btn) return;
      var lang = btn.dataset.lang;
      if (lang === displayLang) return;
      displayLang = lang;
      resultsEl.dataset.lang = lang;
      langToggle.querySelectorAll('.pesukim-lang-toggle__btn').forEach(function (b) {
        var active = b.dataset.lang === lang;
        b.classList.toggle('pesukim-lang-toggle__btn--active', active);
        b.setAttribute('aria-checked', String(active));
      });
    });
  }

  // Sort toggle: initialize from stored sortMode, then wire click handler
  if (sortToggle) {
    sortToggle.querySelectorAll('.pesukim-sort-toggle__btn').forEach(function (b) {
      var active = b.dataset.sort === sortMode;
      b.classList.toggle('pesukim-sort-toggle__btn--active', active);
      b.setAttribute('aria-checked', String(active));
    });
    sortToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.pesukim-sort-toggle__btn');
      if (!btn) return;
      var newMode = btn.dataset.sort;
      if (newMode === sortMode) return;
      sortMode = newMode;
      localStorage.setItem(SORT_KEY, sortMode);
      sortToggle.querySelectorAll('.pesukim-sort-toggle__btn').forEach(function (b) {
        var active = b.dataset.sort === sortMode;
        b.classList.toggle('pesukim-sort-toggle__btn--active', active);
        b.setAttribute('aria-checked', String(active));
      });
      applySortAndRerender();
    });
  }

  // Show-scores toggle: initialize state, then wire click handler
  if (scoreToggle) {
    scoreToggle.setAttribute('aria-pressed', String(showScores));
    scoreToggle.classList.toggle('pesukim-score-toggle--active', showScores);
    scoreToggle.addEventListener('click', function () {
      showScores = !showScores;
      localStorage.setItem(SCORES_KEY, String(showScores));
      scoreToggle.setAttribute('aria-pressed', String(showScores));
      scoreToggle.classList.toggle('pesukim-score-toggle--active', showScores);
      resultsEl.classList.toggle('pesukim-results--show-scores', showScores);
    });
  }

  function applySortAndRerender() {
    Object.keys(pageState).forEach(function (panelKey) {
      var data = pageState[panelKey];
      sortIndicesByMode(data.indices);
      data.shown = PAGE_SIZE;
      var panel = resultsEl.querySelector('[data-panel-id="' + panelKey + '"]');
      if (!panel) return;
      var listEl = panel.querySelector('.pesukim-verse-list');
      if (listEl) listEl.innerHTML = renderVerseItems(data.indices.slice(0, PAGE_SIZE));
      var remaining = data.indices.length - PAGE_SIZE;
      var btn = panel.querySelector('.pesukim-show-more');
      if (remaining > 0) {
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pesukim-show-more btn btn--ghost';
          btn.dataset.pageKey = panelKey;
          panel.appendChild(btn);
        }
        btn.textContent = 'Show More (' + remaining + ' remaining)';
      } else if (btn) {
        btn.remove();
      }
    });
  }

  // --- Search logic ---
  function sofitNorm(ch) {
    return SOFIT_MAP[ch] || ch;
  }

  function escapeRegex(str) {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function searchName(nameToken) {
    var containsToken = nameToken.replace(/-/g, ' ');
    var escaped = escapeRegex(containsToken);
    var wordRe = new RegExp('(?:^|[^\\u05D0-\\u05EA])' + escaped + '(?:$|[^\\u05D0-\\u05EA])');

    var letters = nameToken.replace(/[^\\u05D0-\\u05EA\u05D0-\u05EA]/g, '');
    // Extract actual Hebrew letters from the token
    var hebrewLetters = nameToken.match(/[\u05D0-\u05EA]/g);
    var nameFirst = hebrewLetters ? sofitNorm(hebrewLetters[0]) : null;
    var nameLast = hebrewLetters ? sofitNorm(hebrewLetters[hebrewLetters.length - 1]) : null;

    var containsSet = [];
    var letterSet = [];
    var superSet = [];
    var verses = tanachData.verses;

    for (var i = 0; i < verses.length; i++) {
      var v = verses[i];
      var inContains = wordRe.test(v.hs || v.h);
      var inLetters = nameFirst && nameLast && v.fl === nameFirst && v.ll === nameLast;

      if (inContains && inLetters) {
        superSet.push(i);
      } else if (inContains) {
        containsSet.push(i);
      } else if (inLetters) {
        letterSet.push(i);
      }
    }

    return { super: superSet, contains: containsSet, letters: letterSet };
  }

  // Active panel key for master-detail view
  var activePanel = null;

  function doSearch() {
    if (!tanachData) return;
    var rawValue = input.value.trim();
    if (!rawValue) return;

    statusEl.textContent = 'Searching\u2026';
    statusEl.className = 'pesukim-status pesukim-status--loading';
    resultsEl.innerHTML = '';
    pageState = {};
    activePanel = null;

    setTimeout(function () {
      var tokens = rawValue.split(/\s+/).filter(function (t) { return t.length > 0; });
      var totalFound = 0;
      var html = '';
      var firstPanelKey = null;

      tokens.forEach(function (token, nameIdx) {
        var result = searchName(token);
        var nameTotal = result.super.length + result.contains.length + result.letters.length;
        totalFound += nameTotal;

        if (nameTotal === 0) {
          html += '<div class="pesukim-name-group"><h3>' + escapeHtml(token) + '</h3>';
          html += '<p class="pesukim-empty">No matching verses found for this name.</p></div>';
          return;
        }

        html += '<div class="pesukim-name-group"><h3>' + escapeHtml(token) + '</h3>';

        // Build section data for nav and panels
        var groups = [];
        var criteriaTypes = [
          { key: 'super', label: 'Super Match', indices: result.super },
          { key: 'contains', label: 'Contains Name', indices: result.contains },
          { key: 'letters', label: 'Letter Match', indices: result.letters }
        ];

        criteriaTypes.forEach(function (crit) {
          if (!crit.indices.length) return;
          var bySec = [[], [], []];
          crit.indices.forEach(function (i) {
            var v = tanachData.verses[i];
            bySec[tanachData.books[v.b].s].push(i);
          });
          var sections = [];
          bySec.forEach(function (secIndices, secIdx) {
            if (!secIndices.length) return;
            var panelKey = nameIdx + '-' + crit.key + '-' + secIdx;
            if (!firstPanelKey) firstPanelKey = panelKey;
            sortIndicesByMode(secIndices);
          pageState[panelKey] = { indices: secIndices, currentPage: 1 };
            sections.push({ secIdx: secIdx, panelKey: panelKey, count: secIndices.length });
          });
          groups.push({ key: crit.key, label: crit.label, total: crit.indices.length, sections: sections });
        });

        // Master-detail browser
        html += '<div class="pesukim-browser">';

        // Nav sidebar
        html += '<nav class="pesukim-nav" aria-label="Verse categories">';
        groups.forEach(function (g) {
          html += '<div class="pesukim-nav__group pesukim-nav__group--' + g.key + '">';
          html += '<span class="pesukim-nav__heading">' + g.label + ' <span class="pesukim-nav__total">' + g.total + '</span></span>';
          g.sections.forEach(function (sec) {
            html += '<button type="button" class="pesukim-nav__item" data-panel="' + sec.panelKey + '">';
            html += SECTION_NAMES[sec.secIdx];
            html += '<span class="pesukim-nav__count">' + sec.count + '</span>';
            html += '</button>';
          });
          html += '</div>';
        });
        html += '</nav>';

        // Panels area
        html += '<div class="pesukim-panels">';
        groups.forEach(function (g) {
          g.sections.forEach(function (sec) {
            var data = pageState[sec.panelKey];
            html += '<div class="pesukim-panel" data-panel-id="' + sec.panelKey + '">';
            html += '<div class="pesukim-panel__header">';
            html += '<span class="pesukim-panel__title">' + g.label + ' \u2014 ' + SECTION_NAMES[sec.secIdx] + '</span>';
            html += '<span class="pesukim-panel__count">' + sec.count + ' verses</span>';
            html += '</div>';
            html += '<ol class="pesukim-verse-list">';
            html += renderVerseItems(data.indices.slice(0, PAGE_SIZE));
            html += '</ol>';
            html += renderPagination(sec.panelKey, 1, sec.count);
            html += '</div>';
          });
        });
        html += '</div>';

        html += '</div>'; // .pesukim-browser
        html += '</div>'; // .pesukim-name-group
      });

      resultsEl.innerHTML = html;
      statusEl.textContent = totalFound + ' verse' + (totalFound !== 1 ? 's' : '') + ' found';
      statusEl.className = 'pesukim-status';

      wireUpNav();

      // Activate first panel
      if (firstPanelKey) activatePanel(firstPanelKey);

      // Mirror current search into URL so the browser's own share/copy flow works
      syncUrlToSearch(rawValue);
    }, 10);
  }

  function buildShareUrl(name) {
    return location.origin + location.pathname + '?name=' + encodeURIComponent(name) + '#pesukim';
  }

  function syncUrlToSearch(name) {
    if (!history.replaceState) return;
    var url = '?name=' + encodeURIComponent(name) + '#pesukim';
    try { history.replaceState(null, '', url); } catch (e) { /* ignore */ }
  }

  function copyTextFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flashCopied() {
    if (!copyLinkBtn) return;
    var original = copyLinkBtn.textContent;
    copyLinkBtn.textContent = 'Copied!';
    copyLinkBtn.dataset.copied = 'true';
    setTimeout(function () {
      copyLinkBtn.textContent = original;
      delete copyLinkBtn.dataset.copied;
    }, 1500);
  }

  function handleCopyLink() {
    var name = input.value.trim();
    if (!name) return;
    var url = buildShareUrl(name);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(flashCopied, function () {
        if (copyTextFallback(url)) flashCopied();
        else window.prompt('Copy this link:', url);
      });
    } else {
      if (copyTextFallback(url)) flashCopied();
      else window.prompt('Copy this link:', url);
    }
  }

  function activatePanel(panelKey) {
    activePanel = panelKey;
    // Update nav active state
    resultsEl.querySelectorAll('.pesukim-nav__item').forEach(function (btn) {
      btn.classList.toggle('pesukim-nav__item--active', btn.dataset.panel === panelKey);
    });
    // Show active panel, hide others
    resultsEl.querySelectorAll('.pesukim-panel').forEach(function (panel) {
      panel.classList.toggle('pesukim-panel--active', panel.dataset.panelId === panelKey);
    });
  }

  function wireUpNav() {
    resultsEl.querySelectorAll('.pesukim-nav__item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activatePanel(btn.dataset.panel);
      });
    });
  }

  // Build numbered page-pill list. For >7 pages, show 1, current-1, current, current+1, N with ellipses between gaps.
  function buildPageList(current, total) {
    if (total <= 7) {
      var pages = [];
      for (var i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    var set = {};
    [1, total, current, current - 1, current + 1].forEach(function (p) {
      if (p >= 1 && p <= total) set[p] = true;
    });
    var keys = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    keys.forEach(function (p, idx) {
      if (idx > 0 && p - keys[idx - 1] > 1) out.push('ellipsis');
      out.push(p);
    });
    return out;
  }

  function renderPagination(panelKey, currentPage, totalCount) {
    var totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (totalPages <= 1) return '';
    var html = '<div class="pesukim-pagination" role="navigation" aria-label="Verse pagination">';
    var prevDisabled = currentPage <= 1 ? ' disabled' : '';
    html += '<button type="button" class="pesukim-pagination__arrow" data-page-key="' + panelKey + '" data-page="' + (currentPage - 1) + '" aria-label="Previous page"' + prevDisabled + '>← Prev</button>';
    buildPageList(currentPage, totalPages).forEach(function (entry) {
      if (entry === 'ellipsis') {
        html += '<span class="pesukim-pagination__ellipsis" aria-hidden="true">…</span>';
        return;
      }
      var active = entry === currentPage;
      html += '<button type="button" class="pesukim-pagination__page' + (active ? ' pesukim-pagination__page--active' : '') + '" data-page-key="' + panelKey + '" data-page="' + entry + '"';
      if (active) html += ' aria-current="page"';
      html += '>' + entry + '</button>';
    });
    var nextDisabled = currentPage >= totalPages ? ' disabled' : '';
    html += '<button type="button" class="pesukim-pagination__arrow" data-page-key="' + panelKey + '" data-page="' + (currentPage + 1) + '" aria-label="Next page"' + nextDisabled + '>Next →</button>';
    html += '</div>';
    return html;
  }

  function goToPage(panelKey, page) {
    var data = pageState[panelKey];
    if (!data) return;
    var totalPages = Math.max(1, Math.ceil(data.indices.length / PAGE_SIZE));
    if (page < 1 || page > totalPages || page === data.currentPage) return;
    data.currentPage = page;
    var panel = resultsEl.querySelector('.pesukim-panel[data-panel-id="' + panelKey + '"]');
    if (!panel) return;
    var listEl = panel.querySelector('.pesukim-verse-list');
    var start = (page - 1) * PAGE_SIZE;
    if (listEl) listEl.innerHTML = renderVerseItems(data.indices.slice(start, start + PAGE_SIZE));
    var oldBar = panel.querySelector('.pesukim-pagination');
    if (oldBar) {
      var tmp = document.createElement('div');
      tmp.innerHTML = renderPagination(panelKey, page, data.indices.length);
      if (tmp.firstChild) oldBar.replaceWith(tmp.firstChild);
    }
  }

  // Single delegated click handler for verse expand + pagination. Wired once in init.
  function wireUpResultsDelegation() {
    resultsEl.addEventListener('click', function (e) {
      var pageBtn = e.target.closest('.pesukim-pagination__page, .pesukim-pagination__arrow');
      if (pageBtn) {
        e.stopPropagation();
        if (pageBtn.disabled) return;
        var key = pageBtn.dataset.pageKey;
        var page = parseInt(pageBtn.dataset.page, 10);
        if (!key || isNaN(page)) return;

        // Keep the clicked control pinned to its viewport position so rapid clicks
        // don't require chasing the button as content height changes.
        var anchorSelector;
        if (pageBtn.classList.contains('pesukim-pagination__arrow')) {
          anchorSelector = pageBtn.getAttribute('aria-label') === 'Next page'
            ? '.pesukim-pagination__arrow[aria-label="Next page"]'
            : '.pesukim-pagination__arrow[aria-label="Previous page"]';
        } else {
          anchorSelector = '.pesukim-pagination__page--active';
        }
        var preTop = pageBtn.getBoundingClientRect().top;

        goToPage(key, page);

        var panel = resultsEl.querySelector('.pesukim-panel[data-panel-id="' + key + '"]');
        var newBtn = panel && panel.querySelector(anchorSelector);
        if (newBtn) {
          var delta = newBtn.getBoundingClientRect().top - preTop;
          if (delta !== 0) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
        }
        return;
      }
      var item = e.target.closest('.pesukim-verse-item');
      if (!item) return;
      var eng = item.querySelector('.pesukim-verse-english');
      if (!eng) return;
      var isOpen = eng.dataset.open === 'true';
      eng.dataset.open = String(!isOpen);
    });
  }

  function renderVerseItems(indices) {
    var html = '';
    indices.forEach(function (i) {
      var v = tanachData.verses[i];
      var book = tanachData.books[v.b];
      html += '<li class="pesukim-verse-item">';
      html += '<div class="pesukim-verse-row">';
      html += '<span class="pesukim-verse-ref">' + escapeHtml(book.e) + ' ' + v.c + ':' + v.v;
      if (typeof v.q === 'number') {
        html += ' <span class="pesukim-verse-q" title="' + SCORE_TOOLTIP + '" aria-label="Prominence score ' + v.q + ' out of 255">' + v.q + '</span>';
      }
      html += '</span>';
      html += '<span class="pesukim-verse-hebrew" dir="rtl" lang="he">' + escapeHtml(v.h.replace(TAAMIM_RE, '')) + '</span>';
      html += '</div>';
      if (v.e) {
        html += '<div class="pesukim-verse-english" data-open="false"><span class="pesukim-verse-english__inner">' + escapeHtml(v.e) + '</span></div>';
      }
      html += '</li>';
    });
    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Event bindings ---
  wireUpResultsDelegation();
  searchBtn.addEventListener('click', doSearch);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchBtn.disabled) doSearch();
    }
  });
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', handleCopyLink);

  // --- Shareable link: read ?name= and auto-run a search ---
  function runSearchFromUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    var name = (params.get('name') || '').trim();
    if (!name) return;
    // On reload, the browser already restored scroll position — don't fight it.
    var navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
    var isReload = navEntries && navEntries[0] && navEntries[0].type === 'reload';
    input.value = name;
    updateButtonState();
    loadData().then(function () {
      if (!tanachData) return;
      doSearch();
      if (isReload) {
        // Restore scroll to its pre-refresh Y, overriding any shift from scroll anchoring.
        // doSearch() uses an internal setTimeout(10) before touching innerHTML, so we
        // wait past that, then defer again via rAF so scroll anchoring has already fired.
        try {
          var saved = sessionStorage.getItem(PESUKIM_SCROLL_KEY);
          sessionStorage.removeItem(PESUKIM_SCROLL_KEY);
          if (saved != null) {
            var targetY = parseInt(saved, 10);
            setTimeout(function () {
              requestAnimationFrame(function () {
                window.scrollTo(0, targetY);
              });
            }, 100);
          }
        } catch (e) {}
        return;
      }
      var section = document.getElementById('pesukim');
      if (!section) return;
      var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var offset = getHeaderOffset();
      var top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  runSearchFromUrl();
}

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupMobileMenu();
  setupSmoothAnchorScroll();
  setupScrollSpy();
  splitHeroName();
  setupHeroParallax();
  setupRevealAnimations();
  setupPesukim();
});
