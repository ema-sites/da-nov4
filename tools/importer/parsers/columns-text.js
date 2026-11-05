/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-text
 * Source: .help-section ul.col-wpr (four quick-tool icon links)
 *
 * One row, one cell per <li>: icon picture paragraph (leading picture-only
 * paragraph becomes the column icon) + link paragraph.
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  const row = [];
  element.querySelectorAll(':scope > li').forEach((li) => {
    const content = [];
    const srcLink = li.querySelector('a[href]');
    const srcImg = li.querySelector('img');

    if (srcImg) {
      const p = document.createElement('p');
      const img = document.createElement('img');
      img.src = srcImg.getAttribute('src');
      img.alt = srcImg.getAttribute('alt') || '';
      p.append(img);
      content.push(p);
    }

    const label = cleanText(srcLink ? srcLink.textContent : li.textContent);
    if (label) {
      const p = document.createElement('p');
      if (srcLink) {
        const a = document.createElement('a');
        a.href = srcLink.getAttribute('href');
        a.textContent = label;
        p.append(a);
      } else {
        p.textContent = label;
      }
      content.push(p);
    }

    if (content.length) row.push(content);
  });

  const cells = row.length ? [row] : [];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-text', cells });
  element.replaceWith(block);
}
