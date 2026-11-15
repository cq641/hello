document.querySelectorAll('.carousel').forEach(gallery => {
  const track = gallery.querySelector('.carousel-track');
  const dots = [...gallery.querySelectorAll('[data-slide]')];
  const index = () => Math.round(track.scrollLeft / track.clientWidth);
  const show = next => {
    const destination = (next + dots.length) % dots.length;
    track.scrollTo({ left: destination * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  track.addEventListener('scroll', () => dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index()))));
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(index() + (event.key === 'ArrowRight' ? 1 : -1));
  });
});

// Side navigation: highlight the section currently being read
(() => {
  const links = [...document.querySelectorAll('.toc ol a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  if (!sections.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = window.innerHeight * 0.35;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let current = 0;
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= line) current = i; });
    if (atBottom) current = sections.length - 1;
    links.forEach((link, i) => link.setAttribute('aria-current', String(i === current)));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
