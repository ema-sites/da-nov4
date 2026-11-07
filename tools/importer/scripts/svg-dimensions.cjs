/* Give SVG <img> tags in content/ the width/height EDS derives from the file (its width/height
   attributes, else its viewBox), so the local preview sizes icons like aem.page does. Run after
   every import (after rewrite-links.cjs). Each SVG is fetched once; sizes are cached in
   migration-work/svg-dims-cache.json. Usage: node tools/importer/scripts/svg-dimensions.cjs <repoRoot> */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const content = fs.realpathSync(path.join(root, 'content'));
const cacheFile = path.join(root, 'migration-work/svg-dims-cache.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.plain.html')) files.push(p);
});
walk(content);

const IMG_RE = /<img\b[^>]*>/g;
const srcOf = (tag) => (tag.match(/\ssrc="([^"]+)"/) || [])[1];
const isSvg = (src) => /\.svg(\?|$)/i.test(src || '');

function dims(svg) {
  const open = (svg.match(/<svg\b[^>]*>/i) || [''])[0];
  const num = (name) => {
    const m = open.match(new RegExp(`\\s${name}="\\s*([\\d.]+)(px)?\\s*"`, 'i'));
    return m ? Math.round(Number(m[1])) : null;
  };
  let w = num('width');
  let h = num('height');
  const vb = open.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i);
  if ((!w || !h) && vb) {
    const vw = Number(vb[1]);
    const vh = Number(vb[2]);
    if (w && !h) h = Math.round((w * vh) / vw);
    else if (h && !w) w = Math.round((h * vw) / vh);
    else { w = Math.round(vw); h = Math.round(vh); }
  }
  return w && h ? { w, h } : null;
}

(async () => {
  const todo = new Set();
  files.forEach((f) => {
    for (const tag of fs.readFileSync(f, 'utf8').match(IMG_RE) || []) {
      const src = srcOf(tag);
      if (isSvg(src) && /^https?:/.test(src) && !(src in cache)) todo.add(src);
    }
  });
  const list = [...todo];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < list.length) {
      const src = list[i];
      i += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(src.replace(/&amp;/g, '&'), { headers: { 'user-agent': UA } });
        // eslint-disable-next-line no-await-in-loop
        cache[src] = res.ok ? dims(await res.text()) : null;
      } catch (e) {
        cache[src] = null;
      }
    }
  }));
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));

  let changed = 0;
  let sized = 0;
  files.forEach((f) => {
    const html = fs.readFileSync(f, 'utf8');
    const out = html.replace(IMG_RE, (tag) => {
      const src = srcOf(tag);
      const d = cache[src];
      if (!isSvg(src) || !d || /\swidth="/.test(tag)) return tag;
      sized += 1;
      return tag.replace(/<img\b/, `<img width="${d.w}" height="${d.h}"`);
    });
    if (out !== html) { changed += 1; fs.writeFileSync(f, out); }
  });
  console.log(JSON.stringify({ files: files.length, fetched: list.length, sized, changed }));
})();
