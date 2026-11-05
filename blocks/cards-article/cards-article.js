import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

/* A short paragraph before the heading is the article category tag. */
function markTag(body) {
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) return;
  const first = body.firstElementChild;
  if (first && first !== heading && first.tagName === 'P' && first.textContent.trim().length <= 60) {
    first.classList.add('cards-article-tag');
  }
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    const li = document.createElement('li');
    cells.forEach((cell) => {
      const div = document.createElement('div');
      if (!cell.textContent.trim() && cell.querySelector('picture, img')) {
        div.className = 'cards-article-card-image';
      } else {
        div.className = 'cards-article-card-body';
      }
      div.append(...cell.childNodes);
      li.append(div);
    });
    const body = li.querySelector('.cards-article-card-body');
    if (body) markTag(body);
    if (!li.querySelector('.cards-article-card-image')) li.classList.add('cards-article-card-no-image');
    ul.append(li);
  });

  if (block.classList.contains('featured') && ul.firstElementChild) {
    ul.firstElementChild.classList.add('cards-article-card-featured');
  }

  optimizeImages(ul);
  block.replaceChildren(ul);
}
