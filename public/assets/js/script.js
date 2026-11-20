/* Elegant Moments — core: EM helper, preloader, page transitions, FAQ, tabs, rails, back-to-top */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  /* ---- Shared helper: scroll lock, scroll-to, ONE shared scroll listener (Lenis plugs in later via EM.lenis) ---- */
  var EM = window.EM = {
    lenis: null, locks: 0, reduce: reduce, scrollFns: [],
    lock: function () { this.locks++; document.body.style.overflow = 'hidden'; if (this.lenis) this.lenis.stop(); },
    unlock: function () { this.locks = Math.max(0, this.locks - 1); if (!this.locks) { document.body.style.overflow = ''; if (this.lenis) this.lenis.start(); } },
    /* target: a pixel offset, an element or a selector */
    scrollTo: function (t, offset) {
      if (typeof t === 'string') t = document.querySelector(t);
      var y = typeof t === 'number' ? t : t ? t.getBoundingClientRect().top + window.pageYOffset - (offset || 0) : 0;
      if (this.lenis) this.lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    },
    /* every module that needs scroll position subscribes here: one passive listener, one rAF per frame */
    onScroll: function (fn) { this.scrollFns.push(fn); return fn; },
    offScroll: function (fn) { var i = this.scrollFns.indexOf(fn); if (i > -1) this.scrollFns.splice(i, 1); }
  };
  (function () {
    var queued = false;
    function flush() { queued = false; var y = window.pageYOffset, f = EM.scrollFns; for (var i = 0; i < f.length; i++) f[i](y); }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(flush); } }, { passive: true });
  })();

  /* ---- Ready: fires once the intro/transition has started revealing the page ---- */
  function ready() {
    if (root.classList.contains('is-loaded')) return;
    root.classList.add('is-loaded');
    store.set('em-seen', '1');
    document.dispatchEvent(new Event('em:ready'));
  }

  /* ---- Luxury preloader (first visit per session) ---- */
  var pre = $('.preloader');
  var curtain = $('.pt-curtain');
  var arriving = root.classList.contains('trans-in');

  function runPreloader() {
    var count = $('[data-pl-count]', pre), line = $('.pl__line i', pre);
    var MIN = 1500, t0 = performance.now(), loaded = document.readyState === 'complete', shown = 0, finished = false;
    window.addEventListener('load', function () { loaded = true; });
    function finish() {
      if (finished) return; finished = true;
      count.textContent = '100'; line.style.setProperty('--p', 1);
      root.classList.add('pl-exit');
      setTimeout(ready, 380);           // hero begins animating while the halves open
    }
    (function tick(now) {
      if (finished) return;
      var time = Math.min(1, (now - t0) / MIN);
      var target = loaded ? time : Math.min(time, 0.88);
      shown += (target - shown) * 0.16;
      count.textContent = String(Math.round(shown * 100));
      line.style.setProperty('--p', shown.toFixed(3));
      if (loaded && time >= 1 && shown > 0.985) finish(); else requestAnimationFrame(tick);
    })(t0);
    setTimeout(finish, 3600);            // failsafe
  }

  if (reduce) { root.classList.add('pl-skip'); root.classList.remove('trans-in'); ready(); }
  else if (arriving) {
    /* arriving through a page transition: curtain is already covering the screen */
    store.del('em-trans');
    var arrived = false;
    var reveal = function () {
      if (arrived) return; arrived = true;
      if (curtain) {
        curtain.classList.add('out'); root.classList.remove('trans-in');
        setTimeout(function () { curtain.classList.remove('out'); }, 1200);
      } else root.classList.remove('trans-in');
      setTimeout(ready, 280);
    };
    if (document.readyState === 'complete') setTimeout(reveal, 60); else window.addEventListener('load', function () { setTimeout(reveal, 60); });
    setTimeout(reveal, 1500);
  }
  else if (pre && !root.classList.contains('pl-skip')) runPreloader();
  else ready();

  /* ---- Cinematic page transitions (curtain wipes up over the page, new page wipes it away) ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !curtain || reduce) return;
    var h = a.getAttribute('href');
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download') || /^(#|mailto:|tel:|https?:|javascript:)/i.test(h)) return;
    if (a.href.split('#')[0] === location.href.split('#')[0]) return;
    e.preventDefault();
    store.set('em-trans', '1');
    root.classList.add('leaving');
    curtain.classList.add('on');
    EM.lock();
    setTimeout(function () { window.location.href = a.href; }, 720);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { root.classList.remove('leaving', 'trans-in', 'pl-exit'); curtain && curtain.classList.remove('on', 'out'); store.del('em-trans'); EM.locks = 0; document.body.style.overflow = ''; if (EM.lenis) EM.lenis.start(); }
  });

  /* ---- FAQ accordion ---- */
  $$('.faq__item').forEach(function (item) {
    var q = $('.faq__q', item);
    if (!q) return;
    q.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---- Tabs (FAQ groups) ---- */
  $$('[data-tabs]').forEach(function (wrap) {
    var tabs = $$('.tab', wrap), panes = $$('[data-pane]', wrap.parentNode);
    function show(name) {
      tabs.forEach(function (t) { var on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
      panes.forEach(function (p) { p.hidden = p.dataset.pane !== name; });
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
    var h = (location.hash || '').replace('#', '');
    if (h && tabs.some(function (t) { return t.dataset.tab === h; })) show(h);
  });

  /* ---- Rail (drag + arrows) ---- */
  $$('.rail').forEach(function (rail) {
    var down = false, sx = 0, sl = 0, moved = false;
    rail.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; rail.classList.add('drag'); } rail.scrollLeft = sl - dx; });
    window.addEventListener('pointerup', function () { down = false; rail.classList.remove('drag'); });
    rail.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    var ctl = rail.parentNode.querySelector('.rail-ctl');
    if (ctl) {
      var step = function () { var it = rail.querySelector('.rail__item'); return it ? it.getBoundingClientRect().width + 20 : 320; };
      $('[data-dir="-1"]', ctl).addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: 'smooth' }); });
      $('[data-dir="1"]', ctl).addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: 'smooth' }); });
    }
  });

  /* ---- In-page anchors (works with and without Lenis) ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    var id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault(); EM.scrollTo(t, 90);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---- Back to top ---- */
  var top = $('.fab .top');
  if (top) {
    EM.onScroll(function (y) { top.classList.toggle('show', y > 700); });
    top.addEventListener('click', function () { EM.scrollTo(0); });
  }

  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();
