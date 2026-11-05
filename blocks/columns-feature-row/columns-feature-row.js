import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizePictures(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isEmpty(el) {
  return !el.textContent.trim() && !el.querySelector('picture, img, a, button, .icon');
}

function isPictureOnly(el) {
  if (!el.querySelector('picture, img')) return false;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('picture, img').forEach((p) => p.remove());
  return !clone.textContent.trim();
}

/**
 * Each row: label cell, then one or more content cells.
 * - picture-only cells are illustrations (explainer) or award logos
 * - a cell with a picture plus text is a media item (logo beside its caption)
 */
export default function decorate(block) {
  let maxCols = 1;
  [...block.children].forEach((row) => {
    row.classList.add('columns-feature-row-row');
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) cell.remove();
    });
    const cells = [...row.children];
    if (!cells.length) {
      row.remove();
      return;
    }
    maxCols = Math.max(maxCols, cells.length);

    let labelSet = false;
    cells.forEach((cell) => {
      if (isPictureOnly(cell)) {
        cell.classList.add('columns-feature-row-image');
        return;
      }
      if (!labelSet && cells.length > 1) {
        cell.classList.add('columns-feature-row-label');
        labelSet = true;
        return;
      }
      cell.classList.add('columns-feature-row-content');
      const pic = cell.querySelector(':scope > picture, :scope > p > picture:only-child');
      if (pic) {
        cell.classList.add('columns-feature-row-media-item');
        const media = pic.closest('p') || pic;
        media.classList.add('columns-feature-row-media');
        const text = document.createElement('div');
        text.className = 'columns-feature-row-media-text';
        [...cell.childNodes].forEach((node) => {
          if (node !== media) text.append(node);
        });
        cell.replaceChildren(media, text);
      }
    });

    if (cells.length === 1) row.classList.add('columns-feature-row-single');
  });

  block.classList.add(`columns-feature-row-${maxCols}-cols`);
  optimizePictures(block);
}
