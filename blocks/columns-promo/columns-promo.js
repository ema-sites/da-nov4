import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isImageCell(cell) {
  if (!cell.querySelector('picture, img')) return false;
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture, img').forEach((el) => el.remove());
  return clone.textContent.trim().length === 0;
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  rows.forEach((row) => {
    row.classList.add('columns-promo-row');
    [...row.children].forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, iframe, form')) {
        cell.remove();
        return;
      }
      cell.classList.add(isImageCell(cell) ? 'columns-promo-image' : 'columns-promo-content');
    });

    // side-box: the last content cell is a separate box beside the main promo
    if (block.classList.contains('side-box')) {
      const cells = [...row.children];
      if (cells.length > 1) {
        const side = cells[cells.length - 1];
        side.classList.remove('columns-promo-content');
        side.classList.add('columns-promo-side');
        const main = document.createElement('div');
        main.className = 'columns-promo-main';
        cells.slice(0, -1).forEach((c) => main.append(c));
        row.prepend(main);
      }
    }

    const image = row.querySelector('.columns-promo-image');
    if (image && row.firstElementChild !== image && !row.querySelector('.columns-promo-main')) {
      row.classList.add('columns-promo-image-end');
    }
  });

  const cols = Math.max(...rows.map((row) => row.children.length));
  block.classList.add(`columns-promo-${cols}-cols`);

  optimizeImages(block);
}
