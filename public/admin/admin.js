/* Elegant Moments admin dashboard (vanilla JS). All dynamic text is escaped with esc(). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t) { var n = $('#toast'); n.textContent = t; n.classList.add('show'); setTimeout(function () { n.classList.remove('show'); }, 2400); }

  function api(method, url, body) {
    var o = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch('/api/admin' + url, o).then(function (r) {
      if (r.status === 401) { location.href = 'login.html'; return new Promise(function () {}); } // stop the chain while the browser redirects
      return r.json().catch(function () { return { ok: false, error: 'Bad response' }; });
    });
  }
  function fmtDate(d) { if (!d) return ''; var x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTs(t) { if (!t) return ''; var x = new Date(String(t).replace(' ', 'T')); return isNaN(x) ? t : x.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function pill(s) { return '<span class="pill ' + esc(s) + '">' + esc(s) + '</span>'; }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k] !== '' && o[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function tel(p) { return '<a href="tel:' + esc(String(p).replace(/[^\d+]/g, '')) + '">' + esc(p) + '</a>'; }
  function waLink(p) { var d = String(p).replace(/[^\d]/g, ''); if (d.indexOf('0094') === 0) d = d.slice(2); else if (d.charAt(0) === '0') d = '94' + d.slice(1); return 'https://wa.me/' + d; }

  /* ---------- shell ---------- */
  var tabs = { overview: 'Overview', bookings: 'Bookings', messages: 'Messages', dates: 'Blocked dates', settings: 'Settings' };
  var loaded = {};
  function show(tab) {
    $$('#nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    Object.keys(tabs).forEach(function (t) { $('#tab-' + t).hidden = t !== tab; });
    $('#title').textContent = tabs[tab];
    $('#side').classList.remove('open');
    ({ overview: loadOverview, bookings: loadBookings, messages: loadMessages, dates: loadDates, settings: renderSettings })[tab]();
    history.replaceState(null, '', '#' + tab);
  }
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.tab); });
  $('#menu').addEventListener('click', function () { $('#side').classList.toggle('open'); });
  $('#logout').addEventListener('click', function () { api('POST', '/logout', {}).then(function () { location.href = 'login.html'; }); });

  /* ---------- modal ---------- */
  var modal = $('#modal');
  function openModal(html) { $('#modal-box').innerHTML = html; modal.classList.add('open'); }
  function closeModal() { modal.classList.remove('open'); }
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ---------- overview ---------- */
  function refreshBadges(s) {
    var p = $('#b-pending'), m = $('#b-msg');
    p.textContent = s.bookings.pending; p.hidden = !s.bookings.pending;
    m.textContent = s.newMessages; m.hidden = !s.newMessages;
  }
  function loadOverview() {
    api('GET', '/stats').then(function (s) {
      if (!s.ok) return;
      refreshBadges(s);
      var rows = s.upcoming.map(function (b) {
        return '<tr class="click" data-id="' + b.id + '"><td>' + esc(fmtDate(b.event_date)) + '</td><td>' + esc(b.name) + '</td><td>' + esc(b.service) + ' <span class="pill ' + esc(b.brand) + '">' + esc(b.brand) + '</span></td><td>' + tel(b.phone) + '</td><td>' + pill(b.status) + '</td></tr>';
      }).join('');
      $('#tab-overview').innerHTML =
        '<div class="cards">' +
        '<div class="card"><small>Pending requests</small><b>' + s.bookings.pending + '</b></div>' +
        '<div class="card"><small>Confirmed</small><b>' + s.bookings.confirmed + '</b></div>' +
        '<div class="card"><small>Completed</small><b>' + s.bookings.completed + '</b></div>' +
        '<div class="card"><small>New messages</small><b>' + s.newMessages + '</b></div>' +
        '<div class="card"><small>Requests this month</small><b>' + s.bookingsThisMonth + '</b></div></div>' +
        '<div class="panel"><h3>Upcoming dates</h3>' + (rows ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Name</th><th>Service</th><th>Phone</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">No upcoming bookings yet.</div>') + '</div>';
      $$('#tab-overview tr.click').forEach(function (tr) { tr.addEventListener('click', function () { openBooking(tr.dataset.id); }); });
    });
  }

  /* ---------- bookings ---------- */
  var bq = { status: '', brand: '', q: '', from: '', to: '', page: 1 };
  function loadBookings() {
    var el = $('#tab-bookings');
    if (!loaded.bookings) {
      loaded.bookings = true;
      el.innerHTML =
        '<div class="toolbar">' +
        '<div class="grow"><label>Search</label><input id="bq-q" placeholder="Name, phone, email or reference"></div>' +
        '<div><label>Status</label><select id="bq-status"><option value="">All</option><option>pending</option><option>confirmed</option><option>completed</option><option>cancelled</option></select></div>' +
        '<div><label>Brand</label><select id="bq-brand"><option value="">All</option><option value="weddings">Weddings</option><option value="photography">Photography</option></select></div>' +
        '<div><label>Date from</label><input type="date" id="bq-from"></div><div><label>Date to</label><input type="date" id="bq-to"></div>' +
        '<div style="flex:0"><a class="btn btn--ghost" id="bq-csv" href="#" style="display:inline-block;text-decoration:none;white-space:nowrap">⬇ Export CSV</a></div></div>' +
        '<div id="bq-list"></div>';
      var t; $('#bq-q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { bq.q = $('#bq-q').value; bq.page = 1; loadBookings(); }, 300); });
      ['status', 'brand', 'from', 'to'].forEach(function (k) { $('#bq-' + k).addEventListener('change', function () { bq[k] = this.value; bq.page = 1; loadBookings(); }); });
    }
    $('#bq-csv').href = '/api/admin/bookings.csv?' + qs({ status: bq.status, brand: bq.brand, q: bq.q, from: bq.from, to: bq.to });
    api('GET', '/bookings?' + qs(bq)).then(function (r) {
      if (!r.ok) return;
      var list = $('#bq-list');
      if (!r.rows.length) { list.innerHTML = '<div class="empty">No bookings found.</div>'; return; }
      list.innerHTML = '<div class="tablewrap"><table><thead><tr><th>Ref</th><th>Event date</th><th>Name</th><th>Service</th><th>Phone</th><th>Status</th><th>Received</th></tr></thead><tbody>' +
        r.rows.map(function (b) {
          return '<tr class="click' + (b.status === 'pending' ? ' unread' : '') + '" data-id="' + b.id + '"><td>' + esc(b.reference) + '</td><td>' + esc(fmtDate(b.event_date)) + '</td><td>' + esc(b.name) + '</td><td>' + esc(b.service) + ' <span class="pill ' + esc(b.brand) + '">' + esc(b.brand) + '</span></td><td>' + esc(b.phone) + '</td><td>' + pill(b.status) + '</td><td>' + esc(fmtTs(b.created_at)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + pager(r, function (p) { bq.page = p; loadBookings(); });
      $$('#bq-list tr.click').forEach(function (tr) { tr.addEventListener('click', function () { openBooking(tr.dataset.id); }); });
      bindPager(list);
    });
  }
  function pager(r, cb) {
    var pages = Math.max(1, Math.ceil(r.total / r.per));
    pager.cb = cb;
    return '<div class="pager"><span>' + r.total + ' total</span><span><button class="btn btn--ghost btn--sm" data-pg="' + (r.page - 1) + '"' + (r.page <= 1 ? ' disabled' : '') + '>‹ Prev</button> Page ' + r.page + ' of ' + pages + ' <button class="btn btn--ghost btn--sm" data-pg="' + (r.page + 1) + '"' + (r.page >= pages ? ' disabled' : '') + '>Next ›</button></span></div>';
  }
  function bindPager(root) { var cb = pager.cb; $$('[data-pg]', root).forEach(function (b) { b.addEventListener('click', function () { cb(parseInt(b.dataset.pg, 10)); }); }); }

  function openBooking(id) {
    api('GET', '/bookings/' + id).then(function (r) {
      if (!r.ok) return toast(r.error || 'Not found');
      var b = r.booking;
      openModal(
        '<h3>' + esc(b.name) + '</h3><div>' + pill(b.status) + ' <span class="pill ' + esc(b.brand) + '">' + esc(b.brand) + '</span> &nbsp;<small>Ref ' + esc(b.reference) + '</small></div>' +
        '<dl class="kv"><dt>Service</dt><dd>' + esc(b.service) + '</dd><dt>Event date</dt><dd>' + esc(fmtDate(b.event_date)) + '</dd>' +
        '<dt>Phone</dt><dd>' + tel(b.phone) + ' · <a href="' + esc(waLink(b.phone)) + '" target="_blank" rel="noopener">WhatsApp</a></dd>' +
        (b.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></dd>' : '') +
        (b.location ? '<dt>Location</dt><dd>' + esc(b.location) + '</dd>' : '') +
        (b.shoot_type ? '<dt>Studio / outdoor</dt><dd>' + esc(b.shoot_type) + '</dd>' : '') +
        (b.note ? '<dt>Customer note</dt><dd>' + esc(b.note) + '</dd>' : '') +
        '<dt>Received</dt><dd>' + esc(fmtTs(b.created_at)) + '</dd></dl>' +
        '<div class="field"><label for="m-status">Status</label><select id="m-status">' + ['pending', 'confirmed', 'completed', 'cancelled'].map(function (s) { return '<option' + (s === b.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="m-notes">Private notes (only you see this)</label><textarea id="m-notes" rows="3">' + esc(b.admin_notes || '') + '</textarea></div>' +
        '<div class="msg err" id="m-err"></div>' +
        '<div class="row"><button class="btn" id="m-save">Save changes</button><button class="btn btn--ghost" id="m-close">Close</button><button class="btn btn--danger" id="m-del">Delete</button></div>'
      );
      $('#m-close').onclick = closeModal;
      $('#m-save').onclick = function () {
        api('PATCH', '/bookings/' + id, { status: $('#m-status').value, admin_notes: $('#m-notes').value }).then(function (x) {
          if (!x.ok) { var e = $('#m-err'); e.textContent = x.error || 'Could not save'; e.classList.add('show'); return; }
          closeModal(); toast('Saved'); refreshCurrent();
        });
      };
      $('#m-del').onclick = function () {
        if (!confirm('Delete this booking permanently?')) return;
        api('DELETE', '/bookings/' + id).then(function () { closeModal(); toast('Deleted'); refreshCurrent(); });
      };
    });
  }

  /* ---------- messages ---------- */
  var mq = { status: '', q: '', page: 1 };
  function loadMessages() {
    var el = $('#tab-messages');
    if (!loaded.messages) {
      loaded.messages = true;
      el.innerHTML =
        '<div class="toolbar"><div class="grow"><label>Search</label><input id="mq-q" placeholder="Name, phone, email or text"></div>' +
        '<div><label>Status</label><select id="mq-status"><option value="">All</option><option>new</option><option>read</option><option>replied</option><option>archived</option></select></div></div><div id="mq-list"></div>';
      var t; $('#mq-q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { mq.q = $('#mq-q').value; mq.page = 1; loadMessages(); }, 300); });
      $('#mq-status').addEventListener('change', function () { mq.status = this.value; mq.page = 1; loadMessages(); });
    }
    api('GET', '/messages?' + qs(mq)).then(function (r) {
      if (!r.ok) return;
      var list = $('#mq-list');
      if (!r.rows.length) { list.innerHTML = '<div class="empty">No messages found.</div>'; return; }
      list.innerHTML = '<div class="tablewrap"><table><thead><tr><th>From</th><th>Topic</th><th>Message</th><th>Status</th><th>Received</th></tr></thead><tbody>' +
        r.rows.map(function (m) {
          return '<tr class="click' + (m.status === 'new' ? ' unread' : '') + '" data-id="' + m.id + '"><td>' + esc(m.name) + '<br><small>' + esc(m.phone) + '</small></td><td>' + esc(m.topic) + '</td><td>' + esc(m.message.length > 90 ? m.message.slice(0, 90) + '…' : m.message) + '</td><td>' + pill(m.status) + '</td><td>' + esc(fmtTs(m.created_at)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + pager(r, function (p) { mq.page = p; loadMessages(); });
      var byId = {}; r.rows.forEach(function (m) { byId[m.id] = m; });
      $$('#mq-list tr.click').forEach(function (tr) { tr.addEventListener('click', function () { openMessage(byId[tr.dataset.id]); }); });
      bindPager(list);
    });
    api('GET', '/stats').then(function (s) { if (s.ok) refreshBadges(s); });
  }
  function openMessage(m) {
    openModal(
      '<h3>' + esc(m.name) + '</h3><div>' + pill(m.status) + ' &nbsp;<small>' + esc(m.topic) + '</small></div>' +
      '<dl class="kv"><dt>Phone</dt><dd>' + tel(m.phone) + ' · <a href="' + esc(waLink(m.phone)) + '" target="_blank" rel="noopener">WhatsApp</a></dd>' +
      (m.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></dd>' : '') +
      '<dt>Received</dt><dd>' + esc(fmtTs(m.created_at)) + '</dd><dt>Message</dt><dd>' + esc(m.message) + '</dd></dl>' +
      '<div class="row"><button class="btn btn--ghost" data-s="read">Mark read</button><button class="btn btn--ghost" data-s="replied">Mark replied</button><button class="btn btn--ghost" data-s="archived">Archive</button><button class="btn btn--danger" id="mm-del">Delete</button><button class="btn" id="mm-close">Close</button></div>'
    );
    $('#mm-close').onclick = closeModal;
    $$('#modal-box [data-s]').forEach(function (b) { b.onclick = function () { api('PATCH', '/messages/' + m.id, { status: b.dataset.s }).then(function () { closeModal(); toast('Updated'); loadMessages(); }); }; });
    $('#mm-del').onclick = function () { if (!confirm('Delete this message permanently?')) return; api('DELETE', '/messages/' + m.id).then(function () { closeModal(); toast('Deleted'); loadMessages(); }); };
    if (m.status === 'new') api('PATCH', '/messages/' + m.id, { status: 'read' }).then(loadMessages);
  }

  /* ---------- blocked dates ---------- */
  function loadDates() {
    api('GET', '/blocked-dates').then(function (r) {
      if (!r.ok) return;
      $('#tab-dates').innerHTML =
        '<div class="panel"><h3>Block a date</h3><p style="margin-top:0;color:#777">Customers cannot request a blocked date on the website. Confirmed bookings also fill dates automatically (Weddings: 1/day by default).</p>' +
        '<div class="toolbar"><div><label>Date</label><input type="date" id="bd-date"></div><div><label>Applies to</label><select id="bd-brand"><option value="all">Everything</option><option value="weddings">Weddings only</option><option value="photography">Photography only</option></select></div><div class="grow"><label>Reason (private)</label><input id="bd-reason" maxlength="150" placeholder="e.g. Poya day, away"></div><div style="flex:0"><button class="btn" id="bd-add">Block</button></div></div><div class="msg err" id="bd-err"></div></div>' +
        '<div class="panel"><h3>Upcoming blocked dates</h3>' + (r.rows.length ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Applies to</th><th>Reason</th><th></th></tr></thead><tbody>' + r.rows.map(function (d) { return '<tr><td>' + esc(fmtDate(d.blocked_date)) + '</td><td>' + esc(d.brand) + '</td><td>' + esc(d.reason || '') + '</td><td><button class="btn btn--danger btn--sm" data-del="' + d.id + '">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No blocked dates.</div>') + '</div>';
      $('#bd-add').onclick = function () {
        var e = $('#bd-err'); e.classList.remove('show');
        if (!$('#bd-date').value) { e.textContent = 'Choose a date.'; e.classList.add('show'); return; }
        api('POST', '/blocked-dates', { date: $('#bd-date').value, brand: $('#bd-brand').value, reason: $('#bd-reason').value }).then(function (x) {
          if (!x.ok) { e.textContent = x.error || 'Could not block date'; e.classList.add('show'); return; }
          toast('Date blocked'); loadDates();
        });
      };
      $$('[data-del]').forEach(function (b) { b.onclick = function () { api('DELETE', '/blocked-dates/' + b.dataset.del).then(function () { toast('Removed'); loadDates(); }); }; });
    });
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    $('#tab-settings').innerHTML =
      '<div class="panel" style="max-width:460px"><h3>Change password</h3><div class="msg" id="pw-msg"></div>' +
      '<div class="field"><label for="pw-cur">Current password</label><input type="password" id="pw-cur" autocomplete="current-password"></div>' +
      '<div class="field"><label for="pw-new">New password (min 10 characters)</label><input type="password" id="pw-new" autocomplete="new-password"></div>' +
      '<button class="btn" id="pw-go">Update password</button></div>';
    $('#pw-go').onclick = function () {
      var m = $('#pw-msg');
      api('POST', '/password', { current: $('#pw-cur').value, next: $('#pw-new').value }).then(function (x) {
        m.className = 'msg show ' + (x.ok ? 'ok' : 'err');
        m.textContent = x.ok ? 'Password updated.' : (x.fields && x.fields.next) || x.error || 'Could not update.';
        if (x.ok) { $('#pw-cur').value = ''; $('#pw-new').value = ''; }
      });
    };
  }

  function refreshCurrent() { var t = (location.hash || '#overview').slice(1); show(tabs[t] ? t : 'overview'); }

  /* ---------- boot ---------- */
  api('GET', '/me').then(function (r) {
    if (!r.ok) return;
    $('#who-name').textContent = r.admin.name; $('#who-email').textContent = r.admin.email;
    refreshCurrent();
  });
})();
