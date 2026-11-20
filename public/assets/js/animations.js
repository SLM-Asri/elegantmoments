/* Elegant Moments — global motion system
   ---------------------------------------------------------------------------
   Layer 1  (always, dependency-free)  text splitting, scroll reveals, image reveals, counters,
                                       hero slideshow, magnetic buttons, gold cursor, and a native
                                       scroll-progress engine that drives every scrubbed effect.
   Layer 2  (motion allowed + CDN reachable)  GSAP ScrollTrigger replaces the native engine as the
                                       progress source (same effect code), Lenis adds smooth scroll.
   If layer 2 is blocked or offline, layer 1 keeps every effect working.

   Every scroll-driven effect is a pure function of progress (0..1) registered through EM.scrub(),
   so effects look identical whichever engine drives them. All timing lives in motion.css tokens
   (mirrored in EM.motion). Effects are built per breakpoint and torn down cleanly on change. */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var EM = window.EM || (window.EM = {});

  /* ------------------------------------------------------------------ tokens + helpers */
  EM.motion = { ease: 'cubic-bezier(.22,.8,.24,1)', easeIO: 'cubic-bezier(.76,0,.24,1)', dur: [0.45, 1, 1.5], step: 0.08 };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function docTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; } // ignores transforms
  function rafOnce(fn) { var q = false; return function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; fn(); }); }; }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function mode() {
    var w = window.innerWidth, h = window.innerHeight;
    return { w: w, h: h, size: w <= 640 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop', pin: w > 1024 && h >= 600 };
  }

  /* ------------------------------------------------------------------ text splitting */
  function splitText(el, m) {
    var label = el.textContent.replace(/\s+/g, ' ').trim(), i = 0;
    el.setAttribute('aria-label', label);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'), inner = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            if (m === 'chars') {
              Array.prototype.forEach.call(part, function (ch) { var c = document.createElement('span'); c.className = 'c'; c.textContent = ch; c.style.setProperty('--i', i++); inner.appendChild(c); });
            } else { inner.textContent = part; inner.style.setProperty('--i', i++); }
            w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
    el.classList.add('split-text'); el.setAttribute('data-split-mode', m);
    el.removeAttribute('data-reveal');
  }
  /* words that light up with scroll progress (paragraphs marked data-scrub-text) */
  function splitScrub(el) {
    var label = el.textContent.replace(/\s+/g, ' ').trim(), words = label.split(' ');
    el.setAttribute('aria-label', label); el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span'); s.className = 'sw'; s.setAttribute('aria-hidden', 'true'); s.textContent = w;
      el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('scrub-text');
    return $$('.sw', el);
  }
  if (!reduce) {
    $$('.hero-home .display').forEach(function (el) { splitText(el, 'chars'); });
    $$('.display:not(.split-text), .h1:not(.split-text), .h2:not(.split-text)').forEach(function (el) { if (!el.closest('.lb')) splitText(el, 'words'); });
  }

  /* ------------------------------------------------------------------ image reveal wiring */
  var DEPTH = '.gframe, .card__img, .door__img, .rel, .trio .arch, .overlap';
  if (!reduce) {
    $$('.gframe, .card__img, .door__img, .rel, .trio .arch, .rail__item, .overlap, .shot, .hero__visual .main, .hero__visual .float').forEach(function (el) { el.classList.add('ir'); });
    $$('.card__img, .door__img, .rel, .trio .arch, .shot').forEach(function (el) { el.classList.add('ir-clip'); });
    $$('.shot, .rel').forEach(function (el) { el.setAttribute('data-auto', ''); });
    /* alternate wipe directions so a grid of photographs feels directed, not uniform */
    $$('.ir-clip').forEach(function (el, i) { el.setAttribute('data-wipe', ['up', 'left', 'down', 'right'][i % 4]); });
  }

  /* ------------------------------------------------------------------ one observer for reveals */
  var targets = $$('[data-reveal], .split-text, .ir, .ir-clip, .eyebrow');
  function show(el) {
    el.classList.add('in');
    if (el.classList.contains('ir')) setTimeout(function () { el.classList.add('settled'); }, 2600 + (parseFloat(el.style.getPropertyValue('--d')) || 0) * 1000);
  }
  var revealIO = null;
  function arm() {
    if (!('IntersectionObserver' in window) || reduce) { targets.forEach(show); return; }
    revealIO = new IntersectionObserver(function (es) {
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        if (el.hasAttribute('data-auto') && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', (Math.min(n++, 8) * 0.07).toFixed(2) + 's'); // batch stagger
        show(el); revealIO.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) { revealIO.observe(t); });
  }
  if (root.classList.contains('is-loaded')) arm(); else document.addEventListener('em:ready', arm, { once: true });
  setTimeout(function () { if (!root.classList.contains('is-loaded')) targets.forEach(show); }, 6000); // never leave content hidden

  /* ------------------------------------------------------------------ counters */
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, suf = el.dataset.suffix || '';
    var run = function () {
      if (reduce) { el.textContent = end.toFixed(dec) + suf; return; }
      var t0 = performance.now(), d = 1900;
      (function f(t) { var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 4); el.textContent = (end * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(f); })(t0);
    };
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ------------------------------------------------------------------ hero slideshow (dependency-free)
     Layered photographs replace each other with directional clip-path wipes; the incoming photo settles
     from a slow zoom. Pauses off-screen / in a background tab. Reduced motion: first photo only. */
  (function heroSlides() {
    var wrap = $('.hero-slides'); if (!wrap) return;
    var slides = $$('.hs', wrap), count = $('.hs-count'), num = count && $('b', count), line = count && $('.hs-bar i', count);
    if (slides.length < 2 || reduce) { if (count) count.hidden = true; return; }
    var DIRS = ['left', 'up', 'right', 'down'], idx = 0, busy = false, timer = 0, visible = true;
    var HOLD = 6200, WIPE = 1500;
    function mark() {
      if (num) num.textContent = ('0' + (idx + 1)).slice(-2);
      if (line) { line.classList.remove('run'); void line.offsetWidth; line.classList.add('run'); }
    }
    function go(n) {
      if (busy) return; busy = true;
      var cur = slides[idx], nx = slides[n];
      nx.setAttribute('data-dir', DIRS[n % 4]);
      void nx.offsetWidth;
      nx.classList.add('is-in');
      setTimeout(function () {
        cur.classList.remove('is-active'); nx.classList.remove('is-in'); nx.classList.add('is-active');
        idx = n; busy = false; mark(); schedule();
      }, WIPE + 60);
    }
    function schedule() {
      clearTimeout(timer);
      if (!visible || document.hidden) return;
      timer = setTimeout(function () { go((idx + 1) % slides.length); }, HOLD);
    }
    slides.forEach(function (s, i) { if (i) s.setAttribute('data-dir', DIRS[i % 4]); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else if (!busy) schedule(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (!visible) clearTimeout(timer); else if (!busy) schedule(); }).observe(wrap.parentNode);
    var begin = function () { mark(); schedule(); };
    if (root.classList.contains('is-loaded')) begin(); else document.addEventListener('em:ready', begin, { once: true });
    EM.heroGo = function (n) { clearTimeout(timer); go(((n % slides.length) + slides.length) % slides.length); };
  })();

  /* ================================================================== SCROLL ENGINE
     EM.scrub({ el, start:'top bottom', end:'bottom top', fn:function(p){} }) -> handle with .kill()
     Position strings use ScrollTrigger syntax ("<element edge> <viewport edge>", edges: top|center|bottom|NN%|NNpx).
     Native source: cached document offsets + the shared EM.onScroll bus (no layout reads while scrolling).
     GSAP source: one ScrollTrigger per item, created when the library arrives. */
  var Engine = (function () {
    var list = [], useST = false, vh = window.innerHeight, started = false;
    function off(tok, size) { if (tok === 'top') return 0; if (tok === 'center') return size / 2; if (tok === 'bottom') return size; if (/%$/.test(tok)) return size * parseFloat(tok) / 100; if (/px$/.test(tok)) return parseFloat(tok); return 0; }
    function parts(s) { var a = String(s).trim().split(/\s+/); return [a[0], a[1] || 'top']; }
    function measure(it) {
      var h = it.el.offsetHeight, top = docTop(it.el), a = parts(it.start), b = parts(it.end);
      it.s = top + off(a[0], h) - off(a[1], vh);
      it.e = top + off(b[0], h) - off(b[1], vh);
    }
    function apply(it, p) { if (p !== it.p) { it.p = p; it.fn(p); } }
    function run() {
      var y = window.pageYOffset;
      for (var i = 0; i < list.length; i++) { var it = list[i]; apply(it, it.e > it.s ? clamp((y - it.s) / (it.e - it.s), 0, 1) : 0); }
    }
    function mkST(it) {
      it.st = ScrollTrigger.create({
        trigger: it.el, start: it.start, end: it.end,
        onUpdate: function (self) { apply(it, self.progress); },
        onRefresh: function (self) { apply(it, self.progress); }
      });
    }
    function refresh() {
      vh = window.innerHeight;
      if (useST) { ScrollTrigger.refresh(); return; }
      list.forEach(measure); run();
    }
    function start() {
      if (started) return; started = true;
      EM.onScroll(function () { if (!useST) run(); });
      var rf = debounce(refresh, 160);
      window.addEventListener('resize', rf);
      window.addEventListener('load', function () { refresh(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
      if ('ResizeObserver' in window) { var h0 = document.body.offsetHeight; new ResizeObserver(function () { var h = document.body.offsetHeight; if (Math.abs(h - h0) > 2) { h0 = h; rf(); } }).observe(document.body); }
    }
    return {
      add: function (cfg) {
        start();
        var it = { el: cfg.el, start: cfg.start || 'top bottom', end: cfg.end || 'bottom top', fn: cfg.fn, p: -1 };
        list.push(it);
        if (useST) { mkST(it); } else { measure(it); apply(it, it.e > it.s ? clamp((window.pageYOffset - it.s) / (it.e - it.s), 0, 1) : 0); }
        return { kill: function () { var i = list.indexOf(it); if (i > -1) list.splice(i, 1); if (it.st) it.st.kill(); } };
      },
      refresh: refresh,
      adoptGSAP: function () {
        useST = true; list.forEach(function (it) { it.p = -1; mkST(it); }); ScrollTrigger.refresh();
      },
      get usingGSAP() { return useST; }
    };
  })();
  EM.scrub = Engine.add; EM.refresh = Engine.refresh;

  /* ================================================================== EFFECTS (rebuilt per breakpoint) */
  var fxDown = [];                       // teardown callbacks for the current build
  function track(h) { fxDown.push(function () { h.kill(); }); return h; }

  /* ---- parallax layers: backgrounds slower, foreground faster, text independent ---- */
  function fxParallax(m) {
    if (m.size === 'mobile') return;
    var k = m.size === 'tablet' ? 0.6 : 1;
    [['.watermark', 0.07], ['.hero__visual .float', -0.1], ['.hero__visual .badge', 0.08], ['.hero__visual .main img', 0.05], ['.overlap', -0.09],
     ['.split__media .gframe', 0.035], ['.cta .container', 0.03], ['.page-head .container', 0.05], ['.hero-home .fr.a', 0.12], ['.hero-home .fr.c', -0.1]
    ].concat($$('[data-parallax]').map(function (el) { return [el, parseFloat(el.dataset.parallax) || 0.08]; })).forEach(function (pair) {
      var els = typeof pair[0] === 'string' ? $$(pair[0]) : [pair[0]];
      els.forEach(function (el) {
        var trig = el.parentElement || el, h = trig.offsetHeight, kk = pair[1] * k;
        track(Engine.add({ el: trig, start: 'top bottom', end: 'bottom top', fn: function (p) { el.style.translate = '0 ' + (-kk * (m.h + h) * (0.5 - p)).toFixed(1) + 'px'; } }));
        fxDown.push(function () { el.style.translate = ''; });
      });
    });
  }

  /* ---- hero: slides drift, copy rises and fades as you leave ---- */
  function fxHero(m) {
    var hero = $('.hero, .hero-home'); if (!hero) return;
    var copy = $('.hero__copy, .hero-home__copy', hero), slides = $('.hero-slides', hero);
    if (m.size === 'mobile' && !slides) return;
    track(Engine.add({ el: hero, start: 'top top', end: 'bottom top', fn: function (p) {
      if (copy) { copy.style.translate = '0 ' + (-p * 9).toFixed(2) + '%'; copy.style.opacity = (1 - p * 0.9).toFixed(3); }
      if (slides && m.size !== 'mobile') slides.style.translate = '0 ' + (p * 12).toFixed(2) + '%';
    } }));
    fxDown.push(function () { if (copy) { copy.style.translate = ''; copy.style.opacity = ''; } if (slides) slides.style.translate = ''; });
  }

  /* ---- image depth: photographs travel inside their frames and zoom gently as they cross the screen ---- */
  function fxDepth(m) {
    if (m.size === 'mobile') return;
    $$(DEPTH).forEach(function (box) {
      var img = $('img', box); if (!img) return;
      box.classList.add('depth');
      var trig = box.classList.contains('overlap') || box.matches('.split__media .gframe') ? (box.parentElement || box) : box, amp = m.size === 'tablet' ? 2.5 : 4;
      track(Engine.add({ el: trig, start: 'top bottom', end: 'bottom top', fn: function (p) {
        img.style.setProperty('--y', ((0.5 - p) * 2 * amp).toFixed(2)); img.style.setProperty('--z', p.toFixed(3));
      } }));
      fxDown.push(function () { box.classList.remove('depth'); img.style.removeProperty('--y'); img.style.removeProperty('--z'); });
    });
  }

  /* ---- scroll-synchronised words ---- */
  function fxScrubText() {
    $$('[data-scrub-text]').forEach(function (el) {
      var words = $$('.sw', el); if (!words.length) words = splitScrub(el);
      var last = -1, n = words.length;
      track(Engine.add({ el: el, start: 'top 86%', end: 'bottom 52%', fn: function (p) {
        var c = Math.round(p * n); if (c === last) return;
        for (var i = 0; i < n; i++) words[i].classList.toggle('on', i < c); last = c;
      } }));
      fxDown.push(function () { words.forEach(function (w) { w.classList.add('on'); }); });
    });
  }

  /* ---- expanding photograph: a small framed picture grows to a cinematic full-bleed (or full-height) image,
          corner radius easing to zero, photo counter-zooming, words parting, copy arriving. ---- */
  function fxExpand(m) {
    $$('[data-expand]').forEach(function (sec) {
      var stage = $('.expand__stage', sec), media = $('.expand__media', sec), img = media && $('img', media);
      if (!stage || !media || !img) return;
      var tl = $('.expand__title', sec), L = tl && $('.l', tl), R = tl && $('.r', tl);
      var portrait = sec.getAttribute('data-expand') === 'portrait';
      var pinned = m.size !== 'mobile' && m.h >= 480;
      var x0 = portrait ? (m.size === 'desktop' ? 41 : 36) : (m.size === 'desktop' ? 36 : m.size === 'tablet' ? 28 : 16);
      var y0 = pinned ? (portrait ? 22 : 30) : 6;
      var xe = portrait ? (m.size === 'desktop' ? 31 : m.size === 'tablet' ? 20 : 7) : 0;
      var re = portrait ? 8 : 0, r0 = 26, keep = portrait && m.size === 'desktop';
      sec.classList.add(pinned ? 'is-live' : 'is-flow');
      if (pinned) sec.style.setProperty('--track', (m.size === 'tablet' ? 185 : 245) + 'vh');
      var W = m.w, copyEl = pinned && $('.expand__copy', sec);
      if (tl) tl.style.setProperty('--gap', ((100 - 2 * x0) / 100 * W + 72).toFixed(0) + 'px');
      function fn(p) {
        var q = easeIO(clamp(p / (pinned ? 0.78 : 1), 0, 1));
        var xs = lerp(x0, xe, q).toFixed(2) + '%', ys = lerp(y0, 0, q).toFixed(2) + '%';
        media.style.clipPath = 'inset(' + ys + ' ' + xs + ' ' + ys + ' ' + xs + ' round ' + lerp(r0, re, q).toFixed(1) + 'px)';
        img.style.scale = lerp(1.18, 1.02, q).toFixed(3);
        if (tl) {
          var dx = keep ? (x0 - xe) / 100 * W : (x0 - lerp(x0, xe, q)) / 100 * W + W * 0.34 * q;
          if (L) L.style.translate = (-dx).toFixed(1) + 'px 0'; if (R) R.style.translate = dx.toFixed(1) + 'px 0';
          tl.style.opacity = keep ? 1 : clamp(1 - q * 1.5, 0, 1).toFixed(3);
        }
        if (pinned) stage.style.setProperty('--shade', clamp((p - 0.5) / 0.3, 0, 1).toFixed(3));
        var copy = copyEl;
        if (copy) { var o = clamp((p - 0.74) / 0.2, 0, 1); copy.style.opacity = o.toFixed(3); copy.style.translate = '0 ' + ((1 - o) * 34).toFixed(1) + 'px'; copy.style.visibility = o > 0 ? 'visible' : 'hidden'; }
      }
      track(Engine.add(pinned ? { el: sec, start: 'top top', end: 'bottom bottom', fn: fn } : { el: stage, start: 'top 92%', end: 'bottom 55%', fn: fn }));
      fxDown.push(function () {
        sec.classList.remove('is-live', 'is-flow'); sec.style.removeProperty('--track'); stage.style.removeProperty('--shade');
        media.style.clipPath = ''; img.style.scale = '';
        [L, R].forEach(function (n) { if (n) n.style.translate = ''; }); if (tl) { tl.style.opacity = ''; tl.style.removeProperty('--gap'); }
        var c = $('.expand__copy', sec); if (c) { c.style.opacity = ''; c.style.translate = ''; c.style.visibility = ''; }
      });
    });
  }

  /* ---- story: pinned list of collections; each photograph wipes over the last with its own direction ---- */
  function fxStory(m) {
    if (!m.pin) return;
    $$('[data-story]').forEach(function (sec) {
      var track_ = $('.story__track', sec), imgs = $$('.story__img', sec), links = $$('.occ a', sec);
      var N = imgs.length; if (!track_ || N < 2) return;
      var count = $('.story__count', sec), bar = $('.story__bar i', sec), DIR = ['up', 'left', 'down', 'right', 'up'];
      sec.classList.add('is-live'); track_.style.height = 'calc(100svh + ' + ((N - 1) * 72) + 'vh)';
      var active = -1;
      function wipe(dir, e) { var r = ((1 - e) * 100).toFixed(2) + '%'; return dir === 'up' ? 'inset(' + r + ' 0 0 0)' : dir === 'down' ? 'inset(0 0 ' + r + ' 0)' : dir === 'left' ? 'inset(0 0 0 ' + r + ')' : 'inset(0 ' + r + ' 0 0)'; }
      function fn(p) {
        var s = clamp(p / 0.94, 0, 1) * (N - 1), a = 0, es = [];
        for (var k = 0; k < N; k++) es[k] = k === 0 ? 1 : easeIO(clamp((s - (k - 0.4)) / 0.4, 0, 1));
        for (k = 0; k < N; k++) {
          var fig = imgs[k], im = fig.firstElementChild, e = es[k], nxt = k < N - 1 ? es[k + 1] : 0;
          fig.style.clipPath = k === 0 ? 'none' : (e >= 1 ? 'none' : wipe(DIR[k - 1], e));
          im.style.scale = lerp(1.32, 1.1, e).toFixed(3);
          im.style.translate = '0 ' + (-nxt * 5).toFixed(2) + '%';
          if (es[k] >= 0.5) a = k;
        }
        if (a !== active) {
          active = a;
          links.forEach(function (l, i) { l.classList.toggle('is-on', i === a); l.classList.toggle('is-off', i !== a); });
          if (count) count.textContent = ('0' + (a + 1)).slice(-2) + ' / ' + ('0' + N).slice(-2);
        }
        if (bar) bar.style.transform = 'scaleY(' + p.toFixed(3) + ')';
      }
      track(Engine.add({ el: track_, start: 'top top', end: 'bottom bottom', fn: fn }));
      fxDown.push(function () {
        sec.classList.remove('is-live'); track_.style.height = '';
        imgs.forEach(function (f) { f.style.clipPath = ''; f.firstElementChild.style.scale = ''; f.firstElementChild.style.translate = ''; });
        links.forEach(function (l) { l.classList.remove('is-on', 'is-off'); });
      });
    });
  }

  /* ---- sticky horizontal gallery: vertical scroll slides the photographs sideways, then releases ---- */
  var hgWrapped = false;
  function hgWrap() {
    if (hgWrapped) return; hgWrapped = true;
    $$('.rail').forEach(function (rail) {
      var sec = rail.closest('section'); if (!sec || sec.classList.contains('hg')) return;
      var sticky = document.createElement('div'); sticky.className = 'hg__sticky';
      while (sec.firstChild) sticky.appendChild(sec.firstChild);
      sec.appendChild(sticky); sec.classList.add('hg');
      var ui = document.createElement('div'); ui.className = 'hg__ui container'; ui.setAttribute('aria-hidden', 'true');
      ui.innerHTML = '<span class="hg__count">01 / 01</span><span class="hg__bar"><i></i></span><span class="hg__hint">Scroll</span>';
      sticky.appendChild(ui);
    });
  }
  function fxHG(m) {
    if (!m.pin) return;
    $$('.hg').forEach(function (sec) {
      var rail = $('.rail', sec), items = $$('.rail__item', sec), ui = $('.hg__ui', sec);
      if (!rail || items.length < 3) return;
      var bar = $('.hg__bar i', ui), cnt = $('.hg__count', ui), N = items.length;
      sec.classList.add('is-live');
      var last = items[N - 1], gut = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      var dist = Math.max(0, last.offsetLeft + last.offsetWidth + gut - m.w);
      sec.style.height = 'calc(' + Math.round(dist * 1.0) + 'px + 100svh)';
      var cx = items.map(function (it) { return it.offsetLeft + it.offsetWidth / 2; }), act = -1, half = m.w / 2;
      function fn(p) {
        var x = -p * dist; rail.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
        var best = 0, bd = 1e9;
        for (var i = 0; i < N; i++) {
          var d = Math.abs(cx[i] + x - half), a = Math.min(1, d / half);
          items[i].style.scale = (1 - a * 0.09).toFixed(3); items[i].style.opacity = (1 - a * 0.4).toFixed(2);
        }
        best = Math.round(p * (N - 1));
        if (best !== act) { if (act > -1) items[act].classList.remove('is-active'); items[best].classList.add('is-active'); act = best; if (cnt) cnt.textContent = ('0' + (best + 1)).slice(-2) + ' / ' + ('0' + N).slice(-2); }
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      }
      track(Engine.add({ el: sec, start: 'top top', end: 'bottom bottom', fn: fn }));
      fxDown.push(function () {
        sec.classList.remove('is-live'); sec.style.height = ''; rail.style.transform = '';
        items.forEach(function (it) { it.style.scale = ''; it.style.opacity = ''; it.classList.remove('is-active'); });
      });
    });
  }

  function buildFx() {
    var m = mode();
    hgWrap();
    fxParallax(m); fxHero(m); fxDepth(m); fxScrubText(m); fxExpand(m); fxStory(m); fxHG(m);
    EM.mode = m.size + (m.pin ? '+pin' : '');
    return m;
  }
  function teardownFx() { while (fxDown.length) { try { fxDown.pop()(); } catch (e) {} } }
  var built = null;
  function initFx() {
    if (reduce) return;
    built = buildFx();
    var re = debounce(function () {
      var m = mode();
      if (m.size !== built.size || m.pin !== built.pin || Math.abs(m.h - built.h) > 160) { teardownFx(); built = buildFx(); Engine.refresh(); }
    }, 220);
    window.addEventListener('resize', re);
    window.addEventListener('orientationchange', re);
  }
  /* wait for layout-affecting content (image sizes are known from width/height attrs, fonts settle) */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFx); else initFx();
  EM.rebuild = function () { teardownFx(); built = buildFx(); Engine.refresh(); };

  /* ------------------------------------------------------------------ pointer-only polish */
  if (fine && !reduce) {
    $$('.btn--gold, .btn--outline, .nav__cta').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.22).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
    var ring = document.createElement('div'), dot = document.createElement('div');
    ring.className = 'cursor'; dot.className = 'cursor-dot'; ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring); document.body.appendChild(dot);
    var mx = 0, my = 0, rx = 0, ry = 0, on = false, raf = 0;
    function loop() { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)'; raf = (Math.abs(mx - rx) + Math.abs(my - ry) > 0.2) ? requestAnimationFrame(loop) : 0; }
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY; dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      if (!on) { on = true; document.body.classList.add('has-cursor'); rx = mx; ry = my; }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { document.body.classList.remove('has-cursor'); on = false; });
    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      var view = t.closest && t.closest('.shot,.rail__item,.door,.card__img,.story__frame,.expand__media');
      var link = t.closest && t.closest('a,button,.faq__q,.pick,.chip,input,select,textarea');
      ring.classList.toggle('view', !!view);
      ring.classList.toggle('hover', !!link && !view);
      ring.textContent = view ? (view.classList.contains('shot') ? 'View' : view.classList.contains('rail__item') ? 'Drag' : 'Open') : '';
    });
  }

  /* ================================================================== layer 2: GSAP + ScrollTrigger + Lenis */
  if (reduce) return;
  var CDN = {
    gsap: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js'],
    st: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', 'https://unpkg.com/gsap@3.12.5/dist/ScrollTrigger.min.js'],
    lenis: ['https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js', 'https://unpkg.com/lenis@1.1.14/dist/lenis.min.js']
  };
  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      var to = setTimeout(function () { rej(new Error('timeout')); }, 7000);
      s.onload = function () { clearTimeout(to); res(); }; s.onerror = function () { clearTimeout(to); rej(new Error('blocked')); };
      document.head.appendChild(s);
    });
  }
  function loadAny(urls, test) {                    // first mirror that works wins; never throws
    return urls.reduce(function (p, u) { return p.then(function () { if (test()) return; return load(u).catch(function () {}); }); }, Promise.resolve());
  }
  function enhance() {
    var hasGSAP = !!(window.gsap && window.ScrollTrigger);
    if (hasGSAP) {
      try { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); Engine.adoptGSAP(); }
      catch (err) { hasGSAP = false; }
    }
    if (window.Lenis && !(window.matchMedia && matchMedia('(pointer:coarse)').matches)) {
      try {
        var lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
        root.classList.add('lenis', 'lenis-smooth');
        EM.lenis = lenis;
        if (EM.locks > 0) lenis.stop();
        if (hasGSAP) {
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
          gsap.ticker.lagSmoothing(0);
        } else {
          (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
        }
      } catch (err) { EM.lenis = null; }
    }
    EM.engine = Engine.usingGSAP ? 'gsap' : 'native';
  }
  var start = function () {
    loadAny(CDN.gsap, function () { return !!window.gsap; })
      .then(function () { return window.gsap ? loadAny(CDN.st, function () { return !!window.ScrollTrigger; }) : null; })
      .then(function () { return loadAny(CDN.lenis, function () { return !!window.Lenis; }); })
      .then(enhance);
  };
  if (document.readyState === 'complete') setTimeout(start, 300); else window.addEventListener('load', function () { setTimeout(start, 300); });

  /* ------------------------------------------------------------------ lifecycle: leave nothing running */
  window.addEventListener('pagehide', function (e) {
    if (e.persisted) return;            // back/forward cache keeps the page alive: leave it running
    teardownFx();
    if (window.ScrollTrigger && Engine.usingGSAP) ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
    if (revealIO) revealIO.disconnect();
    if (EM.lenis) { try { EM.lenis.destroy(); } catch (e) {} EM.lenis = null; }
  });
})();
