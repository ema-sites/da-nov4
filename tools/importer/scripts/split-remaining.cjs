/* Split the not-yet-saved catalog URLs into N lists. Usage: node split-remaining.cjs <repoRoot> <n> <log...> */
const fs = require('fs');
const path = require('path');

const [root, n, ...logs] = process.argv.slice(2);
const done = new Set();
for (const lf of logs) {
  if (!fs.existsSync(lf)) continue;
  let cur = null;
  for (const line of fs.readFileSync(lf, 'utf8').split('\n')) {
    const m = line.match(/\] Starting (\S+)/);
    if (m) cur = m[1];
    if (line.includes('Saved content') && cur) done.add(cur);
  }
}
const all = fs.readFileSync(path.join(root, 'tools/importer/urls-catalog.txt'), 'utf8').trim().split('\n');
const rest = all.filter((u) => !done.has(u));
const parts = Array.from({ length: Number(n) }, () => []);
rest.forEach((u, i) => parts[i % parts.length].push(u));
parts.forEach((p, i) => fs.writeFileSync(path.join(root, `tools/importer/urls-catalog-part${i + 1}.txt`), `${p.join('\n')}\n`));
console.log('done', done.size, 'remaining', rest.length, parts.map((p) => p.length).join('/'));
