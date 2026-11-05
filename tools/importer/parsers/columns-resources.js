/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-resources (feature-panels)
 * Source: #welcome-to-rbc ~ .grid-wpr (three .grid-one-third callouts)
 *
 * One row; one cell per callout panel. Each panel keeps headings, lead text,
 * link lists (consecutive links grouped into a <ul>), a trailing CTA link and
 * a closing image (blocks/columns-resources/columns-resources.js).
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function makeLink(document, a) {
  const link = document.createElement('a');
  link.href = a.getAttribute('href');
  link.textContent = cleanText(a.textContent);
  return link;
}

function buildPanel(document, panel) {
  const out = [];
  const copy = panel.querySelector('.callout-copy') || panel;
  let list = null;

  const flushList = () => {
    if (list && list.children.length) out.push(list);
    list = null;
  };
  const addListLink = (a) => {
    if (!cleanText(a.textContent)) return;
    if (!list) list = document.createElement('ul');
    const li = document.createElement('li');
    li.append(makeLink(document, a));
    list.append(li);
  };

  const walk = (node) => {
    [...node.children].forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        flushList();
        if (!cleanText(el.textContent)) return;
        const h = document.createElement(tag);
        h.textContent = cleanText(el.textContent);
        out.push(h);
      } else if (tag === 'p') {
        flushList();
        if (!cleanText(el.textContent)) return;
        const p = document.createElement('p');
        [...el.cloneNode(true).childNodes].forEach((n) => p.append(n));
        out.push(p);
      } else if (tag === 'ul' || tag === 'ol') {
        flushList();
        el.querySelectorAll(':scope > li').forEach((li) => {
          const a = li.querySelector('a');
          if (a) addListLink(a);
        });
        flushList();
      } else if (tag === 'a') {
        addListLink(el);
      } else {
        walk(el);
      }
    });
  };
  walk(copy);
  flushList();

  // A single trailing-link list (e.g. "Learn More") reads better as a CTA paragraph.
  const last = out[out.length - 1];
  if (last && last.tagName === 'UL' && last.children.length === 1) {
    const p = document.createElement('p');
    p.append(last.querySelector('a'));
    out[out.length - 1] = p;
  }

  // footer CTA outside the copy (e.g. "View all")
  panel.querySelectorAll('.callout-link a').forEach((a) => {
    if (!cleanText(a.textContent)) return;
    const p = document.createElement('p');
    p.append(makeLink(document, a));
    out.push(p);
  });

  // closing image
  panel.querySelectorAll('.callout-img img').forEach((img) => {
    const out2 = document.createElement('img');
    out2.src = img.getAttribute('src');
    out2.alt = img.getAttribute('alt') || '';
    const p = document.createElement('p');
    p.append(out2);
    out.push(p);
  });

  return out;
}

export default function parse(element, { document }) {
  const panels = [...element.querySelectorAll(':scope > .grid-one-third')];
  const row = panels
    .map((col) => buildPanel(document, col.querySelector('.callout') || col))
    .filter((content) => content.length);

  const cells = row.length ? [row] : [];
  const block = WebImporter.Blocks.createBlock(document, {
    name: 'columns-resources',
    variants: ['feature-panels'],
    cells,
  });
  element.replaceWith(block);
}
