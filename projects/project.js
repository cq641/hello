const videoVisibility = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.play().catch(() => {});
  });
}, { threshold: 0.1 });
document.querySelectorAll('video').forEach(video => videoVisibility.observe(video));

document.querySelectorAll('.carousel').forEach(gallery => {
  const track = gallery.querySelector('.carousel-track');
  const dots = [...gallery.querySelectorAll('[data-slide]')];
  const index = () => Math.round(track.scrollLeft / track.clientWidth);
  const show = next => {
    const destination = (next + dots.length) % dots.length;
    track.scrollTo({ left: destination * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  gallery.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => show(index() + Number(button.dataset.step))));
  track.addEventListener('scroll', () => dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index()))));
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(index() + (event.key === 'ArrowRight' ? 1 : -1));
  });
});
