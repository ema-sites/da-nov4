import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

/** In a card, a leading picture + short heading become a media header row. */
function decorateCard(cell) {
  cell.classList.add('columns-side-heading-card');
  const pic = cell.querySelector(':scope > p > picture, :scope > picture');
  const heading = cell.querySelector(':scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
  if (pic && heading) {
    const header = document.createElement('div');
    header.className = 'columns-side-heading-card-header';
    const picHolder = pic.parentElement.tagName === 'P' ? pic.parentElement : pic;
    picHolder.before(header);
    header.append(picHolder, heading);
  }
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;
  const boxedCards = block.classList.contains('boxed-cards') || block.classList.contains('boxed-cards-2');
  const boxedPanel = block.classList.contains('boxed-panel');

  rows.forEach((row) => {
    row.classList.add('columns-side-heading-row');
    const cells = [...row.children].filter((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, table')) {
        cell.remove();
        return false;
      }
      return true;
    });
    if (!cells.length) return;

    const [heading, ...content] = cells;
    // a lone content cell (no heading cell) still renders in the body column
    if (!content.length && !heading.querySelector('h1, h2, h3, h4, h5, h6')) {
      heading.classList.add('columns-side-heading-body');
      row.classList.add('columns-side-heading-no-heading');
      return;
    }
    heading.classList.add('columns-side-heading-heading');

    const body = document.createElement('div');
    body.className = 'columns-side-heading-body';
    content.forEach((cell) => {
      cell.classList.add('columns-side-heading-content');
      if (boxedCards) decorateCard(cell);
      body.append(cell);
    });
    if (content.length > 1) body.classList.add('columns-side-heading-multi');
    if (boxedPanel) body.classList.add('columns-side-heading-panel');
    row.append(body);
  });

  optimizeImages(block);
}
