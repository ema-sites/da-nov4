import { createOptimizedPicture } from '../../scripts/aem.js';

const SLIDER_OPTIONS = ['slider', 'slider-2', 'slider-3'];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function classifyCell(cell, index, total) {
  if (!cell.textContent.trim() && cell.querySelector('picture, img')) return 'cards-plan-card-image';
  const startsWithHeading = /^H[1-6]$/.test(cell.firstElementChild?.tagName || '');
  if (total > 1 && index < total - 1 && startsWithHeading && !cell.querySelector('ul, ol')) {
    return 'cards-plan-card-header';
  }
  return 'cards-plan-card-body';
}

/* When everything is in one cell, split the leading heading block into a header. */
function splitHeader(li) {
  if (li.querySelector('.cards-plan-card-header')) return;
  const body = li.querySelector('.cards-plan-card-body');
  if (!body) return;
  const first = body.firstElementChild;
  if (!first || !/^H[1-6]$/.test(first.tagName)) return;
  const header = document.createElement('div');
  header.className = 'cards-plan-card-header';
  header.append(first);
  // a short paragraph straight after the heading is the plan tagline
  const next = body.firstElementChild;
  if (next && next.tagName === 'P' && !next.querySelector('a') && next.textContent.trim().length <= 80) {
    header.append(next);
  }
  body.before(header);
}

function markActions(body) {
  if (!body) return;
  const items = [...body.children];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const el = items[i];
    const onlyLinks = el.querySelector('a') && el.textContent.trim() === [...el.querySelectorAll('a')].map((a) => a.textContent).join('').trim();
    if (!onlyLinks) break;
    el.classList.add('cards-plan-card-action');
  }
  body.querySelectorAll('ul, ol').forEach((list) => {
    if (!list.closest('.cards-plan-card-action')) list.classList.add('cards-plan-card-features');
  });
}

function buildSlider(block, ul) {
  const track = document.createElement('div');
  track.className = 'cards-plan-track';
  track.append(ul);
  const nav = document.createElement('div');
  nav.className = 'cards-plan-nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cards-plan-prev';
  prev.setAttribute('aria-label', 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cards-plan-next';
  next.setAttribute('aria-label', 'Next');
  nav.append(prev, next);

  const step = () => {
    const card = ul.firstElementChild;
    return (card ? card.getBoundingClientRect().width : track.clientWidth) + 24;
  };
  const update = () => {
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  block.replaceChildren(track, nav);
  requestAnimationFrame(update);
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    const li = document.createElement('li');
    cells.forEach((cell, i) => {
      const div = document.createElement('div');
      div.className = classifyCell(cell, i, cells.length);
      div.append(...cell.childNodes);
      li.append(div);
    });
    splitHeader(li);
    markActions([...li.querySelectorAll('.cards-plan-card-body')].pop());
    ul.append(li);
  });

  optimizeImages(ul);
  if (ul.children.length === 1) block.classList.add('cards-plan-single');

  if (SLIDER_OPTIONS.some((o) => block.classList.contains(o)) && ul.children.length > 1) {
    block.classList.add('cards-plan-slider');
    buildSlider(block, ul);
  } else {
    block.replaceChildren(ul);
  }
}
