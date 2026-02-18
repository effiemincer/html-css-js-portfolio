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

function setupMobileMenu() {
  const menu = document.querySelector('.menu-links');
  const hamburger = document.querySelector('.hamburger-icon');
  const menuLinks = document.querySelectorAll('.menu-links a');

  if (!menu || !hamburger) return;

  menuLinks.forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });

  document.addEventListener('click', (event) => {
    const clickedInsideMenu = menu.contains(event.target);
    const clickedHamburger = hamburger.contains(event.target);
    if (!clickedInsideMenu && !clickedHamburger) {
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
    if (window.innerWidth > 1200) {
      toggleMenu(false);
    }
  }, { passive: true });
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

    // Keep us in the middle (original) block before computing the next move
    // Middle block range is [blockSize, 2*blockSize)
    if (slider.scrollLeft < blockSize) {
      slider.scrollLeft += blockSize;
    } else if (slider.scrollLeft >= 2 * blockSize) {
      slider.scrollLeft -= blockSize;
    }

    // Predict next position
    const next = slider.scrollLeft + direction * stepSize;

    // If the next move would leave the middle block, jump by one block first
    if (direction > 0 && next >= 2 * blockSize) {
      slider.scrollLeft -= blockSize; // instant jump left one block
    } else if (direction < 0 && next < blockSize) {
      slider.scrollLeft += blockSize; // instant jump right one block
    }

    // Now do the animated move
    slider.scrollBy({ left: direction * stepSize, behavior: "smooth" });
  };


  prevButtons.forEach((button) => {
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', 'false');
    button.addEventListener('click', () => scrollByCard(-1));
  });

  nextButtons.forEach((button) => {
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', 'false');
    button.addEventListener('click', () => scrollByCard(1));
  });

  slider.addEventListener('scroll', wrapIfNeeded, { passive: true });

  window.addEventListener(
    'resize',
    () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const currentOffset = blockSize > 0 ? slider.scrollLeft % blockSize : 0;
        buildInfiniteTrack();
        if (blockSize > 0) slider.scrollLeft = blockSize + currentOffset;
      }, 120);
    },
    { passive: true }
  );

  buildInfiniteTrack();
}

function setupScrollIndicator() {
  const indicator = document.querySelector('.scroll-down-indicator');
  if (!indicator) return;

  const updateIndicator = () => {
    if (window.scrollY > 10) indicator.classList.add('hidden');
    else indicator.classList.remove('hidden');
  };

  updateIndicator();
  window.addEventListener('scroll', updateIndicator, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupProjectSlider();
  setupScrollIndicator();
});
