const projects = document.querySelector('.projects');
const navigation = document.querySelector('.project-navigation');
const previous = navigation.querySelector('[data-direction="-1"]');
const next = navigation.querySelector('[data-direction="1"]');
const mobile = window.matchMedia('(max-width: 680px)');
const currentProject = () => Math.round(projects.scrollLeft / projects.clientWidth);
const updateNavigation = () => {
  previous.hidden = currentProject() === 0;
  next.hidden = currentProject() === projects.children.length - 1;
};
const showProject = index => projects.scrollTo({
  left: Math.max(0, Math.min(projects.children.length - 1, index)) * projects.clientWidth,
  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
});
navigation.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => showProject(currentProject() + Number(button.dataset.direction)));
});
projects.addEventListener('scroll', updateNavigation);
projects.addEventListener('keydown', event => {
  if (!mobile.matches || event.target !== projects || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  showProject(currentProject() + (event.key === 'ArrowRight' ? 1 : -1));
});
window.addEventListener('resize', updateNavigation);
updateNavigation();
