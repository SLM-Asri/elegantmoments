const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Never throws: email problems must not break a booking.
async function send({ to, subject, html, replyTo }) {
  if (!transporter || !to) return false;
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html, replyTo });
    return true;
  } catch (err) {
    console.error('[mail] failed:', err.message);
    return false;
  }
}

function row(k, v) {
  return v ? `<tr><td style="padding:4px 12px 4px 0;color:#777">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>` : '';
}

function notifyNewBooking(b) {
  return send({
    to: env.smtp.notifyTo,
    replyTo: b.email || undefined,
    subject: `New booking request ${b.reference} — ${b.service} (${b.event_date})`,
    html: `<h2>New booking request</h2><table>${row('Reference', b.reference)}${row('Brand', b.brand)}${row('Service', b.service)}${row('Date', b.event_date)}${row('Name', b.name)}${row('Phone', b.phone)}${row('Email', b.email)}${row('Location', b.location)}${row('Studio/Outdoor', b.shoot_type)}${row('Note', b.note)}</table><p><a href="${esc(env.siteUrl)}/admin/">Open admin dashboard</a></p>`,
  });
}

function confirmBookingReceived(b) {
  return send({
    to: b.email,
    subject: `We received your enquiry (${b.reference}) — Elegant Moments`,
    html: `<div style="font-family:Georgia,serif;max-width:520px"><h2 style="color:#b8934a">Thank you, ${esc(b.name)}</h2><p>We have received your request for <b>${esc(b.service)}</b> on <b>${esc(b.event_date)}</b>.</p><p>Your reference is <b>${esc(b.reference)}</b>. This is an enquiry, not a confirmed booking yet — we will contact you on <b>${esc(b.phone)}</b> to confirm availability.</p><p>— Elegant Moments, Anuradhapura</p></div>`,
  });
}

function notifyNewMessage(m) {
  return send({
    to: env.smtp.notifyTo,
    replyTo: m.email || undefined,
    subject: `New message from ${m.name} — ${m.topic}`,
    html: `<h2>New contact message</h2><table>${row('Name', m.name)}${row('Phone', m.phone)}${row('Email', m.email)}${row('Topic', m.topic)}</table><p style="white-space:pre-wrap">${esc(m.message)}</p><p><a href="${esc(env.siteUrl)}/admin/">Open admin dashboard</a></p>`,
  });
}

module.exports = { notifyNewBooking, confirmBookingReceived, notifyNewMessage };
