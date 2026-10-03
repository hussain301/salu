#!/usr/bin/env node
/**
 * scrape.mjs — Recover the original 2022 salu.edu.pk (WordPress) site from the Wayback Machine.
 *
 * Output (./data):
 *   pages.json   [{ key, path, type: 'page'|'news', title, date, categories[], featured, html, excerpt, source }]
 *   media.json   [{ id, url, file, mime, bytes, alt }]       (files in ./data/media/)
 *   menu.json    primary navigation tree from the 2022 header
 *   footer.json  footer link groups
 *
 * In `html`, links/images use tokens the CMS importer resolves:
 *   {{media:<id>}}  → uploaded media URL
 *   {{page:<path>}} → new URL of an imported page (falls back to the Wayback link)
 *
 * Raw HTML is cached in ./.cache so re-runs only re-process.
 * Usage: node scrape.mjs [--limit=N] [--max-doc-mb=15] [--no-docs]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const MEDIA_DIR = path.join(DATA, 'media');
const CACHE = path.join(ROOT, '.cache');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const LIMIT = Number(args.limit) || Infinity;
const MAX_DOC_BYTES = (Number(args['max-doc-mb']) || 15) * 1024 * 1024;
const DOWNLOAD_DOCS = !args['no-docs'];
const CONCURRENCY = 3;
const UA = 'Mozilla/5.0 (SALU content recovery; contact: webmaster)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha1').update(s).digest('hex');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ------------------------------------------------------------------ */
/* HTTP with retries                                                   */
/* ------------------------------------------------------------------ */

async function fetchWithRetry(url, { binary = false, tries = 5 } = {}) {
  let wait = 3000;
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
      if (res.status === 404) return { status: 404 };
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { status: res.status };
      const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      return { status: res.status, body, type: res.headers.get('content-type') || '', finalUrl: res.url };
    } catch (e) {
      if (i === tries) return { status: 0, error: String(e.message || e) };
      await sleep(wait + Math.random() * 1000);
      wait *= 2;
    }
  }
  return { status: 0 };
}

/** Simple pool. */
async function pool(items, worker, n = CONCURRENCY) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
      await sleep(400 + Math.random() * 400);
    }
  }));
  return out;
}

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

const SITE_HOSTS = /^(www\.)?(salu\.edu\.pk|salu\.softcodic\.com)$/i;
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i;
const IMG_EXT = /\.(jpe?g|png|gif|webp|svg)$/i;

const EXCLUDE_PATH = [
  /^\/wp-/, /^\/feed/, /\/feed\/$/, /\/page\/\d+\/?$/, /^\/news-category\//, /^\/author\//, /^\/tag\//,
  /^\/category\//, /^\/index\.php/, /^\/(content|sites|academics|publications|research)\//, /\.aspx$/i,
  /^\/comments/, /^\/amp\//, /xmlrpc/, /\.(xml|txt|json|php)$/i, DOC_EXT, IMG_EXT,
];

function normPath(p) {
  let s = decodeURIComponent(p || '/').replace(/\/+/g, '/');
  if (!s.startsWith('/')) s = `/${s}`;
  if (!/\.[a-z0-9]{2,5}$/i.test(s) && !s.endsWith('/')) s += '/';
  return s;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function pathKey(p) {
  return normPath(safeDecode(p)).toLowerCase();
}

const wayback = (url, ts = '2022') => `https://web.archive.org/web/${ts}/${url}`;

/* ------------------------------------------------------------------ */
/* 1. Discover URLs via CDX                                            */
/* ------------------------------------------------------------------ */

async function discover() {
  const cachePath = path.join(CACHE, 'cdx.json');
  let rows;
  if (existsSync(cachePath)) {
    rows = JSON.parse(await readFile(cachePath, 'utf8'));
  } else {
    const url = 'https://web.archive.org/cdx/search/cdx?url=salu.edu.pk/*&from=202109&to=202306&output=json'
      + '&fl=original,timestamp,length&filter=statuscode:200&filter=mimetype:text/html&limit=100000';
    log('Querying CDX…');
    const res = await fetchWithRetry(url);
    if (!res.body) throw new Error(`CDX failed: ${res.status} ${res.error || ''}`);
    rows = JSON.parse(res.body).slice(1);
    await writeFile(cachePath, JSON.stringify(rows));
  }
  log(`CDX rows: ${rows.length}`);

  /** path → candidates */
  const byPath = new Map();
  for (const [original, ts, length] of rows) {
    let u;
    try { u = new URL(original); } catch { continue; }
    if (u.search && !/^\?$/.test(u.search)) continue;
    const p = normPath(safeDecode(u.pathname));
    if (EXCLUDE_PATH.some((re) => re.test(p))) continue;
    const k = p.toLowerCase();
    if (!byPath.has(k)) byPath.set(k, { path: p, caps: [] });
    byPath.get(k).caps.push({ original: `https://salu.edu.pk${encodeURI(p)}`, ts, length: Number(length) || 0 });
  }
  // Rank captures: 2022 first, then largest (avoids bot-check stubs), then nearest to 2022.
  const score = (c) => (c.ts.startsWith('2022') ? 1e9 : 0) + c.length;
  const list = [...byPath.values()].map((e) => ({ ...e, caps: e.caps.sort((a, b) => score(b) - score(a)) }));
  list.sort((a, b) => a.path.localeCompare(b.path));
  log(`Unique pages: ${list.length}`);
  return list;
}

/* ------------------------------------------------------------------ */
/* 2. Fetch raw HTML (cached)                                          */
/* ------------------------------------------------------------------ */

const looksValid = (html) => html && html.length > 8000 && /wp-content/.test(html)
  && !/One moment, please/i.test(html.slice(0, 3000)) && !/503 Service Unavailable/i.test(html.slice(0, 2000));

async function fetchPage(entry) {
  const file = path.join(CACHE, 'html', `${sha(entry.path.toLowerCase())}.html`);
  if (existsSync(file)) {
    const meta = JSON.parse(await readFile(`${file}.json`, 'utf8'));
    return { html: await readFile(file, 'utf8'), ...meta };
  }
  for (const cap of entry.caps.slice(0, 4)) {
    const res = await fetchWithRetry(`https://web.archive.org/web/${cap.ts}id_/${cap.original}`);
    if (res.status === 200 && looksValid(res.body)) {
      const meta = { ts: cap.ts, original: cap.original };
      await writeFile(file, res.body);
      await writeFile(`${file}.json`, JSON.stringify(meta));
      return { html: res.body, ...meta };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 3. Media registry                                                   */
/* ------------------------------------------------------------------ */

const media = new Map(); // normalized url → { id, url, alt, kind }

function registerMedia(rawUrl, { alt = '', kind = 'image', fallbacks = [] } = {}) {
  const norm = (raw) => {
    let u;
    try { u = new URL(raw, 'https://salu.edu.pk/'); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    if (SITE_HOSTS.test(u.hostname)) u.hostname = 'salu.edu.pk';
    u.protocol = 'https:';
    u.hash = '';
    return u.href;
  };
  const url = norm(rawUrl);
  if (!url) return null;
  if (!media.has(url)) media.set(url, { id: sha(url).slice(0, 12), url, alt, kind, fallbacks: [] });
  const m = media.get(url);
  if (!m.alt && alt) m.alt = alt;
  for (const f of fallbacks.map(norm)) if (f && f !== url && !m.fallbacks.includes(f)) m.fallbacks.push(f);
  return m.id;
}

/** WordPress thumbnails: prefer the full-size original (`foo-300x200.jpg` → `foo.jpg`). */
const fullSize = (url) => url.replace(/-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|gif|webp)$)/i, '');

function bestImgSrc($img) {
  return imgCandidates($img)[0] || null;
}

/** All plausible URLs for an <img>, best first. */
function imgCandidates($img) {
  const out = [];
  const srcset = $img.attr('srcset') || $img.attr('data-srcset') || $img.attr('data-lazy-srcset');
  const set = srcset
    ? srcset.split(',').map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).sort((a, b) => b.w - a.w).map((x) => x.u)
    : [];
  const singles = [$img.attr('data-orig-file'), $img.attr('data-src'), $img.attr('data-lazy-src'), $img.attr('src')]
    .filter((s) => s && !s.startsWith('data:'));
  const first = set[0] || singles[0];
  if (first) out.push(fullSize(first));
  out.push(...set, ...singles);
  return [...new Set(out.filter(Boolean))];
}

/* ------------------------------------------------------------------ */
/* 4. Content extraction                                               */
/* ------------------------------------------------------------------ */

const DROP = [
  'script', 'style', 'noscript', 'form', 'nav', 'svg', 'button', 'input', 'select', 'textarea', 'iframe', 'object', 'embed',
  'link', 'meta', '.screen-reader-text', '.elementor-widget-navigation-menu', '.hfe-nav-menu', '.elementor-widget-spacer',
  '.elementor-widget-divider', '.elementor-hidden-desktop', '.sharedaddy', '.comments-area', '#comments', '.post-navigation',
  '.ast-breadcrumbs', '.elementor-widget-wp-widget-search', '.elementor-widget-search-form', '.elementor-swiper-button',
  '.elementor-widget-share-buttons', '.bwg_container .bwg-loading', '.wpforms-container', '.elementor-widget-html',
  '.elementor-widget-shortcode .wpforms-container',
];
const KEEP_BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot',
  'tr', 'td', 'th', 'blockquote', 'hr', 'pre', 'figure', 'figcaption', 'caption']);
const KEEP_INLINE = new Set(['strong', 'b', 'em', 'i', 'u', 'sub', 'sup', 'br', 'code']);
const SPLIT = '<!--split-->';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(String(s)).replace(/"/g, '&quot;');

function resolveLink(href, ctx) {
  if (!href) return null;
  const h = href.trim();
  if (/^(mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith('#') || /^javascript:/i.test(h)) return null;
  let u;
  try { u = new URL(h, 'https://salu.edu.pk/'); } catch { return null; }
  // Already a Wayback URL → unwrap
  const wb = u.href.match(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\/(.+)$/i);
  if (wb) { try { u = new URL(wb[1]); } catch { return null; } }
  if (!SITE_HOSTS.test(u.hostname)) return u.href;
  if (DOC_EXT.test(u.pathname) || IMG_EXT.test(u.pathname)) {
    const kind = IMG_EXT.test(u.pathname) ? 'image' : 'document';
    const id = registerMedia(u.href, { kind });
    ctx.files.add(id);
    return id ? `{{media:${id}}}` : wayback(u.href);
  }
  if (u.search && !/^\?p=\d+$/.test(u.search)) return wayback(u.href); // legacy dynamic URLs
  return `{{page:${normPath(safeDecode(u.pathname))}}}${u.hash || ''}`;
}

function render($, node, ctx) {
  if (node.type === 'text') return esc(node.data.replace(/\s+/g, ' '));
  if (node.type !== 'tag') return '';
  const tag = node.name.toLowerCase();
  const $n = $(node);
  const kids = () => node.children.map((c) => render($, c, ctx)).join('');

  if (tag === 'img') {
    const cands = imgCandidates($n);
    const src = cands[0];
    if (!src || /gravatar|emoji|spinner|loading|placeholder/i.test(src)) return '';
    const w = parseInt($n.attr('width'), 10);
    if (w && w < 24) return '';
    const id = registerMedia(src, { alt: ($n.attr('alt') || '').trim(), fallbacks: cands.slice(1) });
    if (!id) return '';
    ctx.images.push(id);
    return `<img src="{{media:${id}}}" alt="${escAttr($n.attr('alt') || '')}">`;
  }
  if (tag === 'a') {
    const inner = kids();
    if (!inner.replace(/<[^>]+>|\s|&nbsp;/g, '') && !/<img/.test(inner)) return '';
    const href = resolveLink($n.attr('href'), ctx);
    // Lightbox links wrapping an image → just the image
    if (/<img/.test(inner) && href && href.startsWith('{{media:') && !/document/.test(href)) return inner;
    return href ? `<a href="${escAttr(href)}">${inner}</a>` : inner;
  }
  if (tag === 'h1') return `${SPLIT}<h2>${kids()}</h2>${SPLIT}`;
  if (KEEP_BLOCK.has(tag)) {
    const attrs = ['colspan', 'rowspan'].map((a) => ($n.attr(a) ? ` ${a}="${escAttr($n.attr(a))}"` : '')).join('');
    if (tag === 'hr') return `${SPLIT}<hr>${SPLIT}`;
    return `${SPLIT}<${tag}${attrs}>${kids()}</${tag}>${SPLIT}`;
  }
  if (KEEP_INLINE.has(tag)) return tag === 'br' ? '<br>' : `<${tag}>${kids()}</${tag}>`;
  // Elementor tab/accordion titles → headings
  if (/elementor-(tab|accordion|toggle)-title/.test($n.attr('class') || '')) return `${SPLIT}<h3>${kids()}</h3>${SPLIT}`;
  // Generic container: unwrap but keep block separation.
  const inline = ['span', 'font', 'label', 'small', 'big', 'mark', 'abbr', 'time', 'cite', 'q'].includes(tag);
  return inline ? kids() : `${SPLIT}${kids()}${SPLIT}`;
}

const BLOCK_START = /^<(p|h[1-6]|ul|ol|table|blockquote|hr|pre|figure)[\s>]/i;

/** Wrap loose inline runs into <p>, drop empties, tidy. */
function tidy(html) {
  const parts = html.split(SPLIT);
  const out = [];
  let inlineBuf = '';
  const flush = () => {
    const t = inlineBuf.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');
    if (t.replace(/<[^>]+>|\s|&nbsp;/g, '') || /<img/.test(t)) out.push(`<p>${t}</p>`);
    inlineBuf = '';
  };
  for (const part of parts) {
    if (!part.trim()) continue;
    if (BLOCK_START.test(part.trim())) { flush(); out.push(part.trim()); } else inlineBuf += part;
  }
  flush();
  return out.join('\n')
    .replace(/<(p|h[2-6]|li|td|th|figcaption|strong|b|em)>(\s|&nbsp;|<br>)*<\/\1>/g, '')
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    .replace(/<p>\s*(<img[^>]+>)\s*<\/p>/g, '<figure>$1</figure>')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Remove repeated identical blocks (Elementor desktop/mobile duplicates). */
function dedupeBlocks(html) {
  const seen = new Set();
  return html.split('\n').filter((line) => {
    const k = line.replace(/\s+/g, ' ').trim();
    if (k.length < 40) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join('\n');
}

function textOf(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

const TITLE_SUFFIX = /\s*[-–|]\s*(Shah Abdul Latif University.*|SALU.*)$/i;

function extract(html, entry, meta) {
  const $ = cheerio.load(html);
  const ctx = { images: [], files: new Set() };
  const p = entry.path;
  const type = /^\/news\/[^/]+\/$/.test(p) || /^\/\d{4}\/\d{2}\/\d{2}\//.test(p) ? 'news' : 'page';

  let title = $('h1.entry-title').first().text().trim()
    || ($('meta[property="og:title"]').attr('content') || '').replace(TITLE_SUFFIX, '').trim()
    || $('title').text().replace(TITLE_SUFFIX, '').trim();
  title = title.replace(/\s+/g, ' ');

  const date = $('meta[property="article:published_time"]').attr('content')
    || $('time.entry-date').attr('datetime')
    || (html.match(/"datePublished":"([^"]+)"/) || [])[1]
    || `${meta.ts.slice(0, 4)}-${meta.ts.slice(4, 6)}-${meta.ts.slice(6, 8)}T00:00:00Z`;
  const modified = $('meta[property="article:modified_time"]').attr('content') || null;

  const classes = `${$('article').first().attr('class') || ''} ${$('body').attr('class') || ''}`;
  const categories = [...new Set([...classes.matchAll(/news-category-([a-z0-9-]+)/g)].map((m) => m[1]))];

  const ogImage = $('meta[property="og:image"]').attr('content');
  const featured = ogImage && !/logo|favicon|cropped-/i.test(ogImage) ? registerMedia(fullSize(ogImage), { fallbacks: [ogImage] }) : null;

  let $root = $('article .entry-content').first();
  if (!$root.length) $root = $('.entry-content').first();
  if (!$root.length) $root = $('[data-elementor-type="wp-page"], [data-elementor-type="wp-post"]').first();
  if (!$root.length) $root = $('main, #primary').first();
  $root.find(DROP.join(',')).remove();

  let body = dedupeBlocks(tidy(render($, $root[0] || { type: 'none' }, ctx)));
  // Drop a leading heading identical to the page title.
  body = body.replace(new RegExp(`^<h2>\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>\\n?`, 'i'), '');

  const text = textOf(body);
  return {
    key: pathKey(p),
    path: p,
    slug: p.split('/').filter(Boolean).pop() || 'home',
    type,
    title: title || p,
    date,
    modified,
    categories,
    featured,
    images: [...new Set(ctx.images)],
    html: body,
    excerpt: text.slice(0, 240),
    words: text ? text.split(' ').length : 0,
    source: `https://web.archive.org/web/${meta.ts}/${meta.original}`,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Navigation (from the 2022 homepage)                              */
/* ------------------------------------------------------------------ */

function menuTree($, $ul) {
  return $ul.children('li').map((_, li) => {
    const $li = $(li);
    const $a = $li.find('a').first();
    const label = $a.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
    const href = $a.attr('href') || '#';
    const item = { label, href: href === '#' ? null : resolveLink(href, { files: new Set() }) };
    const $sub = $li.children('ul.sub-menu');
    if ($sub.length) item.children = menuTree($, $sub);
    return item;
  }).get().filter((i) => i.label);
}

function extractNav(html) {
  const $ = cheerio.load(html);
  const headerMenus = $('header ul.hfe-nav-menu, .ehf-header ul.hfe-nav-menu, #masthead ul.hfe-nav-menu, header ul.menu');
  const menus = headerMenus.map((_, ul) => ({ items: menuTree($, $(ul)) })).get();
  const primary = menus.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]?.items || [];

  const footer = [];
  $('footer, .ehf-footer, #colophon').find('.elementor-column, .widget').each((_, col) => {
    const $c = $(col);
    if ($c.find('.elementor-column').length) return; // only leaf columns
    const heading = $c.find('h2, h3, h4, .elementor-heading-title, .widget-title').first().text().trim();
    const links = $c.find('a').map((__, a) => ({
      label: $(a).text().replace(/\s+/g, ' ').trim(),
      href: resolveLink($(a).attr('href'), { files: new Set() }),
    })).get().filter((l) => l.label && l.href);
    if (heading || links.length) footer.push({ heading, links, text: $c.text().replace(/\s+/g, ' ').trim().slice(0, 600) });
  });
  return { primary, footer };
}

/* ------------------------------------------------------------------ */
/* 6. Download media                                                   */
/* ------------------------------------------------------------------ */

const EXT_BY_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

async function downloadMedia(m) {
  const urlExt = (new URL(m.url).pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase();
  const existing = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar']
    .map((e) => path.join(MEDIA_DIR, `${m.id}.${e}`)).find((f) => existsSync(f));
  if (existing) {
    const s = await stat(existing);
    return { ...m, file: path.basename(existing), bytes: s.size, ok: true };
  }
  if (m.kind === 'document' && !DOWNLOAD_DOCS) return { ...m, ok: false, reason: 'docs disabled' };

  const tryUrls = [m.url, ...(m.fallbacks || [])].slice(0, 5);
  for (const u of tryUrls) {
    for (const ts of ['2022']) {
      const res = await fetchWithRetry(`https://web.archive.org/web/${ts}im_/${u}`, { binary: true, tries: 3 });
      if (res.status !== 200 || !res.body?.length) continue;
      const mime = res.type.split(';')[0].trim().toLowerCase();
      if (mime.startsWith('text/html')) continue;
      if (res.body.length > (m.kind === 'document' ? MAX_DOC_BYTES : 12 * 1024 * 1024)) {
        return { ...m, ok: false, reason: `too large (${(res.body.length / 1048576).toFixed(1)} MB)` };
      }
      const ext = EXT_BY_MIME[mime] || urlExt || 'bin';
      const file = `${m.id}.${ext === 'jpeg' ? 'jpg' : ext}`;
      await writeFile(path.join(MEDIA_DIR, file), res.body);
      return { ...m, file, mime, bytes: res.body.length, ok: true };
    }
  }
  return { ...m, ok: false, reason: 'not archived' };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  await mkdir(path.join(CACHE, 'html'), { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });

  const entries = (await discover()).slice(0, LIMIT);
  let done = 0;
  const fetched = await pool(entries, async (e) => {
    const r = await fetchPage(e);
    done += 1;
    if (done % 20 === 0 || !r) log(`pages ${done}/${entries.length}${r ? '' : ` ✖ ${e.path}`}`);
    return r;
  });

  const pages = [];
  let nav = { primary: [], footer: [] };
  fetched.forEach((r, i) => {
    if (!r) return;
    const page = extract(r.html, entries[i], r);
    if (entries[i].path === '/') {
      nav = extractNav(r.html);
      page.slug = 'home';
    }
    pages.push(page);
  });
  log(`Extracted ${pages.length} pages (${pages.filter((p) => p.type === 'news').length} news).`);

  log(`Downloading ${media.size} media files…`);
  let mdone = 0;
  const mediaList = await pool([...media.values()], async (m) => {
    const r = await downloadMedia(m);
    mdone += 1;
    if (mdone % 50 === 0) log(`media ${mdone}/${media.size}`);
    return r;
  }, 4);
  const okMedia = mediaList.filter((m) => m.ok);
  const okIds = new Set(okMedia.map((m) => m.id));
  log(`Media OK: ${okMedia.length}/${mediaList.length}`);

  // Replace tokens of failed media with Wayback links (docs) or drop images.
  const byId = new Map(mediaList.map((m) => [m.id, m]));
  for (const p of pages) {
    p.html = p.html
      .replace(/<figure><img src="\{\{media:([a-f0-9]+)\}\}"[^>]*><\/figure>/g, (all, id) => (okIds.has(id) ? all : ''))
      .replace(/<img src="\{\{media:([a-f0-9]+)\}\}"[^>]*>/g, (all, id) => (okIds.has(id) ? all : ''))
      .replace(/\{\{media:([a-f0-9]+)\}\}/g, (all, id) => (okIds.has(id) ? all : wayback(byId.get(id)?.url || '')));
    p.images = p.images.filter((id) => okIds.has(id));
    if (p.featured && !okIds.has(p.featured)) p.featured = p.images[0] || null;
  }

  await writeFile(path.join(DATA, 'pages.json'), JSON.stringify(pages, null, 1));
  await writeFile(path.join(DATA, 'media.json'), JSON.stringify(okMedia.map(({ id, url, file, mime, bytes, alt, kind }) => ({ id, url, file, mime, bytes, alt, kind })), null, 1));
  await writeFile(path.join(DATA, 'menu.json'), JSON.stringify(nav.primary, null, 1));
  await writeFile(path.join(DATA, 'footer.json'), JSON.stringify(nav.footer, null, 1));
  await writeFile(path.join(DATA, 'failed-media.json'), JSON.stringify(mediaList.filter((m) => !m.ok).map(({ url, reason }) => ({ url, reason })), null, 1));
  log('Done →', DATA);
}

main().catch((e) => { console.error(e); process.exit(1); });
