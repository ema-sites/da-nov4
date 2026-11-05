import { createOptimizedPicture } from '../../scripts/aem.js';

const TEXT_SLIDE_OPTIONS = ['text-slides', 'text-slides-2'];

function optimizePictures(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isEmptyCell(cell) {
  return !cell.textContent.trim() && !cell.querySelector('picture, img, video, iframe, a');
}

function isPictureOnly(cell) {
  const pic = cell.querySelector('picture');
  if (!pic) return false;
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture').forEach((p) => p.remove());
  return !clone.textContent.trim();
}

/**
 * The first row is an intro panel when it is a single cell with a top-level
 * heading (h1/h2) and more rows follow. Text-slide carousels never have one.
 */
function isIntroRow(row, rowCount, textSlides) {
  if (textSlides || rowCount < 2) return false;
  const cells = [...row.children].filter((c) => !isEmptyCell(c));
  return cells.length === 1 && !!cells[0].querySelector('h1, h2');
}

function buildCard(row, idx) {
  const li = document.createElement('li');
  li.className = 'carousel-cards-card';
  li.dataset.index = idx;
  [...row.children].forEach((cell) => {
    if (isEmptyCell(cell)) return;
    cell.className = isPictureOnly(cell) ? 'carousel-cards-card-image' : 'carousel-cards-card-body';
    li.append(cell);
  });
  return li;
}

function cardStep(track) {
  const card = track.querySelector('.carousel-cards-card');
  if (!card) return track.clientWidth;
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  return card.getBoundingClientRect().width + gap;
}

function activeIndex(track) {
  const step = cardStep(track);
  return step ? Math.round(track.scrollLeft / step) : 0;
}

function updateControls(block, track) {
  const max = track.scrollWidth - track.clientWidth;
  const prev = block.querySelector('.carousel-cards-prev');
  const next = block.querySelector('.carousel-cards-next');
  if (prev) prev.disabled = track.scrollLeft <= 1;
  if (next) next.disabled = track.scrollLeft >= max - 1;

  const bar = block.querySelector('.carousel-cards-progress-bar');
  if (bar) {
    const visible = max > 0 ? track.clientWidth / track.scrollWidth : 1;
    const pos = max > 0 ? track.scrollLeft / max : 0;
    bar.style.width = `${visible * 100}%`;
    bar.style.marginLeft = `${pos * (1 - visible) * 100}%`;
  }

  const current = activeIndex(track);
  block.querySelectorAll('.carousel-cards-dot').forEach((dot, idx) => {
    if (idx === current) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });

  // Hide controls when nothing overflows.
  block.classList.toggle('carousel-cards-static', max <= 1);
}

export default function decorate(block) {
  const textSlides = TEXT_SLIDE_OPTIONS.some((c) => block.classList.contains(c));
  if (textSlides) block.classList.add('carousel-cards-text');

  const rows = [...block.children].filter((row) => row.children.length && !isEmptyCell(row));
  if (!rows.length) return;

  let intro;
  if (isIntroRow(rows[0], rows.length, textSlides)) {
    intro = document.createElement('div');
    intro.className = 'carousel-cards-intro';
    const cell = [...rows.shift().children].find((c) => !isEmptyCell(c));
    intro.append(...cell.childNodes);
    block.classList.add('carousel-cards-has-intro');
  }

  const track = document.createElement('ul');
  track.className = 'carousel-cards-track';
  track.setAttribute('tabindex', '0');
  rows.forEach((row, idx) => track.append(buildCard(row, idx)));
  optimizePictures(track);
  if (intro) optimizePictures(intro);

  const viewport = document.createElement('div');
  viewport.className = 'carousel-cards-viewport';
  viewport.append(track);

  const controls = document.createElement('div');
  controls.className = 'carousel-cards-controls';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'carousel-cards-prev';
  prev.setAttribute('aria-label', 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-cards-next';
  next.setAttribute('aria-label', 'Next');
  controls.append(prev, next);

  let indicator;
  if (textSlides) {
    indicator = document.createElement('ol');
    indicator.className = 'carousel-cards-dots';
    rows.forEach((_, idx) => {
      const li = document.createElement('li');
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-cards-dot';
      dot.setAttribute('aria-label', `Show slide ${idx + 1}`);
      dot.addEventListener('click', () => {
        track.scrollTo({ left: idx * cardStep(track), behavior: 'smooth' });
      });
      li.append(dot);
      indicator.append(li);
    });
  } else {
    indicator = document.createElement('div');
    indicator.className = 'carousel-cards-progress';
    indicator.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('div');
    bar.className = 'carousel-cards-progress-bar';
    indicator.append(bar);
  }

  const stage = document.createElement('div');
  stage.className = 'carousel-cards-stage';
  stage.append(controls, viewport, indicator);

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Carousel');
  block.replaceChildren(...(intro ? [intro, stage] : [stage]));

  prev.addEventListener('click', () => {
    track.scrollBy({ left: -cardStep(track), behavior: 'smooth' });
  });
  next.addEventListener('click', () => {
    track.scrollBy({ left: cardStep(track), behavior: 'smooth' });
  });

  let ticking = false;
  const refresh = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateControls(block, track);
      ticking = false;
    });
  };
  track.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh);
  refresh();
}
