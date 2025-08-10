function toggleMenu(){
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  if (!menu || !icon) return;
  const isOpen = menu.classList.toggle("open");
  icon.classList.toggle("open");
  icon.setAttribute("aria-expanded", String(isOpen));
}

function getNumericPx(value, fallback = 0) {
  if (!value) return fallback;
  const n = parseFloat(String(value).replace("px",""));
  return isNaN(n) ? fallback : n;
}

document.addEventListener('DOMContentLoaded', () => {
  const slider = document.querySelector('.project-slider');
  if (!slider) return;

  // cache references
  const prevButtons = document.querySelectorAll('.proj-nav.prev');
  const nextButtons = document.querySelectorAll('.proj-nav.next');

  // compute card width + gap safely
  const card = slider.querySelector('.details-container');
  const style = getComputedStyle(slider);
  const gap = getNumericPx(style.gap) || getNumericPx(style.columnGap) || 16;
  const baseCardWidth = card ? card.getBoundingClientRect().width : 300;
  let itemWidth = baseCardWidth + gap;

  // media query to switch behaviors
  const mqDesktop = window.matchMedia('(min-width: 1201px)');

  // Avoid double init
  let desktopInited = false;

  const clearClones = () => {
    if (!slider.dataset.infinite) return;
    // Remove all nodes that were cloned (marked with data-clone="1")
    slider.querySelectorAll('[data-clone="1"]').forEach(n => n.remove());
    slider.dataset.infinite = "";
  };

  const setupDesktopInfinite = () => {
    if (desktopInited) return;
    clearClones();

    const originals = Array.from(slider.children).filter(el => el.classList.contains('details-container'));
    if (!originals.length) return;

    // Clone originals to the end (normal order)
    originals.forEach(slide => {
      const c = slide.cloneNode(true);
      c.setAttribute('data-clone', '1');
      slider.appendChild(c);
    });
    // Clone originals to the start (reverse order)
    originals.slice().reverse().forEach(slide => {
      const c = slide.cloneNode(true);
      c.setAttribute('data-clone', '1');
      slider.insertBefore(c, slider.firstChild);
    });

    const count = originals.length;
    const styleNow = getComputedStyle(slider);
    const gapNow = getNumericPx(styleNow.gap) || getNumericPx(styleNow.columnGap) || gap;
    const cardNow = slider.querySelector('.details-container');
    const widthNow = cardNow ? cardNow.getBoundingClientRect().width : baseCardWidth;
    itemWidth = widthNow + gapNow;

    const blockW = itemWidth * count;
    slider.scrollLeft = blockW;

    const onScrollWrap = () => {
      if (slider.scrollLeft < 1) slider.scrollLeft += blockW;
      else if (slider.scrollLeft > slider.scrollWidth - slider.clientWidth - 1) slider.scrollLeft -= blockW;
    };
    // store handler so we don't add multiple times
    slider._wrapHandler && slider.removeEventListener('scroll', slider._wrapHandler);
    slider._wrapHandler = onScrollWrap;
    slider.addEventListener('scroll', onScrollWrap, { passive: true });

    slider.dataset.infinite = "1";
    desktopInited = true;
  };

  const setupMobileNative = () => {
    // On mobile, just use native swipe/scroll — no cloning
    slider._wrapHandler && slider.removeEventListener('scroll', slider._wrapHandler);
    clearClones();
    desktopInited = false;
  };

  const applyMode = (e) => {
    if (mqDesktop.matches) setupDesktopInfinite();
    else setupMobileNative();
  };

  // initial
  applyMode();
  // respond to resizes
  mqDesktop.addEventListener('change', applyMode);

  const scrollByCard = (dir) => {
    slider.scrollBy({ left: dir * itemWidth, behavior: 'smooth' });
  };

  // Buttons: click + keyboard
  prevButtons.forEach(btn => {
    btn.addEventListener('click', () => scrollByCard(-1));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollByCard(-1); }
    });
  });
  nextButtons.forEach(btn => {
    btn.addEventListener('click', () => scrollByCard(1));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollByCard(1); }
    });
  });

  // Recompute size on window resize/orientation change
  window.addEventListener('resize', () => {
    const styleNow = getComputedStyle(slider);
    const gapNow = getNumericPx(styleNow.gap) || getNumericPx(styleNow.columnGap) || gap;
    const cardNow = slider.querySelector('.details-container');
    const widthNow = cardNow ? cardNow.getBoundingClientRect().width : baseCardWidth;
    itemWidth = widthNow + gapNow;
  }, { passive: true });
});

// hide visibility of scroll-down-indicator arrow when scrolling
window.addEventListener('scroll', () => {
  const indicator = document.querySelector('.scroll-down-indicator');
  if (!indicator) return;
  if (window.scrollY > 10) indicator.classList.add('hidden');
  else indicator.classList.remove('hidden');
});
