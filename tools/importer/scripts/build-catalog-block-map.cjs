/* Build tools/importer/catalog-block-map.json (per-page block instances for import-catalog.js) from the
   site catalog: each page's catalog/.pages/<slug>/page-catalog.json blocks, named by block-catalog.json.
   Pages in the "homepage" template are left out (they have their own import script).
   --keep <map.json>: pages already in that map keep their entries (they are imported and styled; a
   later rollup can regroup their blocks). Blocks with no parser yet are left out (imported as text).
   Usage: node tools/importer/scripts/build-catalog-block-map.cjs <repoRoot> [--check] [--keep <map.json>] */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const check = process.argv.includes('--check');
const catalog = path.join(root, 'catalog');
const out = path.join(root, 'tools/importer/catalog-block-map.json');
const keepArg = process.argv.indexOf('--keep');
const kept = keepArg > 0 ? JSON.parse(fs.readFileSync(process.argv[keepArg + 1], 'utf8')).pages : {};
const parsers = new Set(fs.readdirSync(path.join(root, 'tools/importer/parsers')).map((f) => f.replace(/\.js$/, '')));
const noParser = {};

const variants = JSON.parse(fs.readFileSync(path.join(catalog, 'block-catalog.json'), 'utf8'))['block-catalog'].blockVariants;
const templates = JSON.parse(fs.readFileSync(path.join(catalog, 'template-catalog.json'), 'utf8')).templates;

const checklist = JSON.parse(fs.readFileSync(path.join(catalog, 'urls-checklist.json'), 'utf8'))['analysis-urls-checklist'].pages;

const templateOf = {};
templates.forEach((t) => t.urls.forEach((u) => { templateOf[u] = t.name; }));

const pages = {};
let unknown = 0;
fs.readdirSync(path.join(catalog, '.pages')).forEach((slug) => {
  const file = path.join(catalog, '.pages', slug, 'page-catalog.json');
  if (!fs.existsSync(file)) return;
  const pc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!pc.url || templateOf[pc.url] === 'homepage') return;
  if (checklist[pc.url]?.status !== 'analyzed') return;
  if (kept[pc.url]) { pages[pc.url] = kept[pc.url]; return; }
  const list = [];
  (pc.blocks || []).forEach((b) => {
    const v = variants[b.variantId];
    if (!v) { unknown += 1; return; }
    if (v.type === 'default-content' || v.type === 'unknown') return;
    if (!parsers.has(v.name)) { noParser[v.name] = (noParser[v.name] || 0) + 1; return; }
    list.push({ block: v.name, variant: v.variant || null, selector: b.selector, variantId: b.variantId });
  });
  pages[pc.url] = list;
});

const map = { generatedFrom: 'catalog/.pages/*/page-catalog.json + catalog/block-catalog.json', templateOf, pages };

if (check) {
  const old = JSON.parse(fs.readFileSync(out, 'utf8'));
  const same = Object.keys(old.pages).filter((u) => JSON.stringify(old.pages[u]) === JSON.stringify(pages[u]));
  console.log('existing pages', Object.keys(old.pages).length, 'identical', same.length, 'new pages', Object.keys(pages).filter((u) => !old.pages[u]).length);
  Object.keys(old.pages).filter((u) => !same.includes(u)).slice(0, 3).forEach((u) => {
    console.log('DIFF', u, '\n old', JSON.stringify(old.pages[u]).slice(0, 300), '\n new', JSON.stringify(pages[u] || null).slice(0, 300));
  });
} else {
  fs.writeFileSync(out, JSON.stringify(map, null, 2));
  console.log('wrote', Object.keys(pages).length, 'pages; page-text blocks skipped:', unknown, '; no parser yet:', JSON.stringify(noParser));
}
