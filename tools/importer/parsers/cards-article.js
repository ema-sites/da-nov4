/* eslint-disable */
/* global WebImporter */

/**
 * Parser: cards-article (image-top)
 * Source: .discover-and-learn-section .grid-wpr.eh-wpr
 *
 * One row per article teaser, 2 cells: article photo | body (H3 title linked
 * to the article). Each source teaser is one <a> wrapping the whole card; the
 * link is rebuilt on the visible title. The photo's alt text lives on the
 * wrapping div.callout-img in the source, so it is lifted onto the <img>.
 * The duplicate (mobile) image inside .callout-copy is skipped.
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  const cells = [];
  const items = [...element.querySelectorAll(':scope > .grid-one-third')];

  items.forEach((item) => {
    const link = item.querySelector('a[href]');
    const href = link ? link.getAttribute('href') : '';

    const imgWrap = item.querySelector('.callout > .callout-img') || item.querySelector('.callout-img');
    const srcImg = imgWrap ? imgWrap.querySelector('img') : item.querySelector('img');
    let imageCell = '';
    if (srcImg) {
      const img = document.createElement('img');
      img.src = srcImg.getAttribute('src');
      img.alt = srcImg.getAttribute('alt') || (imgWrap && imgWrap.getAttribute('alt')) || '';
      imageCell = [img];
    }

    const titleEl = item.querySelector('.callout-copy .h4, .callout-copy h1, .callout-copy h2, .callout-copy h3, .callout-copy h4, .callout-copy span');
    const title = cleanText(titleEl ? titleEl.textContent : (link && link.textContent));
    const body = [];
    if (title) {
      const h3 = document.createElement('h3');
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = title;
        h3.append(a);
      } else {
        h3.textContent = title;
      }
      body.push(h3);
    }

    if (!body.length && !srcImg) return;
    cells.push([imageCell, body]);
  });

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'cards-article',
    variants: ['image-top'],
    cells,
  });
  element.replaceWith(block);
}
