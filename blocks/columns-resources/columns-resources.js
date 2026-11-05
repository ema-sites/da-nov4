import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

/**
 * accordion option: inside the resource column, every sub-heading after the
 * column title becomes a collapsible <details> holding the content up to the
 * next sub-heading.
 */
function buildAccordion(cell) {
  const headings = [...cell.querySelectorAll(':scope > h3, :scope > h4, :scope > h5, :scope > h6')];
  headings.forEach((heading) => {
    const details = document.createElement('details');
    details.className = 'columns-resources-item';
    const summary = document.createElement('summary');
    summary.append(...heading.childNodes);
    details.append(summary);
    const body = document.createElement('div');
    body.className = 'columns-resources-item-body';
    let next = heading.nextElementSibling;
    while (next && !headings.includes(next) && !/^H[1-2]$/.test(next.tagName)) {
      const current = next;
      next = next.nextElementSibling;
      body.append(current);
    }
    if (body.children.length) details.append(body);
    heading.replaceWith(details);
  });
}

function decorateCard(cell) {
  cell.classList.add('columns-resources-card');
  // a trailing paragraph made only of a link is the card's CTA footer
  const last = cell.lastElementChild;
  if (last && last.tagName === 'P' && last.querySelector('a')
    && last.textContent.trim() === last.querySelector('a').textContent.trim()) {
    last.classList.add('columns-resources-cta');
  }
  // the card image is a picture outside any link list (list pictures are icons)
  const pic = [...cell.querySelectorAll('picture')].find((p) => !p.closest('li'));
  if (!pic) return;
  let wrap = pic.closest('p, div');
  if (!wrap || wrap === cell) {
    // picture authored straight into the cell: wrap it so the cell itself stays a card
    wrap = document.createElement('div');
    pic.replaceWith(wrap);
    wrap.append(pic);
  }
  wrap.classList.add('columns-resources-card-image');
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  rows.forEach((row) => {
    row.classList.add('columns-resources-row');
    const cells = [...row.children].filter((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img')) {
        cell.remove();
        return false;
      }
      return true;
    });
    if (!cells.length) return;

    const [lead, ...rest] = cells;
    if (block.classList.contains('feature-panels')) {
      // every cell is an equal feature panel
      cells.forEach(decorateCard);
      return;
    }
    lead.classList.add('columns-resources-lead');
    if (block.classList.contains('accordion')) buildAccordion(lead);
    rest.forEach(decorateCard);
  });

  optimizeImages(block);
}
