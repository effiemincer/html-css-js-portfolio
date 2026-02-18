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

  const getStepSize = () => {
    const firstCard = slider.querySelector('.details-container');
    const sliderStyles = window.getComputedStyle(slider);
    const gap = getNumericPx(sliderStyles.gap) || getNumericPx(sliderStyles.columnGap) || 16;
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 300;
    return Math.round(cardWidth + gap);
  };

  const updateButtonState = () => {
    const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
    const hasOverflow = maxScrollLeft > 1;

    [...prevButtons, ...nextButtons].forEach((button) => {
      button.disabled = !hasOverflow;
      button.setAttribute('aria-disabled', String(!hasOverflow));
    });
  };

  const scrollByCard = (direction) => {
    slider.scrollBy({ left: direction * getStepSize(), behavior: 'smooth' });
  };

  prevButtons.forEach((button) => {
    button.addEventListener('click', () => scrollByCard(-1));
  });

  nextButtons.forEach((button) => {
    button.addEventListener('click', () => scrollByCard(1));
  });

  slider.addEventListener('scroll', updateButtonState, { passive: true });
  window.addEventListener('resize', updateButtonState, { passive: true });

  updateButtonState();
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