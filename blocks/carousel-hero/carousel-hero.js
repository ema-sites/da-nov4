import { createOptimizedPicture } from '../../scripts/aem.js';

const TAB_OPTIONS = ['thumbnail-tabs', 'thumbnail-tabs-2'];
const AUTOPLAY_MS = 7000;

function optimizePictures(root, width = '2000') {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width }]));
  });
}

function isEmptyCell(cell) {
  return !cell.textContent.trim() && !cell.querySelector('picture, img, video, iframe, a');
}

function isPictureOnly(cell) {
  if (!cell.querySelector('picture')) return false;
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture').forEach((p) => p.remove());
  return !clone.textContent.trim();
}

/**
 * Row cells: [background picture], content, [foreground picture], [tab thumbnail/label].
 * A picture-only cell before the content is the background; a picture-only cell
 * after it is the foreground image. With thumbnail tabs, a last cell holding
 * text (optionally with a picture) after the content is the tab.
 */
function buildSlide(row, idx, withTabs) {
  const slide = document.createElement('li');
  slide.className = 'carousel-hero-slide';
  slide.dataset.index = idx;
  slide.id = `${row.closest('.carousel-hero').id}-slide-${idx}`;

  const cells = [...row.children].filter((c) => !isEmptyCell(c));
  let tab;
  let contentSeen = false;
  cells.forEach((cell) => {
    if (isPictureOnly(cell)) {
      cell.className = contentSeen ? 'carousel-hero-slide-image' : 'carousel-hero-slide-background';
      slide.append(cell);
    } else if (!contentSeen) {
      cell.className = 'carousel-hero-slide-content';
      contentSeen = true;
      slide.append(cell);
    } else if (withTabs && !tab) {
      tab = cell;
    } else {
      // extra content cells merge into the content
      slide.querySelector('.carousel-hero-slide-content').append(...cell.childNodes);
    }
  });

  if (!slide.querySelector('.carousel-hero-slide-background')) {
    slide.classList.add('carousel-hero-slide-plain');
  }

  const heading = slide.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && heading.id) slide.setAttribute('aria-labelledby', heading.id);

  return { slide, tab, heading };
}

function buildTab(tabCell, heading, slide, idx) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'carousel-hero-tab';
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', slide.id);
  const pic = tabCell?.querySelector('picture')
    || slide.querySelector('.carousel-hero-slide-image picture, .carousel-hero-slide-background picture');
  if (pic) {
    const thumb = document.createElement('span');
    thumb.className = 'carousel-hero-tab-image';
    thumb.append(tabCell ? pic : pic.cloneNode(true));
    button.append(thumb);
  }
  const label = document.createElement('span');
  label.className = 'carousel-hero-tab-label';
  label.textContent = (tabCell?.textContent.trim()) || heading?.textContent.trim() || `Slide ${idx + 1}`;
  button.append(label);
  return button;
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => !isEmptyCell(row));
  if (!rows.length) return;

  const withTabs = TAB_OPTIONS.some((c) => block.classList.contains(c));
  if (withTabs) block.classList.add('carousel-hero-tabs');
  if (!block.id) {
    block.id = `carousel-hero-${document.querySelectorAll('.carousel-hero[id]').length + 1}`;
  }

  const track = document.createElement('ul');
  track.className = 'carousel-hero-slides';

  const nav = document.createElement('div');
  nav.className = 'carousel-hero-nav';
  const indicators = document.createElement(withTabs ? 'div' : 'ol');
  indicators.className = withTabs ? 'carousel-hero-tablist' : 'carousel-hero-dots';
  if (withTabs) indicators.setAttribute('role', 'tablist');

  const controls = [];
  rows.forEach((row, idx) => {
    const { slide, tab, heading } = buildSlide(row, idx, withTabs);
    track.append(slide);
    let control;
    if (withTabs) {
      control = buildTab(tab, heading, slide, idx);
      indicators.append(control);
    } else {
      const li = document.createElement('li');
      control = document.createElement('button');
      control.type = 'button';
      control.className = 'carousel-hero-dot';
      control.setAttribute('aria-label', `Show slide ${idx + 1} of ${rows.length}`);
      li.append(control);
      indicators.append(li);
    }
    controls.push(control);
  });

  optimizePictures(track);
  optimizePictures(indicators, '400');

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'carousel-hero-prev';
  prev.setAttribute('aria-label', 'Previous slide');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-hero-next';
  next.setAttribute('aria-label', 'Next slide');
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'carousel-hero-pause';
  pause.setAttribute('aria-label', 'Pause');

  if (withTabs) nav.append(indicators, pause);
  else nav.append(prev, indicators, next, pause);

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Carousel');
  block.replaceChildren(track, nav);

  const slides = [...track.children];
  if (slides.length < 2) {
    block.classList.add('carousel-hero-single');
    return;
  }

  let current = 0;
  let timer;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const show = (target) => {
    current = (target + slides.length) % slides.length;
    slides.forEach((slide, idx) => {
      const active = idx === current;
      slide.classList.toggle('carousel-hero-slide-active', active);
      slide.setAttribute('aria-hidden', !active);
      slide.querySelectorAll('a, button').forEach((el) => {
        if (active) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
    });
    controls.forEach((control, idx) => {
      if (idx === current) {
        control.setAttribute(withTabs ? 'aria-selected' : 'aria-current', 'true');
      } else {
        control.removeAttribute('aria-current');
        if (withTabs) control.setAttribute('aria-selected', 'false');
      }
    });
    block.dataset.activeSlide = current;
  };

  const schedule = () => {
    clearInterval(timer);
    if (!paused) timer = setInterval(() => show(current + 1), AUTOPLAY_MS);
  };

  const setPaused = (value) => {
    paused = value;
    pause.classList.toggle('carousel-hero-paused', paused);
    pause.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    schedule();
  };

  controls.forEach((control, idx) => control.addEventListener('click', () => {
    show(idx);
    schedule();
  }));
  prev.addEventListener('click', () => { show(current - 1); schedule(); });
  next.addEventListener('click', () => { show(current + 1); schedule(); });
  pause.addEventListener('click', () => setPaused(!paused));
  block.addEventListener('focusin', () => clearInterval(timer));
  block.addEventListener('focusout', () => schedule());

  show(0);
  setPaused(paused);
}
