const THEME_KEY = 'theme-preference';
const SECTION_IDS = ['profile', 'about', 'experience', 'projects', 'contact'];
let heroAnimTimeout = null;

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

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) activate(visible.target.id);
    },
    {
      rootMargin: '-35% 0px -45% 0px',
      threshold: [0.2, 0.4, 0.6]
    }
  );

  sections.forEach((section) => observer.observe(section));
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

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupMobileMenu();
  setupSmoothAnchorScroll();
  setupScrollSpy();
  splitHeroName();
  setupHeroParallax();
  setupRevealAnimations();
});
