// Case studies, two ways:
// - On desktop: the homepage quadrant expands to fill the screen
//   (pushing the other projects away), its title becomes a close (X) button, and
//   the case study fades in.
// - On smaller or touch-first screens: project links open their own pages.
// Content comes from case-data.js, or from source/<name>.html when that's missing.
(() => {
  const siteRoot = new URL('.', document.currentScript.src);
  const homeUrl = new URL('index.html', siteRoot);
  const pageId = document.body.dataset.casePage; // set on script.html / irun.html / dwelo.html
  const grid = document.querySelector('.quadrants');
  const intro = document.querySelector('.intro');
  const tiles = [...document.querySelectorAll('.project[data-case]')];
  if (!pageId && (!grid || !tiles.length || !('animate' in Element.prototype))) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  const EASE = 'cubic-bezier(0.65, 0, 0.25, 1)';
  // One movement: the project expands and physically pushes the others off screen,
  // all on the same clock and curve. Closing is the same move in reverse.
  const MOVE_MS = 350;
  const pageTitle = document.title;

  let current = null; // { tile, panel, ... } while a case study is open
  let busy = false;
  let needsHistorySync = false;

  // ---------- Loading case studies ----------

  // manifest.json lists the case study media with alternate files in images/case/.
  // case-data.js (built by build-case-data.py) bundles the case studies and this
  // list, so everything works from file:// too, where fetch() is blocked.
  // Without the bundle, fall back to fetching them.
  const bundle = window.CASE_DATA || {};
  const cutouts = (bundle.cutouts
    ? Promise.resolve(bundle.cutouts)
    : fetch(new URL('images/case/manifest.json', siteRoot)).then(r => (r.ok ? r.json() : [])))
    .then(list => new Set(list))
    .catch(() => new Set());

  // The case study page each one is built from (a copy of the original, kept in
  // source/; its images resolve to assets/ and images/case/ inside this folder)
  const sourceUrl = id => new URL(`source/${id}.html`, siteRoot).href;

  const cache = new Map();
  function load(id) {
    if (!cache.has(id)) {
      const url = sourceUrl(id);
      const page = bundle.pages && bundle.pages[id] != null
        ? Promise.resolve(bundle.pages[id])
        : fetch(url).then(res => { if (!res.ok) throw new Error(res.status); return res.text(); });
      const promise = Promise.all([page, cutouts])
        .then(([html, cutoutSet]) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const main = doc.querySelector('main');
          // Paths in the case study are relative to its source page; make them absolute.
          main.querySelectorAll('[src]').forEach(el => el.setAttribute('src', new URL(el.getAttribute('src'), url).href));
          main.querySelectorAll('video[poster]').forEach(video => { video.poster = new URL(video.getAttribute('poster'), url).href; });
          main.querySelectorAll('a[href]:not([href^="#"])').forEach(el => el.setAttribute('href', new URL(el.getAttribute('href'), url).href));
          // Swap in the no-gray copies (images: transparent PNGs; videos: re-encoded
          // with the mockup color as background, as .mp4) and mark their frames.
          main.querySelectorAll('img[src], video[src]').forEach(media => {
            const m = new URL(media.src).pathname.match(/\/assets\/projects\/(.+)\.(png|mov)$/);
            if (!m || !cutoutSet.has(`${m[1]}.${m[2]}`)) return;
            const file = m[2] === 'mov' ? `${m[1]}.mp4` : `${m[1]}.png`;
            // ?v= busts the browser cache when the processed files are regenerated
            media.src = new URL(`images/case/${file}?v=7`, siteRoot).href;
            const fig = media.closest('figure');
            fig?.classList.add('case-cutout');
            // Some figures paint #ccc behind a slightly scaled image to hide the gap;
            // drop it so the mockup color shows there instead.
            fig?.style.removeProperty('background');
          });
          return { main, toc: doc.querySelector('.toc ol'), title: doc.title };
        });
      promise.catch(() => cache.delete(id));
      cache.set(id, promise);
    }
    return cache.get(id);
  }

  // Prefetch all three once the page is idle, so opening feels instant.
  if (!pageId) (window.requestIdleCallback || setTimeout)(() => tiles.forEach(t => load(t.dataset.case).catch(() => {})));

  // ---------- Building the panel ----------

  // name: the project's name. colorsFrom: an element carrying its --case-color and
  // --mock-color. thumbSrc: the quadrant's device image (homepage only).
  // closeHref: makes the X a link (project pages) instead of a button.
  function build({ name, colorsFrom, thumbSrc, closeHref }, data) {
    const panel = document.createElement('div');
    panel.className = 'case';
    if (!closeHref) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', `${name} case study`);
    }
    const colors = getComputedStyle(colorsFrom);
    panel.style.setProperty('--case-color', colors.getPropertyValue('--case-color'));
    panel.style.setProperty('--mock-color', colors.getPropertyValue('--mock-color'));

    const thumb = document.createElement('img');
    thumb.className = 'case-thumb';
    thumb.alt = '';
    if (thumbSrc) thumb.src = thumbSrc;

    const scroll = document.createElement('div');
    scroll.className = 'case-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Case study content');
    const main = document.importNode(data.main, true);
    main.classList.add('case-main');
    scroll.append(main);

    const nav = document.createElement('nav');
    nav.className = 'case-nav';
    nav.setAttribute('aria-label', 'Case study');
    const inner = `<span class="case-close-name" aria-hidden="true"></span>
      <span class="case-close-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 3l10 10M13 3L3 13"/></svg></span>`;
    nav.innerHTML = closeHref
      ? `<a class="case-close" href="${closeHref}" aria-label="Back to all projects">${inner}</a>`
      : `<button type="button" class="case-close" aria-label="Close">${inner}</button>`;
    nav.querySelector('.case-close-name').textContent = name;
    if (data.toc) {
      const toc = document.importNode(data.toc, true);
      toc.className = 'case-toc';
      nav.append(toc);
    }

    if (thumbSrc) panel.append(thumb);
    panel.append(nav, scroll);
    return { panel, thumb, scroll, nav, closeBtn: nav.querySelector('.case-close') };
  }

  function wireUp(c) {
    if (c.closeBtn.tagName === 'BUTTON') c.closeBtn.addEventListener('click', requestClose);

    // The controls sit outside the scrollable article, but page keys still read the article.
    c.nav.addEventListener('keydown', e => {
      if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
      e.preventDefault();
      const direction = e.key === 'PageDown' ? 1 : -1;
      c.scroll.scrollBy({ top: direction * c.scroll.clientHeight * 0.9 });
    });

    // In-page links (section list) scroll the panel instead of changing the URL.
    c.panel.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const target = c.panel.querySelector(`[id="${CSS.escape(a.hash.slice(1))}"]`);
      if (!target) return;
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    });

    // Carousels (same behavior as on the original project pages)
    c.panel.querySelectorAll('.carousel').forEach(gallery => {
      const track = gallery.querySelector('.carousel-track');
      const dots = [...gallery.querySelectorAll('[data-slide]')];
      const index = () => Math.round(track.scrollLeft / track.clientWidth);
      const show = next => {
        const dest = (next + dots.length) % dots.length;
        track.scrollTo({ left: dest * track.clientWidth, behavior: reduced.matches ? 'instant' : 'smooth' });
      };
      dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
      track.addEventListener('scroll', () => dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index()))));
      track.addEventListener('keydown', e => {
        if (e.target !== track || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        show(index() + (e.key === 'ArrowRight' ? 1 : -1));
      });
    });

    // Chromium lays out a video's built-in controls for the part of it that was
    // visible at the time (e.g. while the panel was still expanding, or before a
    // carousel slide scrolled in) and doesn't redo it, so the controls come out
    // cut off. Rebuild them each time a video comes fully into view.
    const seen = new IntersectionObserver(entries => entries.forEach(({ target: v, isIntersecting }) => {
      if (!isIntersecting) return;
      v.controls = false;
      requestAnimationFrame(() => { v.controls = true; });
    }), { threshold: 0.95 });
    c.panel.querySelectorAll('video[controls]').forEach(v => seen.observe(v));
    c.observer = seen;

    // Highlight the section being read
    const links = [...c.panel.querySelectorAll('.case-toc a')];
    const sections = links.map(l => c.panel.querySelector(`[id="${CSS.escape(l.hash.slice(1))}"]`)).filter(Boolean);
    if (sections.length) {
      let ticking = false;
      const update = () => {
        ticking = false;
        const line = innerHeight * 0.35;
        const s = c.scroll;
        const atBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
        let active = 0;
        sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) active = i; });
        if (atBottom) active = sections.length - 1;
        links.forEach((l, i) => l.setAttribute('aria-current', String(i === active)));
      };
      c.scroll.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  // Wait for animations, but never get stuck: if they haven't reported done
  // shortly after they should have, snap them to their end state.
  function settle(anims) {
    const longest = Math.max(0, ...anims.map(a => a.effect?.getComputedTiming().endTime || 0));
    const timeout = new Promise(r => setTimeout(r, longest + 250));
    return Promise.race([Promise.allSettled(anims.map(a => a.finished)), timeout])
      .then(() => anims.forEach(a => { try { if (a.playState !== 'finished') a.finish(); } catch {} }));
  }

  // URL updates (#script etc.) are a nicety; if a browser refuses them (some
  // restrict history on file:// pages), carry on without.
  const tryHistory = fn => { try { fn(); } catch {} };

  // ---------- Geometry helpers ----------

  const insetFor = r => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;
  const place = (el, r) => Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });

  // ---------- The other quadrants slide away (and back) ----------

  const flights = new Set(); // animations on the other tiles, cleaned up after closing

  // Which way the expanding project pushes each of the others.
  const EXITS = {
    script: { irun: 'down', dwelo: 'down' },
    irun:   { script: 'right', dwelo: 'right' },
    dwelo:  { script: 'up', irun: 'left' },
  };

  // How far to push a tile: exactly as far as the expanding project's edge travels,
  // so the gap between them never changes (and at least far enough to clear the screen).
  function push(t, dir, fromRect) {
    const r = t.getBoundingClientRect();
    const W = innerWidth, H = innerHeight;
    switch (dir) {
      case 'down':  return `translate(0px, ${Math.max(H - fromRect.bottom, H - r.top)}px)`;
      case 'up':    return `translate(0px, ${-Math.max(fromRect.top, r.bottom)}px)`;
      case 'right': return `translate(${Math.max(W - fromRect.right, W - r.left)}px, 0px)`;
      case 'left':  return `translate(${-Math.max(fromRect.left, r.right)}px, 0px)`;
    }
    return 'none';
  }

  function others(from) {
    const exits = EXITS[from.dataset.case] || {};
    return tiles.filter(t => t !== from).map(t => ({ t, dir: exits[t.dataset.case] || 'down' }));
  }

  function flyOut(from, fromRect, animate) {
    return others(from).map(({ t, dir }) => {
      const a = t.animate([{ transform: 'none' }, { transform: push(t, dir, fromRect) }], {
        duration: animate ? MOVE_MS : 0,
        easing: EASE, // same clock and curve as the expansion: they move as one
        fill: 'forwards',
      });
      flights.add(a);
      return a;
    });
  }

  function flyBack(from, fromRect) {
    return others(from).map(({ t, dir }) => {
      // Measure from the tile's real spot (it's hidden under the full-screen panel).
      t.getAnimations().forEach(a => { if (flights.has(a)) { a.cancel(); flights.delete(a); } });
      const a = t.animate([{ transform: push(t, dir, fromRect) }, { transform: 'none' }], {
        duration: MOVE_MS,
        easing: EASE,
        fill: 'forwards',
      });
      flights.add(a);
      return a;
    });
  }

  // ---------- Open / close ----------

  async function open(tile, { animate = true, addHistory = true } = {}) {
    if (current || busy) return;
    busy = true;
    let data;
    try { data = await load(tile.dataset.case); }
    catch { busy = false; location.href = tile.href; return; } // fall back to the page

    if (!desktop.matches) {
      if (addHistory) location.assign(tile.href);
      else location.replace(tile.href);
      return;
    }

    const tileRect = tile.getBoundingClientRect();
    const imgRect = tile.querySelector('img').getBoundingClientRect();
    const nameRect = tile.querySelector('.project-name').getBoundingClientRect();
    const fromBg = getComputedStyle(tile).backgroundColor;

    const c = build({ name: tile.querySelector('.project-name').textContent, colorsFrom: tile, thumbSrc: tile.querySelector('img').currentSrc }, data);
    c.tile = tile;
    place(c.thumb, imgRect);
    document.body.append(c.panel);
    document.body.classList.add('case-open');
    grid.inert = true;
    wireUp(c);
    current = c;

    const moving = animate && !reduced.matches;
    // The project expands, pushing the others off screen; Hello fades out meanwhile.
    const flyAnims = flyOut(tile, tileRect, moving);
    intro?.getAnimations().forEach(a => a.cancel());
    const introFade = intro?.animate({ opacity: [1, 0] },
      { duration: moving ? MOVE_MS : 0, easing: 'ease-in-out', fill: 'forwards' });

    if (addHistory) tryHistory(() => history.pushState({ case: tile.dataset.case }, '', `#${tile.dataset.case}`));
    document.title = data.title ? `${data.title} — Cesar Quiroga` : pageTitle;

    if (moving) {
      const toBg = getComputedStyle(c.panel).backgroundColor;
      const nameSlot = c.closeBtn.querySelector('.case-close-name').getBoundingClientRect();
      const dx = nameRect.left - nameSlot.left;
      const dy = nameRect.top - nameSlot.top;
      const t = { duration: MOVE_MS, easing: EASE, fill: 'backwards' };

      const anims = [
        c.panel.animate({ clipPath: [insetFor(tileRect), 'inset(0px 0px 0px 0px)'], backgroundColor: [fromBg, toBg] }, t),
        // Thumbnail blurs and drifts up as it fades away
        c.thumb.animate([
          { opacity: 1, filter: 'blur(0px)', transform: 'none' },
          { opacity: 0, filter: 'blur(28px)', transform: 'translateY(-6%) scale(1.12)' },
        ], { ...t, duration: MOVE_MS * 0.85 }),
        // Title travels to the corner and becomes the X
        c.nav.animate({ transform: [`translate(${dx}px, ${dy}px)`, 'none'] }, t),
        // The X's round backdrop changes color in step with the panel, so it never
        // shows as a pale circle against the darker quadrant color
        c.closeBtn.animate({ backgroundColor: [fromBg, toBg] }, t),
        c.closeBtn.querySelector('.case-close-name').animate({ opacity: [1, 0] }, { duration: MOVE_MS * 0.5, easing: 'ease-out', fill: 'backwards' }),
        c.closeBtn.querySelector('.case-close-icon').animate({ opacity: [0, 1] }, { duration: MOVE_MS * 0.5, delay: MOVE_MS * 0.4, easing: 'ease-in', fill: 'backwards' }),
      ];
      // Case study text fades in as the panel finishes opening. Not waited on,
      // so the X works as soon as the movement itself is done.
      c.scroll.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
          { duration: MOVE_MS * 0.7, delay: MOVE_MS * 0.55, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' });
      const toc = c.nav.querySelector('.case-toc');
      if (toc) toc.animate({ opacity: [0, 1] }, { duration: MOVE_MS * 0.6, delay: MOVE_MS * 0.6, fill: 'backwards' });
      if (introFade) anims.push(introFade);
      anims.push(...flyAnims);
      await settle(anims);
    }

    c.closeBtn.focus({ preventScroll: true });
    finishTransition();
  }

  async function close() {
    if (!current || busy) return;
    busy = true;
    const c = current;

    if (desktop.matches && !reduced.matches) {
      // Measure the quadrant again: the window may have been resized.
      const tileRect = c.tile.getBoundingClientRect();
      const imgRect = c.tile.querySelector('img').getBoundingClientRect();
      const nameRect = c.tile.querySelector('.project-name').getBoundingClientRect();
      const nameSlot = c.closeBtn.querySelector('.case-close-name').getBoundingClientRect();
      const toBg = getComputedStyle(c.tile).backgroundColor;
      const fromBg = getComputedStyle(c.panel).backgroundColor;
      place(c.thumb, imgRect);

      const t = { duration: MOVE_MS, easing: EASE, fill: 'forwards' };
      const fadeOut = c.scroll.animate({ opacity: [1, 0] }, { duration: MOVE_MS * 0.3, easing: 'ease-out', fill: 'forwards' });
      const toc = c.nav.querySelector('.case-toc');
      if (toc) toc.animate({ opacity: [1, 0] }, { duration: MOVE_MS * 0.3, fill: 'forwards' });

      const anims = [
        fadeOut,
        c.panel.animate({ clipPath: ['inset(0px 0px 0px 0px)', insetFor(tileRect)], backgroundColor: [fromBg, toBg] }, t),
        c.thumb.animate([
          { opacity: 0, filter: 'blur(28px)', transform: 'translateY(-6%) scale(1.12)' },
          { opacity: 1, filter: 'blur(0px)', transform: 'none' },
        ], { ...t, delay: MOVE_MS * 0.1, duration: MOVE_MS * 0.9 }),
        c.nav.animate({ transform: ['none', `translate(${nameRect.left - nameSlot.left}px, ${nameRect.top - nameSlot.top}px)`] }, t),
        c.closeBtn.animate({ backgroundColor: [fromBg, toBg] }, t),
        c.closeBtn.querySelector('.case-close-icon').animate({ opacity: [1, 0] }, { duration: MOVE_MS * 0.4, fill: 'forwards' }),
        c.closeBtn.querySelector('.case-close-name').animate({ opacity: [0, 1] }, { duration: MOVE_MS * 0.5, delay: MOVE_MS * 0.35, fill: 'forwards' }),
      ];
      if (intro) {
        intro.getAnimations().forEach(a => a.cancel());
        anims.push(intro.animate({ opacity: [0, 1] }, { duration: MOVE_MS, easing: 'ease-in-out', fill: 'forwards' }));
      }
      // The others come back in step with the collapsing edge.
      anims.push(...flyBack(c.tile, tileRect));
      await settle(anims);
    }

    c.observer?.disconnect();
    c.panel.remove();
    intro?.getAnimations().forEach(a => a.cancel()); // back to its normal, fully visible state
    flights.forEach(a => a.cancel()); // other tiles back in their normal places
    flights.clear();
    document.body.classList.remove('case-open');
    grid.inert = false;
    document.title = pageTitle;
    current = null;
    c.tile.focus({ preventScroll: true });
    finishTransition();
  }

  // X button / Escape: go back in history if we added an entry, else just close.
  function requestClose() {
    if (busy) return;
    if (history.state && history.state.case) history.back();
    else { close(); tryHistory(() => history.replaceState(null, '', location.pathname + location.search)); }
  }

  // ---------- Events ----------

  tiles.forEach(tile => tile.addEventListener('click', e => {
    // Let ⌘/Ctrl/Shift/middle-click open the case study page in a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!desktop.matches) return;
    e.preventDefault();
    open(tile);
  }));

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) requestClose(); });

  const linkedTile = () => tiles.find(t => `#${t.dataset.case}` === location.hash);

  // Read the latest URL when an animation ends so rapid Back/Forward stays in sync.
  function syncHistory() {
    const tile = linkedTile();
    if (tile && !desktop.matches) {
      location.replace(tile.href);
      return;
    }
    if (busy) {
      needsHistorySync = true;
      return;
    }
    if (current && current.tile !== tile) {
      needsHistorySync = Boolean(tile);
      close();
    } else if (!current && tile) {
      open(tile, { addHistory: false });
    }
  }

  function finishTransition() {
    busy = false;
    if (!needsHistorySync) return;
    needsHistorySync = false;
    syncHistory();
  }

  addEventListener('popstate', syncHistory);
  desktop.addEventListener('change', () => { if (!desktop.matches) syncHistory(); });

  // ---------- Project pages (script.html etc.) ----------

  async function renderPage(id) {
    document.body.classList.add('case-open');
    let data;
    try { data = await load(id); }
    catch { location.replace(homeUrl.href); return; }
    const c = build({ name: data.title || id, colorsFrom: document.body, closeHref: homeUrl.href }, data);
    document.body.append(c.panel);
    wireUp(c);
    // The article can arrive after the browser has already looked for the fragment.
    if (location.hash) {
      const target = c.panel.querySelector(`[id="${CSS.escape(location.hash.slice(1))}"]`);
      target?.scrollIntoView();
    }
    // Came here from the homepage? Then the X (and Escape) goes back in history,
    // which returns to the same scroll position instead of reloading at the top.
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const fromHome = referrer?.origin === homeUrl.origin &&
      (referrer.pathname === homeUrl.pathname || referrer.pathname === siteRoot.pathname);
    c.closeBtn.addEventListener('click', e => { if (fromHome && history.length > 1) { e.preventDefault(); history.back(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') c.closeBtn.click(); });
  }

  if (pageId) { renderPage(pageId); return; }

  const linked = linkedTile();
  if (linked && !desktop.matches) location.replace(linked.href);
  else if (linked) {
    // Put the grid underneath in history, so Back returns to it instead of leaving the site.
    tryHistory(() => history.replaceState(null, '', location.pathname + location.search));
    open(linked, { animate: false });
  }
})();
