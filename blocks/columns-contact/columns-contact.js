import { createOptimizedPicture } from '../../scripts/aem.js';

const THREE_UP = ['three-up', 'three-up-2', 'three-up-3'];
const SLIDER = ['slider', 'slider-2'];

function optimizePictures(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isEmpty(el) {
  return !el.textContent.trim() && !el.querySelector('picture, img, a, button, .icon');
}

function isPictureOnly(el) {
  if (!el.querySelector('picture, img, .icon')) return false;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('picture, img, .icon').forEach((p) => p.remove());
  return !clone.textContent.trim();
}

/** Mark icon paragraphs and icon + link pairs inside a contact cell. */
function decorateContactItems(cell) {
  [...cell.children].forEach((child) => {
    if (child.tagName === 'P' && isPictureOnly(child)) {
      child.classList.add('columns-contact-icon');
    } else if (child.tagName === 'P' && child.querySelector('picture, img, .icon') && child.querySelector('a')) {
      child.classList.add('columns-contact-icon-link');
    }
  });
  cell.querySelectorAll('li').forEach((li) => {
    if (li.querySelector('picture, img, .icon')) li.classList.add('columns-contact-icon-link');
  });
  // a link inside running text (not the whole paragraph) keeps the body weight
  cell.querySelectorAll('p a').forEach((a) => {
    const p = a.closest('p');
    if (p.textContent.trim() !== a.textContent.trim()) a.classList.add('columns-contact-inline-link');
  });
}

function isSvgIcon(p) {
  const img = p.querySelector('img');
  if (!img) return false;
  return /\.svg$/i.test(new URL(img.src, window.location.href).pathname);
}

/** Wrap consecutive siblings matching `test`, starting at `first`, in a new element. */
function wrapRun(first, test, className) {
  const run = [first];
  let next = first.nextElementSibling;
  while (next && test(next)) {
    run.push(next);
    next = next.nextElementSibling;
  }
  const wrapper = document.createElement('div');
  wrapper.className = className;
  first.before(wrapper);
  wrapper.append(...run);
  return wrapper;
}

/**
 * Contact options: an unlinked SVG icon paragraph and the text paragraphs after it (up to the
 * next icon, heading or list) sit side by side; consecutive options form one contact list.
 */
function decorateContacts(cell) {
  const isLinkedIcon = (el) => el.matches('p.columns-contact-icon') && !!el.querySelector('a');
  [...cell.querySelectorAll(':scope > p.columns-contact-icon')].forEach((icon) => {
    // consecutive linked icons (app-store badges) form one row
    if (isLinkedIcon(icon)) {
      const prev = icon.previousElementSibling;
      if (icon.parentElement !== cell || (prev && isLinkedIcon(prev))) return;
      if (icon.nextElementSibling && isLinkedIcon(icon.nextElementSibling)) {
        wrapRun(icon, isLinkedIcon, 'columns-contact-badges');
      }
      return;
    }
    if (!isSvgIcon(icon)) return;
    const next = icon.nextElementSibling;
    if (!next || next.tagName !== 'P' || next.classList.contains('columns-contact-icon')) return;
    const text = wrapRun(next, (el) => el.tagName === 'P' && !el.classList.contains('columns-contact-icon'), 'columns-contact-contact-text');
    const contact = document.createElement('div');
    contact.className = 'columns-contact-contact';
    icon.before(contact);
    contact.append(icon, text);
  });
  [...cell.querySelectorAll(':scope > .columns-contact-contact')].forEach((contact) => {
    if (contact.parentElement !== cell || contact.previousElementSibling?.classList.contains('columns-contact-contact')) return;
    wrapRun(contact, (el) => el.classList.contains('columns-contact-contact'), 'columns-contact-contacts');
  });
}

/** Key facts: two or more paragraphs in a row, each a bold label, a line break and a value. */
function decorateStats(cell) {
  const isStat = (el) => {
    const label = el.tagName === 'P' && el.firstElementChild;
    return !!label && label.matches('strong, b')
      && label.nextElementSibling?.tagName === 'BR'
      && el.textContent.trim().startsWith(label.textContent.trim());
  };
  [...cell.querySelectorAll(':scope > p')].forEach((p) => {
    const prev = p.previousElementSibling;
    const next = p.nextElementSibling;
    if (p.parentElement !== cell || !isStat(p) || (prev && isStat(prev))) return;
    if (!next || !isStat(next)) return;
    wrapRun(p, isStat, 'columns-contact-stats');
  });
}

/**
 * Media row (illustration cell beside a text cell): pair a lone icon paragraph with the
 * paragraph after it (logo beside text) and group consecutive linked icons (store badges).
 */
function decorateMediaText(cell) {
  [...cell.querySelectorAll(':scope > p.columns-contact-icon')].forEach((icon) => {
    if (!icon.isConnected || icon.parentElement !== cell) return;
    if (icon.querySelector('a')) {
      const badges = [icon];
      let next = icon.nextElementSibling;
      while (next && next.matches('p.columns-contact-icon') && next.querySelector('a')) {
        badges.push(next);
        next = next.nextElementSibling;
      }
      if (badges.length < 2) return;
      const group = document.createElement('div');
      group.className = 'columns-contact-badges';
      icon.before(group);
      group.append(...badges);
      return;
    }
    const text = icon.nextElementSibling;
    if (!text || text.tagName !== 'P' || text.classList.contains('columns-contact-icon')) return;
    const lead = document.createElement('div');
    lead.className = 'columns-contact-lead';
    icon.before(lead);
    lead.append(icon, text);
    // a logo that fails to load collapses (as on the source) instead of showing a broken frame
    const logo = icon.querySelector('img');
    if (logo) {
      const collapse = () => icon.classList.add('columns-contact-icon-missing');
      if (logo.complete && !logo.naturalWidth) collapse();
      else logo.addEventListener('error', collapse, { once: true });
    }
  });
}

/** Split a cell into text slides at each heading or <hr>, with arrows and dots. */
function buildSlider(cell) {
  const slides = [];
  let current;
  [...cell.children].forEach((child) => {
    if (child.tagName === 'HR') {
      current = null;
      child.remove();
      return;
    }
    if (!current || (/^H[1-6]$/.test(child.tagName) && current.children.length)) {
      current = document.createElement('li');
      current.className = 'columns-contact-slide';
      slides.push(current);
    }
    current.append(child);
  });
  if (slides.length < 2) {
    if (slides[0]) cell.replaceChildren(...slides[0].childNodes);
    return;
  }

  const track = document.createElement('ul');
  track.className = 'columns-contact-slides';
  track.append(...slides);

  const dots = document.createElement('ol');
  dots.className = 'columns-contact-dots';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'columns-contact-prev';
  prev.setAttribute('aria-label', 'Previous slide');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'columns-contact-next';
  next.setAttribute('aria-label', 'Next slide');

  let active = 0;
  const show = (idx) => {
    active = (idx + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== active;
    });
    [...dots.querySelectorAll('button')].forEach((dot, i) => {
      if (i === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  slides.forEach((_, idx) => {
    const li = document.createElement('li');
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show slide ${idx + 1} of ${slides.length}`);
    dot.addEventListener('click', () => show(idx));
    li.append(dot);
    dots.append(li);
  });
  prev.addEventListener('click', () => show(active - 1));
  next.addEventListener('click', () => show(active + 1));

  const slider = document.createElement('div');
  slider.className = 'columns-contact-slider';
  slider.append(prev, track, next, dots);
  cell.replaceChildren(slider);
  show(0);
}

export default function decorate(block) {
  const threeUp = THREE_UP.some((c) => block.classList.contains(c));
  const slider = SLIDER.some((c) => block.classList.contains(c));
  const question = block.classList.contains('boxed-question');

  let maxCols = 1;
  [...block.children].forEach((row, rowIdx) => {
    row.classList.add('columns-contact-row');
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) cell.remove();
    });
    const cells = [...row.children];
    if (!cells.length) {
      row.remove();
      return;
    }
    maxCols = Math.max(maxCols, cells.length);

    cells.forEach((cell, idx) => {
      if (isPictureOnly(cell)) {
        cell.classList.add('columns-contact-image');
        return;
      }
      // first cell of the first row is the intro unless columns are equal peers
      const intro = !threeUp && rowIdx === 0 && idx === 0 && cells.length > 1;
      cell.classList.add(intro ? 'columns-contact-intro' : 'columns-contact-item');
      decorateContactItems(cell);
      if (slider && idx === cells.length - 1 && cells.length > 1) {
        buildSlider(cell);
        return;
      }
      decorateContacts(cell);
      decorateStats(cell);
    });

    const hasImage = cells.some((cell) => cell.classList.contains('columns-contact-image'));
    if (hasImage && !slider && !question && cells.length > 1) {
      row.classList.add('columns-contact-media');
      row.querySelectorAll(':scope > .columns-contact-item').forEach(decorateMediaText);
    }

    if (question) {
      row.querySelectorAll('ul, ol').forEach((list) => {
        if (list.querySelector('a')) list.classList.add('columns-contact-choices');
      });
    }
  });

  block.classList.add(`columns-contact-${maxCols}-cols`);
  optimizePictures(block);
}
