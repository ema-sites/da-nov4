/* Remove leftovers of the source's hidden UI from imported content (run after every import, with
   rewrite-links.cjs and svg-dimensions.cjs):
   - paragraphs that only hold widget chrome: "open iframe", "Previous columnNext column",
     "Carousel scrollbar", "[an error occurred while processing this directive]"
   - doubled toggle labels: "View Legal DisclaimersHide Legal Disclaimers" → "View Legal Disclaimers",
     "View Afficher l’avis…" → "Afficher l’avis…"
   - screen-reader prefixes inside footnote markers: <sup>legal disclaimer1</sup> → <sup>1</sup>
   - javascript: links (dead on the new site) become their text
   Usage: node tools/importer/scripts/content-cleanup.cjs <repoRoot> */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const content = fs.realpathSync(path.join(root, 'content'));
const JUNK = ['open iframe', 'Previous columnNext column', 'Carousel scrollbar', '[an error occurred while processing this directive]'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const JUNK_P = new RegExp(`<p>(?:<strong>)?(?:${JUNK.map(esc).join('|')})(?:</strong>)?</p>`, 'g');

const rules = [
  [JUNK_P, ''],
  [/View Legal DisclaimersHide Legal Disclaimers/g, 'View Legal Disclaimers'],
  [/Afficher les avis juridiquesMasquer les avis juridiques/g, 'Afficher les avis juridiques'],
  [/>View (Afficher|Voir) /g, '>$1 '],
  [/(<sup>)\s*(?:legal disclaimer|avis de non-responsabilit[ée]|d[ée]ni de responsabilit[ée])\s*/gi, '$1'],
  [/<a href="javascript:[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1'],
];

const stats = { files: 0, changed: 0 };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { walk(p); return; }
  if (!e.name.endsWith('.plain.html')) return;
  stats.files += 1;
  const html = fs.readFileSync(p, 'utf8');
  let out = html;
  rules.forEach(([re, to]) => { out = out.replace(re, to); });
  if (out !== html) { stats.changed += 1; fs.writeFileSync(p, out); }
});
walk(content);
console.log(JSON.stringify(stats));
