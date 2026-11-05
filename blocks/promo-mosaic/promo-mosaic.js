import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isImageOnly(cell) {
  return cell.querySelector('picture, img') && cell.textContent.trim() === '';
}

/**
 * Promo mosaic: each row is one tile. Cells per tile (any order, any may be missing):
 * an image-only cell (tile media) and a content cell (heading, text, links/buttons).
 * The first tile is the feature tile; the rest stack beside it.
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const grid = document.createElement('div');
  grid.className = 'promo-mosaic-grid';

  rows.forEach((row, index) => {
    const cells = [...row.children].filter((cell) => cell.innerHTML.trim() !== '');
    if (!cells.length) return;

    const tile = document.createElement('div');
    tile.className = 'promo-mosaic-tile';
    if (index === 0) tile.classList.add('promo-mosaic-feature');

    const media = document.createElement('div');
    media.className = 'promo-mosaic-tile-media';
    const body = document.createElement('div');
    body.className = 'promo-mosaic-tile-body';

    cells.forEach((cell) => {
      if (isImageOnly(cell)) media.append(...cell.childNodes);
      else body.append(...cell.childNodes);
    });

    if (body.childNodes.length) tile.append(body);
    if (media.childNodes.length) {
      tile.append(media);
      tile.classList.add('promo-mosaic-has-media');
    }
    grid.append(tile);
  });

  if (grid.children.length < 2) block.classList.add('promo-mosaic-single');
  optimizeImages(grid);
  block.replaceChildren(grid);
}
