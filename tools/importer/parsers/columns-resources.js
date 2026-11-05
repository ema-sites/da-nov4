/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-resources (feature-panels)
 * Source: #welcome-to-rbc ~ .grid-wpr (three .grid-one-third callouts)
 *
 * One row; one cell per callout panel. Each panel keeps headings, lead text,
 * link lists (consecutive links grouped into a <ul>), a trailing CTA link and
 * a closing image (blocks/columns-resources/columns-resources.js).
 * Icon-list items (ul.icon-list > li > h3 > a.icon-list-*) become
 * <li><img icon><h3><a/></h3></li>: the 40x40 ::before icon as a real image
 * (block tags such lists columns-resources-icon-list) and the h3 kept.
 * SVG icon URLs get a "#icon" fragment so html2md keeps them as images.
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

// Product-link icons are CSS ::before backgrounds on a.icon-list-* (see source CSS).
// Fallback map for DOMs without computed styles (e.g. cached HTML / jsdom).
const ICON_BASE = 'https://www.rbcroyalbank.com';
const ICON_MAP = {
  l_account: '/_assets-custom/homepage/images/cash-new-40.svg',
  l_mortgage: '/dvl/v0.1/assets/images/icons/icon-mortgages.svg',
  l_loan: '/dvl/v0.1/assets/images/icons/icon-loans.svg',
  l_loan2: '/dvl/v0.1/assets/images/icons/icon-loans.svg',
  l_investing: '/dvl/v0.1/assets/images/icons/icon-investments.svg',
  l_credit: '/dvl/v0.1/assets/images/icons/icon-credit-cards.svg',
  'l_credit-card': '/dvl/v0.1/assets/images/icons/icon-credit-cards.svg',
};

function iconUrl(document, li, a) {
  // 1. live page: computed ::before background-image
  try {
    const win = document.defaultView;
    if (win && win.getComputedStyle) {
      const bi = win.getComputedStyle(a, '::before').backgroundImage || '';
      const m = bi.match(/url\(["']?([^"')]+)["']?\)/);
      if (m && m[1]) return new URL(m[1], document.baseURI || ICON_BASE).href;
    }
  } catch (e) { /* no computed styles */ }
  // 2. known icon classes (a.icon-list-<key>, li#<key>)
  const cls = [...a.classList].find((c) => c.startsWith('icon-list-'));
  const key = cls ? cls.slice('icon-list-'.length) : '';
  const path = ICON_MAP[key] || ICON_MAP[li.id];
  return path ? `${ICON_BASE}${path}` : '';
}

function buildPanel(document, panel) {
  const out = [];
  const copy = panel.querySelector('.callout-copy') || panel;
  let list = null;

  const flushList = () => {
    if (list && list.children.length) out.push(list);
    list = null;
  };
  const addListLink = (a, srcLi) => {
    if (!cleanText(a.textContent)) return;
    if (!list) list = document.createElement('ul');
    const li = document.createElement('li');
    // icon list item (ul.icon-list > li > h3 > a.icon-list-*): icon <img> + heading link
    const src = srcLi && srcLi.closest('ul.icon-list') ? iconUrl(document, srcLi, a) : '';
    if (src) {
      const img = document.createElement('img');
      // html2md turns any <img src="*.svg"> into a :name: icon shorthand (needs /icons/*.svg);
      // a fragment keeps it a real image without changing the fetched resource.
      img.src = /\.svg$/i.test(src) ? `${src}#icon` : src;
      img.alt = '';
      li.append(img);
    }
    const heading = srcLi && srcLi.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
    if (heading && heading.contains(a)) {
      const h = document.createElement(heading.tagName.toLowerCase());
      h.append(makeLink(document, a));
      li.append(h);
    } else {
      li.append(makeLink(document, a));
    }
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
          if (a) addListLink(a, li);
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
