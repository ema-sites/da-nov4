import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isMediaOnly(cell) {
  return !cell.textContent.trim() && !!cell.querySelector('picture, img, svg, .icon');
}

export default function decorate(block) {
  const items = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img, .icon'));
    if (!cells.length) return;
    const item = document.createElement('div');
    item.className = 'callout-item';
    const icon = document.createElement('div');
    icon.className = 'callout-icon';
    const body = document.createElement('div');
    body.className = 'callout-body';
    cells.forEach((cell) => {
      (isMediaOnly(cell) ? icon : body).append(...cell.childNodes);
    });
    if (icon.childNodes.length) item.append(icon);
    if (body.childNodes.length) item.append(body);
    items.push(item);
  });

  block.replaceChildren(...items);
  if (items.length > 1) block.classList.add('callout-multi');

  if (block.classList.contains('badge')) {
    // a badge is a short label; drop paragraph wrappers so it renders inline
    block.querySelectorAll('.callout-body > p').forEach((p) => {
      const span = document.createElement('span');
      span.append(...p.childNodes);
      p.replaceWith(span);
    });
  }

  optimizeImages(block);
}
