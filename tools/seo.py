#!/usr/bin/env python3
"""Stamp canonical + og:url on every page and write sitemap.xml / robots.txt.
Usage (run from the project root, once your domain is known):
    python3 tools/seo.py https://www.yourdomain.com
Works on the public/ folder. The admin dashboard is excluded from the sitemap and stays disallowed in robots.txt.
Safe to re-run: existing canonical / og:url tags are replaced."""
import sys, re, glob, os, datetime
if len(sys.argv) != 2 or not sys.argv[1].startswith('http'):
    sys.exit('Usage: python3 tools/seo.py https://www.yourdomain.com')
base = sys.argv[1].rstrip('/')
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))
pages = sorted(p for p in glob.glob('**/*.html', recursive=True) if not p.startswith('admin/'))
today = datetime.date.today().isoformat()
urls = []
for p in pages:
    path = '' if p == 'index.html' else p[:-10] + '/' if p.endswith('/index.html') else p
    url = f'{base}/{path}'
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', '', s)
    s = re.sub(r'\s*<meta property="og:url"[^>]*>', '', s)
    s = s.replace('<meta property="og:type"', f'<link rel="canonical" href="{url}">\n<meta property="og:url" content="{url}">\n<meta property="og:type"', 1)
    open(p, 'w', encoding='utf-8').write(s)
    pri = '1.0' if p == 'index.html' else '0.8' if p.count('/') == 0 or p.endswith('index.html') else '0.6'
    urls.append(f'  <url><loc>{url}</loc><lastmod>{today}</lastmod><priority>{pri}</priority></url>')
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: {base}/sitemap.xml\n')
print(f'Done: {len(pages)} pages stamped, sitemap.xml and robots.txt written for {base}')
