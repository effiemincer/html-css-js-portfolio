function toggleMenu(){
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

function toggleMenu(){
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

document.addEventListener('DOMContentLoaded', () => {
    const slider = document.querySelector('.project-slider');
    const slides = Array.from(slider.children);
    const style = getComputedStyle(slider);
    const gap = parseInt(style.gap || style.columnGap, 10);
    const itemW = slides[0].offsetWidth + gap;
    const count = slides.length;

    // 1) Clone originals to the end in normal order
    slides.forEach(slide => {
        slider.appendChild(slide.cloneNode(true));
    });

    // 2) Clone originals to the start in reverse order
    slides.slice().reverse().forEach(slide => {
        slider.insertBefore(slide.cloneNode(true), slider.firstChild);
    });

    // Width of one block of originals
    const blockW = itemW * count;

    // Center on the real originals
    slider.scrollLeft = blockW;

    // On scroll, wrap around
    slider.addEventListener('scroll', () => {
        if (slider.scrollLeft < 1) {
            slider.scrollLeft += blockW;
        } else if (slider.scrollLeft > slider.scrollWidth - slider.clientWidth - 1) {
            slider.scrollLeft -= blockW;
        }
    });
});




// hide visibility of scroll-down-indicator arrow
window.addEventListener('scroll', () => {
            const indicator = document.querySelector('.scroll-down-indicator');
            if (window.scrollY > 10) {
                indicator.classList.add('hidden');
            }
        });


function scrollProjects(direction) {
  const slider = document.querySelector('.project-slider');
  const cardWidth = slider.querySelector('.details-container').offsetWidth + 32; 
  // 32px = gap*2; adjust if your gap changes
  slider.scrollBy({ left: direction * cardWidth, behavior: 'smooth' });
}
