/* Point links in the migrated content at the migrated pages (run after every import).
   - Same-site links to a migrated page (directly, or through one of RBC's redirects) become its EDS
     path: /credit-cards/travel.html#legal-1 → /credit-cards/travel#legal-1, /business/index.html → /business/
   - Same-site links to anything not migrated (PDFs, the My Money Matters blog, tools, pages that are
     404 on RBC) become absolute https://www.rbcroyalbank.com URLs, so they never 404 on the new site.
   Redirects are looked up on the live site once and cached in migration-work/link-resolve-cache.json.
   - Root-relative media: /media-da/ images become page-relative; other files (videos, captions) the origin.
   Also writes migration-work/redirects.json (old RBC path → migrated path) for the redirects sheet.
   Usage: node tools/importer/scripts/rewrite-links.cjs <repoRoot> [--dry] */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const dry = process.argv.includes('--dry');
const HOST = 'https://www.rbcroyalbank.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const content = fs.realpathSync(path.join(root, 'content'));
const cacheFile = path.join(root, 'migration-work/link-resolve-cache.json');

const key = (u) => {
  const x = new URL(u);
  // case-insensitive: RBC serves /buying-a-boat-or-RV.html and links to it in either case
  return `${x.pathname.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/index\.html?$/, '/').replace(/\.html?$/, '').replace(/\/$/, '') || '/'}`;
};

// migrated pages: report url → content path
const pageOf = new Map();
const sourcePaths = new Map(); // key → the page's original RBC pathname
const edsPath = (p) => {
  if (p === 'index') return '/';
  if (p.endsWith('/index')) return `/${p.slice(0, -'index'.length)}`;
  return `/${p}`;
};
const reports = path.join(root, 'tools/importer/reports');
const walkReports = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) { walkReports(p); return; }
  if (!e.name.endsWith('.report.json')) return;
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (r.status !== 'success' || !r.url || !r.path) return;
  if (!fs.existsSync(path.join(content, `${r.path}.plain.html`))) return;
  pageOf.set(key(r.url), edsPath(r.path));
  sourcePaths.set(key(r.url), new URL(r.url).pathname);
});
walkReports(reports);

const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

async function resolve(u) {
  let cur = u;
  for (let hop = 0; hop < 8; hop += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': UA } });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) cur = new URL(loc, cur).href;
    else return { status: res.status, final: cur };
  }
  return { status: 'loop', final: cur };
}

const SKIP = /^(mailto:|tel:|javascript:|#|data:)/i;
function sameSite(href) {
  if (SKIP.test(href)) return null;
  if (href.startsWith('//')) return null;
  if (href.startsWith('/')) return new URL(href, HOST);
  if (/^https?:\/\/www\.rbcroyalbank\.com(\/|$)/i.test(href)) return new URL(href.replace(/^http:/i, 'https:'));
  return null;
}

const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) walk(p);
  else if (e.name.endsWith('.plain.html')) files.push(p);
});
walk(content);

(async () => {
  // look up redirects for same-site links that don't name a migrated page directly
  const todo = new Set();
  files.forEach((f) => {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/href="([^"]+)"/g)) {
      const u = sameSite(m[1].replace(/&amp;/g, '&'));
      if (!u) continue;
      const k = key(u.href);
      const probe = `${HOST}${u.pathname}`;
      if (!pageOf.has(k) && !cache[probe] && !/\.(pdf|jpe?g|png|gif|svg|zip|mp4|docx?|xlsx?)$/i.test(u.pathname)) todo.add(probe);
    }
  });
  const list = [...todo];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < list.length) {
      const u = list[i];
      i += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        cache[u] = await resolve(u);
      } catch (e) {
        cache[u] = { status: 'error', final: u };
      }
    }
  }));
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));

  const target = (u) => {
    const k = key(u.href);
    if (pageOf.has(k)) return pageOf.get(k);
    const c = cache[`${HOST}${u.pathname}`];
    if (c && c.status === 200 && /^https:\/\/www\.rbcroyalbank\.com\//.test(c.final)) {
      const fk = key(c.final);
      if (pageOf.has(fk)) return pageOf.get(fk);
    }
    return null;
  };

  const stats = { files: 0, changed: 0, toPage: 0, toOrigin: 0 };
  const redirects = new Map();
  files.forEach((f) => {
    stats.files += 1;
    const html = fs.readFileSync(f, 'utf8');
    const out = html.replace(/href="([^"]+)"/g, (whole, raw) => {
      const u = sameSite(raw.replace(/&amp;/g, '&'));
      if (!u) return whole;
      const t = target(u);
      let next;
      if (t) {
        next = `${t}${u.hash}`;
        stats.toPage += 1;
        if (u.pathname !== t) redirects.set(u.pathname, t);
      } else {
        next = `${HOST}${u.pathname}${u.search}${u.hash}`;
        stats.toOrigin += 1;
      }
      return `href="${next.replace(/&/g, '&amp;')}"`;
    });
    // media: local /media-da/ images become page-relative (DA resolves relative paths, not root ones);
    // other root-relative media (videos, captions) live on the origin
    const depth = path.relative(content, f).split(path.sep).length - 1;
    const finalOut = out.replace(/src="(\/[^"]+)"/g, (whole, src) => {
      if (src.startsWith('//')) return whole;
      if (src.startsWith('/media-da/')) return `src="${'../'.repeat(depth)}${src.slice(1)}"`;
      return `src="${HOST}${src}"`;
    });
    if (finalOut !== html) {
      stats.changed += 1;
      if (!dry) fs.writeFileSync(f, finalOut);
    }
  });
  // every migrated page's original address (e.g. /credit-cards/travel.html) redirects to its new path
  sourcePaths.forEach((src, k) => {
    const t = pageOf.get(k);
    if (src !== t && src.replace(/\/$/, '') !== t.replace(/\/$/, '')) redirects.set(src, t);
  });
  // RBC's own redirects that land on a migrated page (/bank-accounts/advantage-banking.html → …/chequing-accounts/…)
  Object.entries(cache).forEach(([src, c]) => {
    if (c.status !== 200 || !/^https:\/\/www\.rbcroyalbank\.com\//.test(c.final)) return;
    const t = pageOf.get(key(c.final));
    const p = new URL(src).pathname;
    if (t && !pageOf.has(key(src)) && p !== t) redirects.set(p, t);
  });
  const rows = [...redirects].filter(([s, d]) => s !== d && s !== '/').sort().map(([Source, Destination]) => ({ Source, Destination }));
  fs.writeFileSync(path.join(root, 'migration-work/redirects.json'), JSON.stringify(rows, null, 1));
  console.log(JSON.stringify({ ...stats, migratedPages: pageOf.size, lookedUp: list.length, redirects: rows.length, dry }));
})();
