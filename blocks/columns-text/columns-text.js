import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function textWithoutMedia(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture, img').forEach((el) => el.remove());
  return clone.textContent.trim();
}

/**
 * An icon followed only by a single link (quick links row) renders as one
 * clickable icon + label link, with the icon moved inside the anchor.
 */
function decorateIconLink(cell, icon) {
  const rest = [...cell.children].filter((el) => el !== icon);
  if (rest.length !== 1) return;
  const links = rest[0].querySelectorAll('a');
  if (links.length !== 1 || rest[0].textContent.trim() !== links[0].textContent.trim()) return;
  const link = links[0];
  const picture = icon.querySelector('picture') || icon;
  const label = document.createElement('span');
  label.append(...link.childNodes);
  link.replaceChildren(picture, label);
  link.classList.remove('button');
  link.classList.add('columns-text-icon-link');
  rest[0].classList.remove('button-wrapper', 'button-container');
  if (icon !== picture) icon.remove();
  cell.classList.add('columns-text-link-col');
}

function decorateCell(cell) {
  const hasPicture = !!cell.querySelector('picture, img');
  if (hasPicture && !textWithoutMedia(cell)) {
    cell.classList.add('columns-text-img-col');
    return;
  }
  cell.classList.add('columns-text-col');
  // a picture leading other content is the column's icon
  const first = cell.firstElementChild;
  if (first && (first.tagName === 'PICTURE' || (first.tagName === 'P' && first.querySelector('picture')
    && !first.textContent.trim()))) {
    first.classList.add('columns-text-icon');
    cell.classList.add('columns-text-has-icon');
    decorateIconLink(cell, first);
  }
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  rows.forEach((row) => {
    row.classList.add('columns-text-row');
    [...row.children].forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, select, input')) {
        // keep the empty slot so columns line up, but mark it
        cell.classList.add('columns-text-empty');
        return;
      }
      decorateCell(cell);
    });
  });

  const cols = Math.max(...rows.map((row) => row.children.length));
  block.classList.add(`columns-text-${cols}-cols`);
  block.style.setProperty('--columns-text-count', cols);

  const filled = block.querySelectorAll('.columns-text-col, .columns-text-img-col');
  if (filled.length && [...filled].every((cell) => cell.classList.contains('columns-text-link-col'))) {
    block.classList.add('columns-text-links');
  }

  optimizeImages(block);
}
