/* Elegant Moments — navigation: sticky/hide-on-scroll, mobile menu, progress bar */
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  var menu = document.querySelector('.menu');
  var toggle = document.querySelector('.nav__toggle');
  var bar = document.querySelector('.progress');
  if (!nav) return;
  var last = window.scrollY, ticking = false, locked = false;

  function update() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 30);
    if (!document.body.classList.contains('menu-lock')) {
      if (y > last + 6 && y > 480) nav.classList.add('is-hidden');
      else if (y < last - 6 || y < 480) nav.classList.remove('is-hidden');
    }
    last = y;
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    }
    ticking = false;
  }
  if (window.EM && EM.onScroll) EM.onScroll(update);
  else window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  /* one consistent active state on every page (desktop nav + mobile menu), derived from the URL */
  (function () {
    var p = location.pathname, file = p.split('/').pop() || 'index.html', key =
      /\/photography\//.test(p) ? 'photography' : /\/weddings\//.test(p) ? 'weddings' : /\/booking\//.test(p) ? 'booking' :
      file === 'about.html' ? 'about' : file === 'faq.html' ? 'faq' : file === 'contact.html' ? 'contact' : 'home';
    var map = { home: /(^|\/)index\.html$/, photography: /photography\/index\.html$/, weddings: /weddings\/index\.html$/, about: /about\.html$/, faq: /faq\.html$/, contact: /contact\.html$/ };
    document.querySelectorAll('.nav__link, .menu__big').forEach(function (a) {
      var h = a.getAttribute('href') || '', on = key !== 'booking' && map[key].test(h) && (key === 'home' ? !/(photography|weddings)\//.test(h) : true);
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  })();

  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    nav.classList.remove('is-hidden');
    document.body.classList.toggle('menu-lock', open);
    if (open !== locked) { locked = open; window.EM && (open ? EM.lock() : EM.unlock()); }
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { var f = menu.querySelector('a,button'); f && setTimeout(function () { f.focus({ preventScroll: true }); }, 500); }
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 1180 && menu.classList.contains('open')) setMenu(false); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { if (a.getAttribute('href').charAt(0) === '#') setMenu(false); }); });
    // accordions
    menu.querySelectorAll('.menu__big[aria-controls]').forEach(function (btn) {
      var sub = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        menu.querySelectorAll('.menu__big[aria-controls]').forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          document.getElementById(b.getAttribute('aria-controls')).style.maxHeight = 0;
        });
        if (!open) { btn.setAttribute('aria-expanded', 'true'); sub.style.maxHeight = sub.scrollHeight + 'px'; }
      });
      if (btn.dataset.open === 'true') { btn.setAttribute('aria-expanded', 'true'); sub.style.maxHeight = '600px'; }
    });
  }
})();
