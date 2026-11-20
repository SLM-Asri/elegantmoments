# Elegant Moments — Website

Luxury Gold + Ivory redesign for Elegant Moments Photography & Elegant Moments Weddings (Anuradhapura, Sri Lanka).

## Run
Open `index.html` in a browser, or upload the whole folder to any static host. No build step.

## Structure
- `index.html`, `about.html`, `contact.html`, `faq.html`
- `photography/` — overview, about, services, gallery, family, birthday, maternity, portrait, graduation
- `weddings/` — overview, about, services, gallery, pre-shoot, wedding-shoot, homecoming, wedding-events
- `booking/booking.html` — form that writes the WhatsApp message (+94 77 371 2683)
- `assets/css` — style, responsive, photography, weddings, gallery
- `assets/js` — script, navigation, animations, gallery, booking
- `assets/images` — logo (EM monogram: gold/ivory/black), brand icons, photos by category

## Colours
Ivory `#FDFBF7` · Champagne Gold `#C9A96A` · Charcoal `#2B2B2B` · Light Beige `#EDE6D6`
Weddings side uses a deep ink background with heavy gold; Photography uses bright ivory with gold accents.

## Notes
- Fonts (Cormorant Garamond + Jost) load from Google Fonts; they fall back to Georgia offline.
- Animations respect `prefers-reduced-motion`.
- Photos are 640px wide (a few 1280px); keep new uploads at 1280px+ wide for large displays.
- Update contact details in the footer/contact page if they change.

## Motion system (assets/css/motion.css, assets/js/script.js + animations.js)
- Tokens: one easing family (`--ease` settle, `--ease-io` cinematic), three durations, one stagger step (top of `motion.css`, mirrored in `EM.motion`). Only transform, opacity, clip-path and the `scale` / `translate` properties are animated.
- Preloader (first visit per session): logo wipe, letter reveal, % progress, split-curtain exit. Page transitions: curtain wipe with a gold progress line (4.5 s failsafe).
- Shared scroll bus: `EM.onScroll(fn)` (one passive listener for nav, back-to-top and every effect).
- Scroll engine: `EM.scrub({el,start,end,fn(p)})`. Every scroll-driven effect is a pure function of progress. GSAP ScrollTrigger drives it when the CDN loads (cdnjs, then jsDelivr, then unpkg); otherwise a native engine with cached offsets does. Effects are rebuilt per breakpoint and torn down on change/pagehide.
- Cinematic components (each has a complete static layout; JS adds `.is-live` / `.is-flow` only when active):
  - `.hero-slides` home hero: layered photographs, directional clip wipes, slow zoom (HTML only; no library needed).
  - `[data-expand="wide|portrait"]` expanding photograph (pinned on desktop/tablet, un-pinned "flow" version on mobile).
  - `[data-story]` pinned collection list with wiping photographs (photography overview).
  - `.hg` sticky horizontal gallery: any `.rail` section is wrapped automatically; pinned on desktop (>=1025px wide, >=600px tall), native swipe rail elsewhere.
  - Parallax layers, image depth (photo travels/zooms inside its frame), `[data-scrub-text]` words that light up with scroll, `[data-parallax="0.08"]`.
- Breakpoints: desktop = full effects; tablet = lighter parallax and shorter pins; mobile = reveals, hero and flow-expand only (no pinning, no parallax).
- `prefers-reduced-motion`: no preloader, transitions, smooth scroll, pinning or reveals; all content is shown immediately.
- Buttons share `--btn-radius` (10px) and one hover/press feel.
- Change timing in one place: the variables at the top of `motion.css`.

## Install, run, deploy
- **Run locally:** `python3 -m http.server 8000` in this folder, then open http://localhost:8000 (or just open `index.html`).
- **Deploy:** upload the whole folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, cPanel). No build step, no environment variables, no backend.
- **SEO (once you know the domain):** `python3 tools/seo.py https://www.yourdomain.com` adds canonical/og:url to every page and writes `sitemap.xml` + `robots.txt`. Then submit the sitemap in Google Search Console.
- **Contact details:** WhatsApp number is in `assets/js/booking.js`, `assets/js/contact.js` and the page links. Search the project for `94773712683` to change it.
- Docs: `docs/PROJECT_AUDIT.md`, `docs/TEST_REPORT.md`.
