/* Upload migrated pages from content/ to Document Authoring and preview them on EDS (never publishes).
   Each content/<path>.plain.html is wrapped as <body><header></header><main>…</main><footer></footer></body>
   and POSTed to https://admin.da.live/source/<org>/<repo>/<path>.html, then previewed with
   POST https://admin.hlx.page/preview/<org>/<site>/main/<path>. content/redirects.json goes up as a sheet.
   Skips shared-media/* fragments. Resumable: a page whose content hash was already uploaded and
   previewed is skipped. Credentials are injected by the environment; no token is used here.
   Usage: node tools/importer/scripts/da-upload.cjs <repoRoot> [--only <list.txt of content paths>] [--no-preview] */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.argv[2];
const onlyArg = process.argv.indexOf('--only');
const noPreview = process.argv.includes('--no-preview');
const ORG = 'ema-sites';
const REPO = 'da-nov4';
const content = fs.realpathSync(path.join(root, 'content'));
const logFile = path.join(root, 'migration-work/da-upload/upload-state.json');
fs.mkdirSync(path.dirname(logFile), { recursive: true });
const state = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
const save = () => fs.writeFileSync(logFile, JSON.stringify(state, null, 1));

let items = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'shared-media' && e.name !== 'media-da' && e.name !== 'images') walk(p); return; }
  if (e.name.endsWith('.plain.html')) items.push(path.relative(content, p).replace(/\.plain\.html$/, ''));
});
walk(content);
if (fs.existsSync(path.join(content, 'redirects.json'))) items.push('redirects.json');
if (onlyArg > 0) {
  const only = new Set(fs.readFileSync(process.argv[onlyArg + 1], 'utf8').trim().split('\n'));
  items = items.filter((i) => only.has(i));
}

async function post(url, body, type) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      let res;
      if (body) {
        const form = new FormData();
        form.append('data', new Blob([body], { type }), type === 'application/json' ? 'data.json' : 'data.html');
        // eslint-disable-next-line no-await-in-loop
        res = await fetch(url, { method: 'POST', body: form });
      } else {
        // eslint-disable-next-line no-await-in-loop
        res = await fetch(url, { method: 'POST' });
      }
      if (res.status === 429 || res.status >= 500) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => { setTimeout(r, 2000 * (attempt + 1)); });
      } else {
        return res.status;
      }
    } catch (e) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 2000 * (attempt + 1)); });
    }
  }
  return 'error';
}

(async () => {
  const stats = { total: items.length, skipped: 0, uploaded: 0, previewed: 0, failed: [] };
  let i = 0;
  let authFail = false;
  const worker = async () => {
    while (i < items.length && !authFail) {
      const item = items[i];
      i += 1;
      const isSheet = item === 'redirects.json';
      const raw = fs.readFileSync(path.join(content, isSheet ? item : `${item}.plain.html`), 'utf8');
      const body = isSheet ? raw : `<body><header></header><main>${raw}</main><footer></footer></body>`;
      const hash = crypto.createHash('sha1').update(body).digest('hex');
      const prev = state[item];
      if (prev && prev.hash === hash && prev.upload === 200 && (noPreview || prev.preview === 200)) { stats.skipped += 1; continue; }
      // local images (relative src such as media-da/x.png) go up next to the page first
      if (!isSheet) {
        for (const m of raw.matchAll(/src="([^"]+)"/g)) {
          const src = m[1];
          if (/^(https?:|data:|\/\/)/.test(src)) continue;
          const file = path.normalize(path.join(content, path.dirname(item), src.split('?')[0]));
          const rel = path.relative(content, file);
          if (rel.startsWith('..') || !fs.existsSync(file) || state[`asset:${rel}`] === 200) continue;
          const ext = path.extname(file).slice(1).toLowerCase();
          const type = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
          // eslint-disable-next-line no-await-in-loop
          const a = await post(`https://admin.da.live/source/${ORG}/${REPO}/${rel}`, fs.readFileSync(file), type);
          state[`asset:${rel}`] = a === 201 ? 200 : a;
        }
      }
      const daPath = isSheet ? item : `${item}.html`;
      // eslint-disable-next-line no-await-in-loop
      const up = await post(`https://admin.da.live/source/${ORG}/${REPO}/${daPath}`, body, isSheet ? 'application/json' : 'text/html');
      if (up === 401 || up === 403) { authFail = true; stats.failed.push({ item, up }); break; }
      let pv = null;
      if (up === 200 || up === 201) {
        stats.uploaded += 1;
        if (!noPreview) {
          const webPath = isSheet ? 'redirects.json' : item;
          // eslint-disable-next-line no-await-in-loop
          pv = await post(`https://admin.hlx.page/preview/${ORG}/${REPO}/main/${webPath}`);
          if (pv === 200) stats.previewed += 1;
        }
      }
      state[item] = { hash, upload: up === 201 ? 200 : up, preview: pv, at: new Date().toISOString() };
      if (!(up === 200 || up === 201) || (!noPreview && pv !== 200)) stats.failed.push({ item, up, pv });
      if ((stats.uploaded + stats.failed.length) % 25 === 0) { save(); console.log(JSON.stringify({ done: i, uploaded: stats.uploaded, previewed: stats.previewed, failed: stats.failed.length })); }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  save();
  console.log(JSON.stringify({ ...stats, failed: stats.failed.slice(0, 20), failedCount: stats.failed.length, authFail }));
})();
