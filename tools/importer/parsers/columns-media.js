/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-media (banner)
 * Source: .bank-with-rbc-mobile
 *
 * One row, 2 cells: media (phone mockup picture) | text (H2, intro,
 * "Already a client?" line, App Store / Google Play badge links, SMS note,
 * app rating with logo/star). The decorative section background image is
 * not authored content and is skipped.
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

/** Clone inline content: drop sr-only text, fix javascript: footnote links. */
function inlineClone(document, src, tag) {
  const out = document.createElement(tag);
  const copy = src.cloneNode(true);
  copy.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
  copy.querySelectorAll('a[href^="javascript:"]').forEach((a) => {
    const num = cleanText(a.textContent);
    if (a.closest('sup') && /^\d+$/.test(num)) a.setAttribute('href', `#legal-${num}`);
    else a.replaceWith(...a.childNodes);
  });
  copy.querySelectorAll('img').forEach((img) => img.replaceWith(cloneImg(document, img)));
  [...copy.childNodes].forEach((n) => out.append(n));
  return out;
}

export default function parse(element, { document }) {
  const media = [];
  const phone = element.querySelector('img.app-mobile-image')
    || element.querySelector('.flex > img');
  if (phone) media.push(cloneImg(document, phone));

  const text = [];
  const content = element.querySelector('.mobile-app-content') || element;

  const heading = content.querySelector('h1, h2, h3');
  if (heading) text.push(inlineClone(document, heading, heading.tagName.toLowerCase()));

  // paragraphs in document order (intro, client line, badges, sms note)
  content.querySelectorAll('p').forEach((p) => {
    if (p.closest('.rating-container')) return;
    if (!cleanText(p.textContent) && !p.querySelector('img')) return;
    text.push(inlineClone(document, p, 'p'));
  });

  // app rating
  const rating = content.querySelector('.rating-container');
  if (rating) {
    const logo = rating.querySelector('.rating-rbc-logo');
    if (logo) {
      const p = document.createElement('p');
      p.append(cloneImg(document, logo));
      text.push(p);
    }
    const score = rating.querySelector('.rating-score');
    if (score) {
      const p = inlineClone(document, score, 'p');
      const star = rating.querySelector('.rating-star');
      if (star) p.prepend(cloneImg(document, star), ' ');
      text.push(p);
    }
    const counts = rating.querySelector('.rating-counts');
    if (counts && cleanText(counts.textContent)) text.push(inlineClone(document, counts, 'p'));
  }

  const cells = [[media.length ? media : '', text]];
  const block = WebImporter.Blocks.createBlock(document, {
    name: 'columns-media',
    variants: ['banner'],
    cells,
  });
  element.replaceWith(block);
}
