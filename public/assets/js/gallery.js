/* Elegant Moments — gallery filtering + lightbox */
(function () {
  'use strict';
  var grids = document.querySelectorAll('[data-gallery]');
  if (!grids.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON = { prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>', close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>' };

  /* Build lightbox once */
  var lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('data-lenis-prevent', ''); lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo viewer');
  lb.innerHTML = '<div class="lb__stage"><button class="lb__btn lb__close" aria-label="Close">' + ICON.close + '</button><button class="lb__btn lb__prev" aria-label="Previous photo">' + ICON.prev + '</button><img class="lb__img" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="><button class="lb__btn lb__next" aria-label="Next photo">' + ICON.next + '</button></div><div class="lb__bar"><div class="lb__cap"></div><div class="lb__count"></div></div>';
  document.body.appendChild(lb);
  var img = lb.querySelector('.lb__img'), cap = lb.querySelector('.lb__cap'), cnt = lb.querySelector('.lb__count');
  var list = [], idx = 0, lastFocus = null;

  function visibleShots(grid) { return Array.prototype.slice.call(grid.querySelectorAll('.shot:not(.hide)')); }
  function load(i) {
    idx = (i + list.length) % list.length;
    var s = list[idx], im = s.querySelector('img');
    img.classList.remove('ready');
    var src = s.dataset.full || im.currentSrc || im.src;
    var tmp = new Image();
    tmp.onload = function () { img.src = src; img.alt = im.alt; requestAnimationFrame(function () { img.classList.add('ready'); }); };
    tmp.onerror = function () { img.src = im.src; img.classList.add('ready'); };
    tmp.src = src;
    var fc = s.querySelector('figcaption');
    var em = fc && fc.querySelector('em');
    cap.innerHTML = (em ? '<em>' + em.textContent + '</em>' : '') + (s.dataset.cap || '');
    cnt.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
    // preload neighbours
    [idx + 1, idx - 1].forEach(function (n) { var t = list[(n + list.length) % list.length]; if (t) { var p = new Image(); p.src = t.dataset.full || t.querySelector('img').src; } });
  }
  function open(grid, shot) {
    list = visibleShots(grid); lastFocus = document.activeElement;
    lb.classList.add('open'); document.body.classList.add('lb-open'); window.EM && EM.lock();
    load(list.indexOf(shot));
    lb.querySelector('.lb__close').focus({ preventScroll: true });
  }
  function close() { if (!lb.classList.contains('open')) return; window.EM && EM.unlock(); lb.classList.remove('open'); document.body.classList.remove('lb-open'); img.classList.remove('ready'); lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
  lb.querySelector('.lb__close').addEventListener('click', close);
  lb.querySelector('.lb__prev').addEventListener('click', function () { load(idx - 1); });
  lb.querySelector('.lb__next').addEventListener('click', function () { load(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target.classList.contains('lb__stage')) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') load(idx + 1); else if (e.key === 'ArrowLeft') load(idx - 1);
    else if (e.key === 'Tab') { var f = lb.querySelectorAll('button'); var first = f[0], lastb = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastb.focus(); } else if (!e.shiftKey && document.activeElement === lastb) { e.preventDefault(); first.focus(); } }
  });
  var tx = 0, ty = 0;
  lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) load(idx + (dx < 0 ? 1 : -1)); else if (dy > 90) close(); }, { passive: true });

  grids.forEach(function (grid) {
    grid.querySelectorAll('.shot').forEach(function (s) {
      s.tabIndex = 0; s.setAttribute('role', 'button');
      s.setAttribute('aria-label', 'Open photo: ' + (s.dataset.cap || s.querySelector('img').alt));
      s.addEventListener('click', function () { open(grid, s); });
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(grid, s); } });
    });
    var scope = grid.closest('[data-gallery-scope]') || document;
    var fs = scope.querySelectorAll('.filter');
    fs.forEach(function (f) {
      f.addEventListener('click', function () {
        fs.forEach(function (x) { x.classList.toggle('active', x === f); x.setAttribute('aria-pressed', x === f); });
        var cat = f.dataset.filter;
        var n = 0;
        grid.querySelectorAll('.shot').forEach(function (s) {
          var ok = cat === 'all' || s.dataset.cat === cat;
          s.classList.toggle('hide', !ok);
          s.classList.remove('fade-in');
          if (ok && !reduce) { void s.offsetWidth; s.style.animationDelay = Math.min(n, 14) * 40 + 'ms'; s.classList.add('fade-in'); n++; }
        });
      });
    });
    // deep-link: #pre-shoot etc.
    var h = (location.hash || '').replace('#', '');
    if (h) { var m = Array.prototype.find.call(fs, function (f) { return f.dataset.filter === h; }); m && m.click(); }
  });
})();
