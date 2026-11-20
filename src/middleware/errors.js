const { ZodError } = require('zod');
const env = require('../config/env');

function notFound(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).send('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font-family:Georgia,serif;text-align:center;padding:12vh 20px;background:#FDFBF7;color:#2B2B2B"><h1 style="color:#C9A96A;font-weight:400">Page not found</h1><p><a href="/">Back to Elegant Moments</a></p></body>');
}

// Turns zod issues into { fieldName: 'message' } so the website can highlight fields
function zodFields(err) {
  const fields = {};
  for (const i of err.issues) {
    const k = i.path[0] || '_';
    if (!fields[k]) fields[k] = i.message;
  }
  return fields;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ ok: false, error: 'Please check the highlighted fields.', fields: zodFields(err) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Invalid request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'Request too large.' });
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: env.isProd ? 'Something went wrong. Please try again.' : err.message });
}

module.exports = { notFound, errorHandler };
