import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADER_STRIP_OPTIONS = ['header-strip', 'header-strip-blue-grey'];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

const hasOption = (block, list) => list.some((o) => block.classList.contains(o));

const LOGO_MAX_PX = 400;

/*
 * image option: a small image (award badge, logo) is shown whole at its own size
 * instead of being cropped to the card photo ratio. Uses the authored width/height
 * when present, otherwise the loaded intrinsic size.
 */
function isLogoSize(w, h) {
  return w > 0 && w <= LOGO_MAX_PX && (!h || h <= LOGO_MAX_PX);
}

/* Call before optimizeImages: returns a callback to run once images are final. */
function markLogoImages(ul) {
  const cells = [...ul.querySelectorAll('.cards-product-card-image')];
  const authored = cells.map((cell) => {
    const img = cell.querySelector('img');
    return {
      w: parseInt(img?.getAttribute('width'), 10),
      h: parseInt(img?.getAttribute('height'), 10),
    };
  });
  return () => cells.forEach((cell, idx) => {
    const mark = () => cell.classList.add('cards-product-card-logo');
    const { w, h } = authored[idx];
    if (w) {
      if (isLogoSize(w, h)) mark();
      return;
    }
    const img = cell.querySelector('img');
    if (!img) return;
    const check = () => { if (isLogoSize(img.naturalWidth, img.naturalHeight)) mark(); };
    if (img.complete && img.naturalWidth) check();
    else img.addEventListener('load', check, { once: true });
  });
}

/* A short heading-less cell before the main body is the coloured card strip/label. */
function isStripCell(cell, bodyCount) {
  if (bodyCount < 2) return false;
  if (cell.querySelector('h1, h2, h3, h4, h5, h6, ul, ol')) return false;
  const text = cell.textContent.trim();
  return text.length > 0 && text.length <= 40;
}

export default function decorate(block) {
  const stripEnabled = hasOption(block, HEADER_STRIP_OPTIONS);
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    const li = document.createElement('li');
    const isImage = (c) => !c.textContent.trim() && !!c.querySelector('picture, img');
    const bodyCount = cells.filter((c) => !isImage(c)).length;
    let stripUsed = false;

    cells.forEach((cell) => {
      const div = document.createElement('div');
      if (isImage(cell)) {
        div.className = 'cards-product-card-image';
      } else if (stripEnabled && !stripUsed && isStripCell(cell, bodyCount)) {
        div.className = 'cards-product-card-strip';
        stripUsed = true;
      } else {
        div.className = 'cards-product-card-body';
      }
      div.append(...cell.childNodes);
      li.append(div);
    });

    if (!li.querySelector('.cards-product-card-image')) li.classList.add('cards-product-card-no-image');
    // a card with a single destination becomes fully clickable
    const links = li.querySelectorAll('.cards-product-card-body a');
    if (links.length === 1) li.classList.add('cards-product-card-linked');
    ul.append(li);
  });

  if (block.classList.contains('featured') && ul.children.length > 1) {
    ul.firstElementChild.classList.add('cards-product-card-featured');
  }
  if (ul.children.length === 1) block.classList.add('cards-product-single');

  // read authored dimensions before optimisation replaces the <img>
  const applyLogos = block.classList.contains('image') ? markLogoImages(ul) : null;
  optimizeImages(ul);
  applyLogos?.();
  block.replaceChildren(ul);
}
