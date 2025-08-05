function toggleMenu(){
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}


window.addEventListener('scroll', () => {
            const indicator = document.querySelector('.scroll-down-indicator');
            if (window.scrollY > 10) {
                indicator.classList.add('hidden');
            }
        });