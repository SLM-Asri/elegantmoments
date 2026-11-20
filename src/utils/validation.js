const { z } = require('zod');

// Same rules as the website's front-end forms (Sri Lankan + international numbers)
function validPhone(v) {
  const d = v.replace(/[\s\-()]/g, '');
  return (
    /^(\+94|0094|94|0)?7\d{8}$/.test(d) ||
    /^(\+94|0094|94|0)[1-9]\d{8}$/.test(d) ||
    /^\+\d{9,14}$/.test(d)
  );
}

const clean = (max, min = 0) => z.string().trim().min(min).max(max);

const blankToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = (max) => z.preprocess(blankToUndef, clean(max).optional());
const optionalEmail = z.preprocess(
  blankToUndef,
  z.string().trim().toLowerCase().email().max(190).optional()
);

const phone = clean(30, 7).refine(validPhone, 'Enter a valid phone number');

const SERVICES = {
  photography: ['Family & kids', 'Birthday', 'Maternity', 'Portrait', 'Graduation', 'Other'],
  weddings: ['Full package', 'Pre-shoot', 'Wedding shoot', 'Homecoming', 'Wedding event'],
};

const TOPICS = [
  'General enquiry',
  'Wedding / Pre-shoot / Homecoming',
  'Family & kids',
  'Birthday',
  'Maternity',
  'Portrait',
  'Graduation',
];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');

// Today's date in Sri Lanka (UTC+5:30) as YYYY-MM-DD
function todayLK() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

const bookingSchema = z
  .object({
    brand: z.enum(['weddings', 'photography']),
    service: clean(60, 1),
    name: clean(100, 2),
    phone,
    email: optionalEmail,
    date: isoDate,
    place: optionalText(150),
    kind: z.preprocess(blankToUndef, z.enum(['Studio', 'Outdoor', 'Both']).optional()),
    note: optionalText(2000),
    website: z.string().optional(), // honeypot
  })
  .superRefine((v, ctx) => {
    if (!SERVICES[v.brand].includes(v.service)) {
      ctx.addIssue({ code: 'custom', path: ['service'], message: 'Choose a valid service' });
    }
    if (v.date < todayLK()) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Date must be today or later' });
    }
  });

const contactSchema = z.object({
  name: clean(100, 2),
  phone,
  email: optionalEmail,
  topic: z.enum(TOPICS),
  msg: clean(3000, 5),
  website: z.string().optional(), // honeypot
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(1).max(200),
});

module.exports = { bookingSchema, contactSchema, loginSchema, isoDate, todayLK, SERVICES, TOPICS, validPhone };
