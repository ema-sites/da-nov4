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

  optimizeImages(block);
}
