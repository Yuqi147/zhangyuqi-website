/* ============================================================
   main.js — Theme, Section Navigation, Mobile Menu
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Theme preferences are optional; navigation also works when storage is blocked.
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }

  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    // Use the default theme if browser storage is unavailable.
  }
  setTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Keep the selected theme for this visit even without persistence.
    }
  });

  // Mobile navigation keeps its visible state and accessibility state in sync.
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  function setMenuOpen(open) {
    navLinks.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  hamburger.addEventListener('click', () => {
    setMenuOpen(hamburger.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false);
      hamburger.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!navbar.contains(event.target)) setMenuOpen(false);
  });

  window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
    setMenuOpen(false);
  });

  // Hash routes work on static hosting and when index.html is opened locally.
  const sections = [...document.querySelectorAll('.section[id]')];
  const navAnchors = [...navLinks.querySelectorAll('a')];
  const backToTop = document.querySelector('.to-top');
  const homeTitle = document.title;

  function sectionForHash(hash) {
    return sections.find(section => `#${section.id}` === hash);
  }

  function showSection(section, { focus = false } = {}) {
    sections.forEach(page => {
      page.hidden = page !== section;
    });

    navAnchors.forEach(anchor => {
      const active = anchor.getAttribute('href') === `#${section.id}`;
      anchor.classList.toggle('active', active);
      if (active) {
        anchor.setAttribute('aria-current', 'page');
      } else {
        anchor.removeAttribute('aria-current');
      }
    });

    const heading = section.querySelector('h1');
    document.title = section.id === 'home' ? homeTitle : `${heading.textContent} | Yuqi Zhang`;
    backToTop.setAttribute('href', `#${section.id}`);
    setMenuOpen(false);

    // Each view starts below the persistent navigation, including history visits.
    if (focus) heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    updateNavbarShadow();
  }

  function showCurrentRoute(options) {
    const section = sectionForHash(window.location.hash);
    if (!section && window.location.hash) {
      // A stale or invalid link should still open a usable page.
      window.history.replaceState(null, '', '#home');
    }
    showSection(section || sections[0], options);
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (event) => {
      // Preserve open-in-new-tab and other native link gestures.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const hash = anchor.getAttribute('href');
      if (hash === '#main-content') {
        event.preventDefault();
        document.getElementById('main-content').focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }

      const section = sectionForHash(hash);
      if (!section) return;

      event.preventDefault();
      if (window.location.hash !== hash) {
        window.history.pushState(null, '', hash);
      }
      showSection(section, { focus: true });
    });
  });

  // Back/Forward and pasted hash links share the same rendering path.
  window.history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', () => showCurrentRoute({ focus: true }));

  function updateNavbarShadow() {
    navbar.style.boxShadow = window.scrollY > 10 ? '0 2px 12px rgba(0,0,0,0.06)' : 'none';
  }
  window.addEventListener('scroll', updateNavbarShadow, { passive: true });

  showCurrentRoute();
});
