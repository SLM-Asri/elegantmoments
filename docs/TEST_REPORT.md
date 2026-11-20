# Test Report (automated, Chromium via Playwright)
Date: 2026-11-15

| Test | Result |
|---|---|
| 22 pages × 360 / 768 / 1440 px: JS errors, failed local requests, broken images, horizontal overflow | **0 issues** |
| Internal links / asset references | 0 broken |
| Booking: empty submit blocked; bad phone and past date rejected; valid submit opens wa.me/94773712683 with the message; "not confirmed" notice shown | Pass |
| Contact form: validation; WhatsApp message prepared | Pass |
| Weddings gallery: lightbox opens, ArrowRight advances, Escape closes; category filter reduces grid | Pass |
| Mobile menu (390 px): toggles, aria-expanded updates, link navigates | Pass |
| prefers-reduced-motion: preloader does not block | Pass |
| SEO tool run against a test domain: canonical/og:url on 22 pages, sitemap generated | Pass |

## Not tested / limits (honest notes)
- The sandbox cannot reach CDNs, so GSAP ScrollTrigger was not loaded; the site's built-in native scroll engine was what ran. With internet, GSAP loads automatically.
- No real-device or Lighthouse run. Please test on a phone after deploying.
- Photos are 640 px wide (two have 1280 px versions). On 1440–1920 px screens they will look soft in full-screen hero areas. Supply 1920 px originals for the best results; keep filenames and replace in place.
- AVIF variants were not generated; the originals are already WebP.
