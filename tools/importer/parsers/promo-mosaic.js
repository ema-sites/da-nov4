/* eslint-disable */
/* global WebImporter */

/**
 * Parser: promo-mosaic
 * Source: #bento-section .bento-box (desktop bento grid; the mobile glider
 * duplicate is removed by rbc-cleanup).
 *
 * Block rows (one per tile), 2 cells each: image-only cell | content cell.
 * First row is the feature tile (blocks/promo-mosaic/promo-mosaic.js).
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/** Clone inline content, dropping screen-reader-only text. */
function inlineClone(document, src, tag) {
  const out = document.createElement(tag);
  const copy = src.cloneNode(true);
  copy.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
  [...copy.childNodes].forEach((n) => out.append(n));
  return out;
}

export default function parse(element, { document }) {
  const cells = [];
  const tiles = [...element.querySelectorAll(':scope > .bento-cell')];

  tiles.forEach((tile) => {
    const img = tile.querySelector('img');
    let imageCell = '';
    if (img) {
      const out = document.createElement('img');
      out.src = img.getAttribute('src');
      out.alt = img.getAttribute('alt') || '';
      imageCell = [out];
    }

    const content = [];
    tile.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach((el) => {
      if (!cleanText(el.textContent)) return;
      content.push(inlineClone(document, el, el.tagName.toLowerCase()));
    });
    // standalone CTAs that are not inside a paragraph/heading
    tile.querySelectorAll('a').forEach((a) => {
      if (a.closest('p, h1, h2, h3, h4, h5, h6')) return;
      if (!cleanText(a.textContent)) return;
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = cleanText(a.textContent);
      p.append(link);
      content.push(p);
    });

    if (!content.length && !img) return;
    cells.push([imageCell, content]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'promo-mosaic', cells });
  element.replaceWith(block);
}
