import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizePictures(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isEmptyCell(cell) {
  return !cell.textContent.trim() && !cell.querySelector('picture, img, a, button');
}

/**
 * Each cell is one column of checkmarked items. Lists become checklists; a
 * cell without a list is wrapped so its paragraphs read as checklist items.
 */
export default function decorate(block) {
  const rows = [...block.children];
  let maxCols = 1;

  rows.forEach((row) => {
    row.classList.add('columns-checklist-row');
    const cells = [...row.children];
    cells.forEach((cell) => {
      if (isEmptyCell(cell)) {
        cell.remove();
        return;
      }
      cell.classList.add('columns-checklist-col');
      const lists = cell.querySelectorAll('ul, ol');
      if (lists.length) {
        lists.forEach((list) => list.classList.add('columns-checklist-list'));
      } else {
        // no list authored: each block-level child becomes an item
        const ul = document.createElement('ul');
        ul.className = 'columns-checklist-list';
        [...cell.children].forEach((child) => {
          const li = document.createElement('li');
          li.append(child);
          ul.append(li);
        });
        if (!ul.children.length && cell.textContent.trim()) {
          const li = document.createElement('li');
          li.append(...cell.childNodes);
          ul.append(li);
        }
        cell.replaceChildren(ul);
      }
    });
    if (!row.children.length) row.remove();
    else maxCols = Math.max(maxCols, row.children.length);
  });

  block.classList.add(`columns-checklist-${maxCols}-cols`);
  block.style.setProperty('--columns-checklist-cols', maxCols);
  optimizePictures(block);
}
