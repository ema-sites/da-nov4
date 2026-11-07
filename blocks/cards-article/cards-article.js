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

/*
 * light-blue flip cards: authored as "+", fact, "-", tip paragraphs.
 * The "+" and "-" become buttons that swap the fact for the tip.
 */
function decorateFlip(li) {
  const body = li.querySelector('.cards-article-card-body');
  if (!body) return;
  const paras = [...body.children].filter((el) => el.tagName === 'P');
  const open = paras.find((p) => p.textContent.trim() === '+');
  const close = paras.find((p) => ['-', '–', '−'].includes(p.textContent.trim()));
  if (!open || !close) return;
  const front = open.nextElementSibling;
  const back = close.nextElementSibling;
  if (front && front !== close) front.classList.add('cards-article-flip-front');
  if (back) {
    back.classList.add('cards-article-flip-back');
    back.id = back.id || `cards-article-tip-${Math.random().toString(36).slice(2, 8)}`;
  }
  const makeButton = (p, cls, label, expanded) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cards-article-flip-toggle ${cls}`;
    btn.textContent = p.textContent.trim();
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', expanded);
    if (back) btn.setAttribute('aria-controls', back.id);
    p.replaceWith(btn);
    return btn;
  };
  const fr = document.documentElement.lang.startsWith('fr');
  const openBtn = makeButton(open, 'cards-article-flip-open', fr ? 'Afficher le conseil' : 'Show tip', 'false');
  const closeBtn = makeButton(close, 'cards-article-flip-close', fr ? 'Masquer le conseil' : 'Hide tip', 'true');
  openBtn.addEventListener('click', () => {
    li.classList.add('flipped');
    closeBtn.focus();
  });
  closeBtn.addEventListener('click', () => {
    li.classList.remove('flipped');
    openBtn.focus();
  });
}

export default function decorate(block) {
  const imageTop = block.classList.contains('image-top');
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
    if (body) {
      markTag(body);
      // a closing paragraph holding just one link is the card's call to action
      const last = body.lastElementChild;
      const link = last?.tagName === 'P' && last.children.length === 1 && last.querySelector(':scope > a');
      if (link && link.textContent.trim() === last.textContent.trim()) {
        last.classList.add('cards-article-cta');
        link.classList.add('cards-article-link');
      }
    }
    if (block.classList.contains('light-blue')) decorateFlip(li);
    if (!li.querySelector('.cards-article-card-image')) li.classList.add('cards-article-card-no-image');
    // image-top: a teaser with a single destination becomes fully clickable
    if (imageTop && li.querySelectorAll('.cards-article-card-body a[href]').length === 1) {
      li.classList.add('cards-article-card-linked');
    }
    ul.append(li);
  });

  // image-top with a single teaser renders as a story row (photo beside the text)
  if (imageTop && ul.children.length === 1) block.classList.add('cards-article-story');

  if (block.classList.contains('featured') && ul.firstElementChild) {
    ul.firstElementChild.classList.add('cards-article-card-featured');
  }

  optimizeImages(ul);
  block.replaceChildren(ul);
}
