/* eslint-disable */
/* global WebImporter */

/**
 * RBC automatic sections transformer — for templates without mapped sections.
 * Every top-level page <section> becomes an EDS section; its background colour
 * becomes a Section Metadata style using the project's section style names.
 * No-op when the template already maps sections (rbc-sections.js handles those).
 */

const MARKER_ATTR = 'data-excat-auto-section';

// Section styles by exact background colour (styles/styles.css defines each one); the colours are the
// section backgrounds measured across the site catalog. A colour within 3 per channel matches.
const PALETTE = [
  ['light-grey', [250, 250, 250]], ['light-grey', [249, 249, 249]], ['light-grey', [248, 248, 248]],
  ['light-blue-grey', [243, 247, 248]], ['light-blue-grey', [244, 248, 249]],
  ['grey', [238, 238, 238]], ['grey', [234, 234, 234]], ['grey', [235, 235, 235]], ['grey', [245, 245, 245]],
  ['cool-grey', [245, 248, 249]],
  ['pale-grey', [243, 244, 245]], ['pale-grey', [241, 246, 249]],
  ['light-blue', [237, 247, 252]], ['light-blue', [247, 252, 255]],
  ['sky', [227, 244, 255]], ['sky', [220, 236, 247]],
  ['mist', [225, 235, 239]], ['mist', [231, 238, 241]],
  ['silver', [196, 200, 204]],
  ['blue', [0, 106, 195]],
  ['navy', [0, 49, 104]],
  ['dark-blue', [0, 89, 157]], ['dark-blue', [46, 81, 161]],
];

function paletteStyle(color) {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.9)) return null;
  const c = [Number(m[1]), Number(m[2]), Number(m[3])];
  let best = null;
  let bestDist = Infinity;
  PALETTE.forEach(([name, p]) => {
    const far = Math.max(...p.map((v, i) => Math.abs(v - c[i])));
    if (far <= 3 && far < bestDist) { best = name; bestDist = far; }
  });
  return best;
}

function styleFor(el) {
  const win = el.ownerDocument.defaultView;
  // the colour is often painted by the section's wrapper rather than the section itself
  let node = el;
  for (let depth = 0; node && depth < 3; depth += 1) {
    const cs = win.getComputedStyle(node);
    const img = cs.backgroundImage || '';
    if (/gradient/.test(img) && /0,49,104|0,30,67|0,81,165/.test(img.replace(/\s+/g, ''))) return 'dark-blue-gradient';
    if (/url\(/.test(img)) return null; // a photo section keeps its block's own image
    const style = paletteStyle(cs.backgroundColor);
    if (style) return style;
    const kids = [...node.children].filter((k) => k.offsetHeight > 0);
    if (kids.length !== 1 || kids[0].offsetHeight < node.offsetHeight * 0.9) break;
    [node] = kids;
  }
  return null;
}

/** 'centered' when the section's lead heading (and so its intro) is centred on the source. */
function alignmentStyle(el) {
  const win = el.ownerDocument.defaultView;
  // only default content counts: a heading inside a block is styled by the block
  const heading = [...el.querySelectorAll('h1, h2')].find((h) => h.offsetHeight > 0 && !h.closest('[data-catalog-block]'));
  if (!heading) return null;
  return win.getComputedStyle(heading).textAlign === 'center' ? 'centered' : null;
}

function pageSections(element) {
  const main = element.querySelector('main') || element;
  const list = [...main.querySelectorAll(':scope > section, :scope > div.banner-container')];
  // disclaimers often sit outside <main>
  element.querySelectorAll('#dvl-wpr > section').forEach((s) => { if (!list.includes(s)) list.push(s); });
  return list.filter((s) => s.textContent.trim() || s.querySelector('img'));
}

export default function transform(hookName, element, payload) {
  const mapped = payload && payload.template && payload.template.sections;
  if (mapped && mapped.length >= 2) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    const sections = pageSections(element);
    if (sections.length < 2) return;
    sections.forEach((el, i) => {
      const style = [styleFor(el), alignmentStyle(el)].filter(Boolean).join(', ') || null;
      if (i === 0 && !style) return;
      const hr = doc.createElement('hr');
      if (style) hr.setAttribute(MARKER_ATTR, style);
      if (i === 0) hr.setAttribute('data-excat-first', '1');
      el.parentNode.insertBefore(hr, el);
    });
  }

  if (hookName === 'afterTransform') {
    element.querySelectorAll(`hr[${MARKER_ATTR}]`).forEach((marker) => {
      const style = marker.getAttribute(MARKER_ATTR);
      const meta = WebImporter.Blocks.createBlock(doc, { name: 'Section Metadata', cells: { style } });
      marker.parentNode.insertBefore(meta, marker.nextSibling);
      if (marker.hasAttribute('data-excat-first')) marker.remove();
      else {
        marker.removeAttribute(MARKER_ATTR);
      }
    });
  }
}
