/* Elegant Moments — booking form: validates, saves the request through the API (/api/bookings), WhatsApp stays as a backup */
(function () {
  'use strict';
  var form = document.querySelector('[data-booking]');
  if (!form) return;
  var WA = '94773712683';
  var SERVICES = {
    photography: { label: 'Elegant Moments Photography', items: ['Family & kids', 'Birthday', 'Maternity', 'Portrait', 'Graduation', 'Other'] },
    weddings: { label: 'Elegant Moments Weddings', items: ['Full package', 'Pre-shoot', 'Wedding shoot', 'Homecoming', 'Wedding event'] }
  };
  var state = { brand: form.dataset.brand || 'weddings', service: form.dataset.service || '' };
  var $ = function (s) { return form.querySelector(s); };
  var chips = $('.chips'), picks = form.querySelectorAll('.pick'), prev = document.querySelector('.preview__msg');
  var f = { name: $('[name=name]'), phone: $('[name=phone]'), email: $('[name=email]'), hp: $('[name=website]'), date: $('[name=date]'), place: $('[name=place]'), kind: $('[name=kind]'), note: $('[name=note]') };

  function setBrand(b) {
    state.brand = b;
    picks.forEach(function (p) { var on = p.dataset.brand === b; p.classList.toggle('on', on); p.setAttribute('aria-pressed', on); });
    chips.innerHTML = '';
    SERVICES[b].items.forEach(function (it) {
      var c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = it;
      c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function () { state.service = it; markChips(); render(); });
      chips.appendChild(c);
    });
    var match = SERVICES[b].items.filter(function (i) { return i.toLowerCase().replace(/[^a-z]/g, '') === state.service.toLowerCase().replace(/[^a-z]/g, ''); })[0];
    state.service = match || '';
    markChips();
    var lbl = $('[data-lbl-place]'), kindWrap = $('[data-kind-wrap]'), dl = $('[data-lbl-date]');
    if (lbl) lbl.textContent = b === 'weddings' ? 'Venue or city' : 'Location (optional)';
    if (dl) dl.textContent = b === 'weddings' ? 'Wedding date' : 'Preferred date';
    if (kindWrap) kindWrap.hidden = b === 'weddings';
    render();
  }
  function markChips() { chips.querySelectorAll('.chip').forEach(function (c) { var on = c.textContent === state.service; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); }); }
  function fmtDate(v) { if (!v) return ''; var d = new Date(v + 'T00:00:00'); return isNaN(d) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function message() {
    var b = SERVICES[state.brand], L = [];
    L.push('Hello ' + b.label + '! ✨');
    L.push(state.brand === 'weddings' ? "I'd like to check availability for my wedding." : "I'd like to book a photoshoot.");
    L.push('');
    if (state.service) L.push('• Service: ' + state.service);
    if (f.name.value.trim()) L.push('• Name: ' + f.name.value.trim());
    if (f.date.value) L.push('• ' + (state.brand === 'weddings' ? 'Wedding date: ' : 'Preferred date: ') + fmtDate(f.date.value));
    if (f.place.value.trim()) L.push('• ' + (state.brand === 'weddings' ? 'Venue / city: ' : 'Location: ') + f.place.value.trim());
    if (state.brand === 'photography' && f.kind && f.kind.value) L.push('• Studio or outdoor: ' + f.kind.value);
    if (f.phone.value.trim()) L.push('• My number: ' + f.phone.value.trim());
    if (f.note.value.trim()) { L.push(''); L.push(f.note.value.trim()); }
    L.push(''); L.push('Thank you!');
    return L.join('\n');
  }
  function render() { if (prev) prev.textContent = message(); }
  picks.forEach(function (p) { p.addEventListener('click', function () { setBrand(p.dataset.brand); }); });
  form.addEventListener('input', render); form.addEventListener('change', render);
  function toast(t) { var n = document.querySelector('.toast'); if (!n) return; n.textContent = t; n.classList.add('show'); setTimeout(function () { n.classList.remove('show'); }, 2600); }
  var status = $('[data-status]');
  function setStatus(html, err) { if (!status) return; status.innerHTML = html; status.classList.toggle('show', !!html); status.classList.toggle('is-error', !!err); }
  function mark(el, bad) { var w = el.closest('.field'); if (w) w.classList.toggle('invalid', bad); el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
  function validPhone(v) { var d = v.replace(/[\s\-()]/g, ''); return /^(\+94|0094|94|0)?7\d{8}$/.test(d) || /^(\+94|0094|94|0)[1-9]\d{8}$/.test(d) || /^\+\d{9,14}$/.test(d); }
  function validDate(v) { if (!v) return false; var d = new Date(v + 'T00:00:00'), t = new Date(); t.setHours(0, 0, 0, 0); return !isNaN(d) && d >= t; }
  function validate() {
    var ok = true, first = null;
    var grp = form.querySelector('[data-service-group]');
    if (!state.service) { ok = false; first = first || chips; } if (grp) grp.classList.toggle('invalid', !state.service);
    [[f.name, f.name.value.trim().length >= 2], [f.phone, validPhone(f.phone.value.trim())], [f.date, validDate(f.date.value)]].forEach(function (c) {
      mark(c[0], !c[1]); if (!c[1]) { ok = false; first = first || c[0]; }
    });
    var em = f.email && f.email.value.trim();
    var emOk = !em || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
    if (f.email) { mark(f.email, !emOk); if (!emOk) { ok = false; first = first || f.email; } }
    if (first) { first.scrollIntoView && first.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (first.focus && first !== chips) first.focus({ preventScroll: true }); }
    return ok;
  }
  var dateEl = f.date; if (dateEl) { var n = new Date(); dateEl.min = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  var submitBtn = form.querySelector('button[type=submit]'), busy = false;
  var FIELD_MAP = { service: 'service', name: 'name', phone: 'phone', email: 'email', date: 'date' };
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function waLink() { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(message()); }
  function openWhatsApp() { return window.open(waLink(), '_blank', 'noopener'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    if (!validate()) { setStatus('<b>Please check the highlighted fields.</b> We need your service, name, phone number and date to send your request.', true); toast('Please check the highlighted fields'); return; }
    busy = true; submitBtn.disabled = true; setStatus('Sending your request…', false);
    var payload = {
      brand: state.brand, service: state.service,
      name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email ? f.email.value.trim() : '',
      date: f.date.value, place: f.place.value.trim(),
      kind: state.brand === 'photography' && f.kind ? f.kind.value : '',
      note: f.note.value.trim(), website: f.hp ? f.hp.value : ''
    };
    fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.body && res.body.ok) {
          setStatus('<b>Thank you, ' + esc(payload.name) + '! Your request has been received.</b> Your reference is <b>' + esc(res.body.reference) + '</b>. This is an enquiry: your date is <u>not</u> confirmed yet. We will contact you on ' + esc(payload.phone) + ' to confirm availability. <a href="' + waLink() + '" target="_blank" rel="noopener">Message us on WhatsApp too</a>.', false);
          toast('Request sent ✓');
          form.reset(); state.service = ''; setBrand(state.brand);
          status && status.scrollIntoView && status.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        var b = res.body || {};
        if (b.fields) {
          Object.keys(b.fields).forEach(function (k) {
            if (k === 'service') { var g = form.querySelector('[data-service-group]'); if (g) g.classList.add('invalid'); return; }
            if (f[k]) mark(f[k], true);
          });
        }
        setStatus('<b>' + esc(b.error || 'We could not send your request.') + '</b>' + (res.status >= 500 || !b.error ? ' You can send the same details on WhatsApp instead using the green button below.' : ''), true);
      })
      .catch(function () {
        setStatus('<b>We could not reach the server.</b> Please check your connection, or use <b>Send on WhatsApp instead</b> to send the same details.', true);
      })
      .then(function () { busy = false; submitBtn.disabled = false; });
  });
  var waBtn = form.querySelector('[data-wa]');
  if (waBtn) waBtn.addEventListener('click', function () {
    if (!validate()) { setStatus('<b>Please check the highlighted fields.</b>', true); return; }
    var w = openWhatsApp();
    setStatus('<b>Your message is ready in WhatsApp.</b> It is <u>not</u> sent yet: press <b>Send</b> there. This does not save a booking request on our website.' + (w ? '' : ' If WhatsApp did not open, use <b>Copy message</b> and send it to +94 77 371 2683.'), false);
  });
  var copy = document.querySelector('[data-copy]');
  if (copy) copy.addEventListener('click', function () {
    var t = message();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Message copied'); }, function () { toast('Copy not supported — select the text instead'); });
  });
  // initial brand from query string (?brand=photography&service=Birthday)
  var q = new URLSearchParams(location.search);
  if (q.get('brand') && SERVICES[q.get('brand')]) state.brand = q.get('brand');
  if (q.get('service')) state.service = q.get('service');
  setBrand(state.brand);
})();
