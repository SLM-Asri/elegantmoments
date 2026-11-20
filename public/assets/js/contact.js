/* Elegant Moments — contact form: validates, then sends the message through the API (/api/contact); WhatsApp is a backup */
(function () {
  'use strict';
  var form = document.querySelector('[data-contact]'); if (!form) return;
  var WA = '94773712683';
  var st = form.querySelector('[data-status]'), busy = false;
  function $(n) { return form.elements[n]; }
  function say(h, err) { st.innerHTML = h; st.classList.add('show'); st.classList.toggle('is-error', !!err); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mark(el, bad) { var w = el.closest('.field'); if (w) w.classList.toggle('invalid', bad); el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
  function validPhone(v) { var d = v.replace(/[\s\-()]/g, ''); return /^(\+94|0094|94|0)?[1-9]\d{8}$/.test(d) || /^\+\d{9,14}$/.test(d); }
  function text() {
    return 'Hello Elegant Moments!\n\nEnquiry: ' + $('topic').value + '\nName: ' + $('name').value.trim() + '\nMy number: ' + $('phone').value.trim() + '\n\n' + $('msg').value.trim() + '\n\nThank you!';
  }
  function check() {
    var em = $('email').value.trim();
    var r = [[$('name'), $('name').value.trim().length >= 2], [$('phone'), validPhone($('phone').value.trim())],
             [$('email'), !em || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)], [$('msg'), $('msg').value.trim().length >= 5]], first = null;
    r.forEach(function (c) { mark(c[0], !c[1]); if (!c[1] && !first) first = c[0]; });
    if (first) { first.focus(); say('<b>Please check the highlighted fields.</b>', true); return false; }
    return true;
  }
  function whatsapp() {
    if (!check()) return;
    var w = window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(text()), '_blank', 'noopener');
    say('<b>Your message is ready in WhatsApp.</b> It has <u>not</u> been sent yet; please press <b>Send</b> there.' + (w ? '' : ' If WhatsApp did not open, call 071 583 2683 or email studioelegantmoments@gmail.com.'), false);
  }
  function send() {
    if (busy || !check()) return;
    busy = true;
    var btn = form.querySelector('[data-via="send"]'); if (btn) btn.disabled = true;
    say('Sending your message…', false);
    fetch('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('name').value.trim(), phone: $('phone').value.trim(), email: $('email').value.trim(), topic: $('topic').value, msg: $('msg').value.trim(), website: $('website') ? $('website').value : '' })
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.body && res.body.ok) {
          say('<b>Thank you, ' + esc($('name').value.trim()) + '! Your message has been sent.</b> We will get back to you soon by phone, WhatsApp or email.', false);
          form.reset();
          return;
        }
        var b = res.body || {};
        if (b.fields) Object.keys(b.fields).forEach(function (k) { var el = $(k === 'msg' ? 'msg' : k); if (el) mark(el, true); });
        say('<b>' + esc(b.error || 'We could not send your message.') + '</b> You can also use <b>Send on WhatsApp instead</b>.', true);
      })
      .catch(function () { say('<b>We could not reach the server.</b> Please try again, or use <b>Send on WhatsApp instead</b>.', true); })
      .then(function () { busy = false; if (btn) btn.disabled = false; });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
  form.querySelector('[data-via="wa"]').addEventListener('click', whatsapp);
  form.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.field.invalid')) mark(e.target, false); });
})();
