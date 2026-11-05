import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isImageCell(cell) {
  if (!cell.querySelector('picture, img')) return false;
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture, img').forEach((el) => el.remove());
  return clone.textContent.trim().length === 0;
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

// <p><picture/></p> with no text: an icon authored on its own line before a link
const isIconOnly = (el) => el.tagName === 'P' && !!el.querySelector('picture, img') && !text(el);

// <p><strong>I am an RBC Client:</strong></p>: a label heading a group of links
const isLabel = (el) => el.tagName === 'P'
  && el.children.length === 1
  && el.firstElementChild.tagName === 'STRONG'
  && !el.querySelector('a, picture, img')
  && text(el) === text(el.firstElementChild);

// <p>[icon] <a>…</a></p>: a single plain (non-button) link, optionally with an icon
const isLinkOnly = (el) => {
  if (el.tagName !== 'P') return false;
  const links = el.querySelectorAll('a');
  if (links.length !== 1 || links[0].classList.contains('button')) return false;
  if (links[0].parentElement !== el) return false;
  return text(el) === text(links[0]);
};

/**
 * Turns flat authored paragraphs into icon + link rows and labelled groups,
 * e.g. "I am an RBC Client:" followed by its links, laid out side by side.
 */
function decorateActions(cell) {
  [...cell.children].forEach((el) => {
    if (!isIconOnly(el)) return;
    const next = el.nextElementSibling;
    if (!next || next.tagName !== 'P' || isLabel(next) || isIconOnly(next) || !text(next)) return;
    next.prepend(...el.childNodes);
    el.remove();
  });

  [...cell.children].forEach((el) => {
    if (isLinkOnly(el)) el.classList.add('columns-promo-action');
    if (el.tagName === 'P' && el.querySelector('picture, img') && text(el)) {
      el.classList.add('columns-promo-icon-item');
    }
  });

  let groups = null;
  let el = cell.firstElementChild;
  while (el) {
    let next = el.nextElementSibling;
    if (isLabel(el)) {
      const members = [];
      let cur = next;
      while (cur) {
        const lead = cur.tagName === 'P' && !isLabel(cur) && !cur.querySelector('a, picture, img')
          && cur.nextElementSibling?.classList.contains('columns-promo-action');
        if (!cur.classList.contains('columns-promo-action') && !lead) break;
        members.push(cur);
        cur = cur.nextElementSibling;
      }
      if (members.some((m) => m.classList.contains('columns-promo-action'))) {
        el.classList.add('columns-promo-label');
        const group = document.createElement('div');
        group.className = 'columns-promo-group';
        if (!groups || groups.nextElementSibling !== el) {
          groups = document.createElement('div');
          groups.className = 'columns-promo-groups';
          el.before(groups);
        }
        group.append(el, ...members);
        groups.append(group);
        next = cur;
      }
    }
    el = next;
  }
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  rows.forEach((row) => {
    row.classList.add('columns-promo-row');
    [...row.children].forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, iframe, form')) {
        cell.remove();
        return;
      }
      if (isImageCell(cell)) {
        cell.classList.add('columns-promo-image');
      } else {
        cell.classList.add('columns-promo-content');
        decorateActions(cell);
      }
    });

    // side-box: the last content cell is a separate box beside the main promo
    if (block.classList.contains('side-box')) {
      const cells = [...row.children];
      if (cells.length > 1) {
        const side = cells[cells.length - 1];
        side.classList.remove('columns-promo-content');
        side.classList.add('columns-promo-side');
        const main = document.createElement('div');
        main.className = 'columns-promo-main';
        cells.slice(0, -1).forEach((c) => main.append(c));
        row.prepend(main);
      }
    }

    const image = row.querySelector('.columns-promo-image');
    if (image && row.firstElementChild !== image && !row.querySelector('.columns-promo-main')) {
      row.classList.add('columns-promo-image-end');
    }
  });

  const cols = Math.max(...rows.map((row) => row.children.length));
  block.classList.add(`columns-promo-${cols}-cols`);

  optimizeImages(block);
}
