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
 * A text cell ending in picture-only paragraphs (explainer: heading + text, then
 * the illustration) is split so the illustration becomes its own image cell.
 */
function splitTrailingIllustration(cell) {
  const trailing = [];
  let last = cell.lastElementChild;
  while (last && last.tagName === 'P' && isPictureOnly(last)) {
    trailing.unshift(last);
    last = last.previousElementSibling;
  }
  if (!trailing.length || !last) return;
  const image = document.createElement('div');
  trailing.forEach((p) => image.append(...p.childNodes));
  trailing.forEach((p) => p.remove());
  cell.after(image);
}

/**
 * Each row: label cell, then one or more content cells.
 * - picture-only cells are illustrations (explainer) or award logos
 * - a cell starting with a picture followed by text is a media item (logo beside its caption)
 */
export default function decorate(block) {
  let maxCols = 1;
  [...block.children].forEach((row) => {
    row.classList.add('columns-feature-row-row');
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) cell.remove();
      else if (!isPictureOnly(cell)) splitTrailingIllustration(cell);
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
      const first = cell.firstElementChild;
      const pic = first && (first.tagName === 'PICTURE' || (first.tagName === 'P' && isPictureOnly(first)))
        ? first.querySelector(':scope > picture, :scope > img') || first
        : null;
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
