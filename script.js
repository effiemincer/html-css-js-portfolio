const THEME_KEY = 'theme-preference';
const SECTION_IDS = ['profile', 'about', 'experience', 'projects', 'contact'];

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

function getNumericPx(value, fallback = 0) {
  if (!value) return fallback;
  const parsed = parseFloat(String(value).replace('px', ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getHeaderOffset() {
  const header = document.querySelector('header');
  return header ? Math.ceil(header.getBoundingClientRect().height + 10) : 84;
}

function closeMobileMenuOnNavigate() {
  document.querySelectorAll('.menu-links a').forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });
}

function setupMobileMenu() {
  const menu = document.querySelector('.menu-links');
  const hamburger = document.querySelector('.hamburger-icon');

  if (!menu || !hamburger) return;

  closeMobileMenuOnNavigate();

  document.addEventListener('click', (event) => {
    const clickedInsideMenu = menu.contains(event.target);
    const clickedHamburger = hamburger.contains(event.target);
    if (!clickedInsideMenu && !clickedHamburger) toggleMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleMenu(false);
      hamburger.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1199) toggleMenu(false);
  }, { passive: true });
}

function setupSmoothAnchorScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
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

function setupProjectSlider() {
  const slider = document.querySelector('.project-slider');
  if (!slider) return;

  const prevButtons = document.querySelectorAll('.proj-nav.prev');
  const nextButtons = document.querySelectorAll('.proj-nav.next');
  const getOriginalSlides = () =>
    Array.from(slider.children).filter(
      (element) => element.classList.contains('details-container') && element.dataset.clone !== '1'
    );

  let stepSize = 0;
  let blockSize = 0;
  let isWrapping = false;
  let resizeTimer = null;

  const measureTrack = () => {
    const firstOriginal = getOriginalSlides()[0];
    const sliderStyles = window.getComputedStyle(slider);
    const gap = getNumericPx(sliderStyles.gap) || getNumericPx(sliderStyles.columnGap) || 16;
    const cardWidth = firstOriginal ? firstOriginal.getBoundingClientRect().width : 300;
    stepSize = Math.round(cardWidth + gap);
    blockSize = stepSize * getOriginalSlides().length;
  };

  const removeClones = () => {
    slider.querySelectorAll('[data-clone="1"]').forEach((node) => node.remove());
  };

  const buildInfiniteTrack = () => {
    const originals = getOriginalSlides();
    if (!originals.length) return;

    removeClones();

    const prepend = document.createDocumentFragment();
    const append = document.createDocumentFragment();

    originals.forEach((slide) => {
      const startClone = slide.cloneNode(true);
      startClone.dataset.clone = '1';
      prepend.appendChild(startClone);

      const endClone = slide.cloneNode(true);
      endClone.dataset.clone = '1';
      append.appendChild(endClone);
    });

    slider.insertBefore(prepend, slider.firstChild);
    slider.appendChild(append);

    measureTrack();
    slider.scrollLeft = blockSize;
  };

  const wrapIfNeeded = () => {
    if (isWrapping || blockSize <= 0) return;

    if (slider.scrollLeft < blockSize) {
      isWrapping = true;
      slider.scrollLeft += blockSize;
      isWrapping = false;
    } else if (slider.scrollLeft >= 2 * blockSize) {
      isWrapping = true;
      slider.scrollLeft -= blockSize;
      isWrapping = false;
    }
  };

  const scrollByCard = (direction) => {
    if (blockSize <= 0) return;

    if (slider.scrollLeft < blockSize) slider.scrollLeft += blockSize;
    else if (slider.scrollLeft >= 2 * blockSize) slider.scrollLeft -= blockSize;

    const next = slider.scrollLeft + direction * stepSize;

    if (direction > 0 && next >= 2 * blockSize) slider.scrollLeft -= blockSize;
    else if (direction < 0 && next < blockSize) slider.scrollLeft += blockSize;

    slider.scrollBy({ left: direction * stepSize, behavior: 'smooth' });
  };

  prevButtons.forEach((button) => {
    button.addEventListener('click', () => scrollByCard(-1));
  });

  nextButtons.forEach((button) => {
    button.addEventListener('click', () => scrollByCard(1));
  });

  slider.addEventListener('scroll', wrapIfNeeded, { passive: true });

  window.addEventListener('resize', () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const currentOffset = blockSize > 0 ? slider.scrollLeft % blockSize : 0;
      buildInfiniteTrack();
      if (blockSize > 0) slider.scrollLeft = blockSize + currentOffset;
    }, 120);
  }, { passive: true });

  buildInfiniteTrack();
}

function setupScrollIndicator() {
  const indicator = document.querySelector('.scroll-down-indicator');
  if (!indicator) return;

  const updateIndicator = () => {
    indicator.classList.toggle('hidden', window.scrollY > 10);
  };

  updateIndicator();
  window.addEventListener('scroll', updateIndicator, { passive: true });
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
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
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
  const sectionEntries = SECTION_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sectionEntries.length) return;

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

  sectionEntries.forEach((section) => observer.observe(section));
}

function setupRevealAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach((node) => node.classList.add('in-view'));
    return;
  }

  const revealItems = document.querySelectorAll('.reveal');
  if (!revealItems.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  revealItems.forEach((node) => observer.observe(node));
}

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupMobileMenu();
  setupSmoothAnchorScroll();
  setupProjectSlider();
  setupScrollIndicator();
  setupScrollSpy();
  setupRevealAnimations();
});
