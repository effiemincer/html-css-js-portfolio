const THEME_KEY = 'theme-preference';
const SECTION_IDS = ['profile', 'about', 'experience', 'pesukim', 'projects', 'contact'];
let heroAnimTimeout = null;
let tanachData = null;
let tanachLoadPromise = null;

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

  var input = document.getElementById('pesukim-name');
  var searchBtn = document.querySelector('.pesukim-search');
  var statusEl = document.getElementById('pesukim-status');
  var resultsEl = document.querySelector('.pesukim-results');
  var kbToggle = document.querySelector('.pesukim-kb-toggle');
  var kbContainer = document.getElementById('pesukim-keyboard');
  var langToggle = document.querySelector('.pesukim-lang-toggle');
  if (!input || !searchBtn || !statusEl || !resultsEl || !kbToggle || !kbContainer) return;

  // Current display language: 'he', 'en', or 'both'
  var displayLang = 'he';
  resultsEl.dataset.lang = displayLang;

  // Page state for Show More buttons: keyed by "nameIdx-criteriaType-sectionIdx"
  var pageState = {};

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
    searchBtn.disabled = !(input.value.trim() && tanachData);
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
      var inContains = wordRe.test(v.h);
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
            pageState[panelKey] = { indices: secIndices, shown: PAGE_SIZE };
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
            if (sec.count > PAGE_SIZE) {
              html += '<button type="button" class="pesukim-show-more btn btn--ghost" data-page-key="' + sec.panelKey + '">';
              html += 'Show More (' + (sec.count - PAGE_SIZE) + ' remaining)';
              html += '</button>';
            }
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
      wireUpVerseToggles();
      wireUpShowMore();

      // Activate first panel
      if (firstPanelKey) activatePanel(firstPanelKey);
    }, 10);
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

  function wireUpVerseToggles() {
    resultsEl.addEventListener('click', function (e) {
      var item = e.target.closest('.pesukim-verse-item');
      if (!item) return;
      if (e.target.closest('.pesukim-show-more')) return;
      var eng = item.querySelector('.pesukim-verse-english');
      if (!eng) return;
      var isOpen = eng.dataset.open === 'true';
      eng.dataset.open = String(!isOpen);
    });
  }

  function wireUpShowMore() {
    resultsEl.querySelectorAll('.pesukim-show-more').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.pageKey;
        if (!pageState[key]) return;
        pageState[key].shown += PAGE_SIZE;
        var listEl = btn.previousElementSibling;
        var data = pageState[key];
        listEl.innerHTML = renderVerseItems(data.indices.slice(0, data.shown));
        if (data.shown >= data.indices.length) {
          btn.remove();
        } else {
          btn.textContent = 'Show More (' + (data.indices.length - data.shown) + ' remaining)';
        }
      });
    });
  }

  function renderVerseItems(indices) {
    var html = '';
    indices.forEach(function (i) {
      var v = tanachData.verses[i];
      var book = tanachData.books[v.b];
      html += '<li class="pesukim-verse-item">';
      html += '<div class="pesukim-verse-row">';
      html += '<span class="pesukim-verse-ref">' + escapeHtml(book.e) + ' ' + v.c + ':' + v.v + '</span>';
      html += '<span class="pesukim-verse-hebrew" dir="rtl" lang="he">' + escapeHtml(v.h) + '</span>';
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
  searchBtn.addEventListener('click', doSearch);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchBtn.disabled) doSearch();
    }
  });
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
