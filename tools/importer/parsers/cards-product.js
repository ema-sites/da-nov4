/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-product (image)
 * Source: .awards-and-recognition-section .award-tiles
 *
 * One row per award tile, 2 cells: award logo picture | body
 * (optional ribbon eyebrow, H3 title, byline, description with optional link).
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function cloneImg(document, img) {
  const out = document.createElement('img');
  out.src = img.getAttribute('src');
  out.alt = img.getAttribute('alt') || '';
  return out;
}

export default function parse(element, { document }) {
  const cells = [];
  const tiles = [...element.querySelectorAll(':scope > .award-tile')];

  tiles.forEach((tile) => {
    const logo = tile.querySelector('img.award-icon');
    const imageCell = logo ? [cloneImg(document, logo)] : '';

    const body = [];
    const ribbon = tile.querySelector('.award-ribbon');
    if (ribbon && cleanText(ribbon.textContent)) {
      const p = document.createElement('p');
      const em = document.createElement('em');
      em.textContent = cleanText(ribbon.textContent);
      p.append(em);
      body.push(p);
    }

    const content = tile.querySelector('.award-content') || tile;
    content.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach((el) => {
      if (!cleanText(el.textContent)) return;
      const out = document.createElement(el.tagName.toLowerCase());
      [...el.cloneNode(true).childNodes].forEach((n) => out.append(n));
      body.push(out);
    });

    if (!body.length && !logo) return;
    cells.push([imageCell, body]);
  });

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'cards-product',
    variants: ['image'],
    cells,
  });
  element.replaceWith(block);
}
