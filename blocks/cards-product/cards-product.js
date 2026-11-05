import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADER_STRIP_OPTIONS = ['header-strip', 'header-strip-blue-grey'];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

const hasOption = (block, list) => list.some((o) => block.classList.contains(o));

/* A short heading-less cell before the main body is the coloured card strip/label. */
function isStripCell(cell, bodyCount) {
  if (bodyCount < 2) return false;
  if (cell.querySelector('h1, h2, h3, h4, h5, h6, ul, ol')) return false;
  const text = cell.textContent.trim();
  return text.length > 0 && text.length <= 40;
}

export default function decorate(block) {
  const stripEnabled = hasOption(block, HEADER_STRIP_OPTIONS);
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    const li = document.createElement('li');
    const isImage = (c) => !c.textContent.trim() && !!c.querySelector('picture, img');
    const bodyCount = cells.filter((c) => !isImage(c)).length;
    let stripUsed = false;

    cells.forEach((cell) => {
      const div = document.createElement('div');
      if (isImage(cell)) {
        div.className = 'cards-product-card-image';
      } else if (stripEnabled && !stripUsed && isStripCell(cell, bodyCount)) {
        div.className = 'cards-product-card-strip';
        stripUsed = true;
      } else {
        div.className = 'cards-product-card-body';
      }
      div.append(...cell.childNodes);
      li.append(div);
    });

    if (!li.querySelector('.cards-product-card-image')) li.classList.add('cards-product-card-no-image');
    // a card with a single destination becomes fully clickable
    const links = li.querySelectorAll('.cards-product-card-body a');
    if (links.length === 1) li.classList.add('cards-product-card-linked');
    ul.append(li);
  });

  if (block.classList.contains('featured') && ul.children.length > 1) {
    ul.firstElementChild.classList.add('cards-product-card-featured');
  }
  if (ul.children.length === 1) block.classList.add('cards-product-single');

  optimizeImages(ul);
  block.replaceChildren(ul);
}
