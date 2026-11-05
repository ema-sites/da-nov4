import { createOptimizedPicture } from '../../scripts/aem.js';

const VIDEO_RE = /(youtube\.com|youtu\.be|vimeo\.com|brightcove|\.mp4($|\?))/i;

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

/**
 * A cell is a media cell when it holds only a picture and/or a video link
 * (no headings, paragraphs of prose or lists).
 */
function isMediaCell(cell) {
  const hasPicture = !!cell.querySelector('picture, img');
  const videoLink = [...cell.querySelectorAll('a[href]')].find((a) => VIDEO_RE.test(a.href));
  if (!hasPicture && !videoLink) return false;
  if (cell.querySelector('h1, h2, h3, h4, h5, h6, ul, ol, table')) return false;
  const text = cell.textContent.trim();
  const linkText = videoLink ? videoLink.textContent.trim() : '';
  return text.length === 0 || text === linkText || text.length < 40;
}

function decorateVideo(cell) {
  const link = [...cell.querySelectorAll('a[href]')].find((a) => VIDEO_RE.test(a.href));
  if (!link) return;
  cell.classList.add('columns-media-video');
  link.classList.add('columns-media-play');
  if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', link.textContent.trim() || 'Play video');
  const pic = cell.querySelector('picture');
  if (pic && !link.contains(pic)) {
    // keep the poster image and the play link together
    const wrap = document.createElement('div');
    wrap.className = 'columns-media-poster';
    pic.replaceWith(wrap);
    wrap.append(pic, link);
  }
}

const isTextPara = (el) => !!el && el.tagName === 'P' && !el.querySelector('picture, img');

/**
 * banner: group the store-badge links (with the lead-in line before them and the
 * note after them) and the trailing app rating paragraphs into two side-by-side panels.
 */
function groupBannerAside(cell) {
  const children = [...cell.children];
  const badgeIdx = children.findIndex((el) => el.tagName === 'P'
    && el.querySelector(':scope > a picture, :scope > a img'));
  if (badgeIdx < 0) return;

  let start = badgeIdx;
  const prev = children[badgeIdx - 1];
  // the lead-in line, but never the intro paragraph that directly follows the heading
  if (isTextPara(prev) && prev.previousElementSibling
    && !/^H[1-6]$/.test(prev.previousElementSibling.tagName)) start -= 1;
  let end = badgeIdx;
  if (isTextPara(children[badgeIdx + 1])) end += 1;

  const apps = document.createElement('div');
  apps.className = 'columns-media-apps';
  const aside = document.createElement('div');
  aside.className = 'columns-media-aside';
  children[start].before(aside);
  apps.append(...children.slice(start, end + 1));
  aside.append(apps);

  const rest = children.slice(end + 1);
  if (!rest.some((el) => el.querySelector('picture, img'))) return;
  const rating = document.createElement('div');
  rating.className = 'columns-media-rating';
  rest.forEach((el) => {
    const hasImg = !!el.querySelector('picture, img');
    if (hasImg && !el.textContent.trim()) el.classList.add('columns-media-rating-logo');
    else if (hasImg) el.classList.add('columns-media-rating-score');
    else el.classList.add('columns-media-rating-count');
  });
  rating.append(...rest);
  aside.append(rating);
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  const cols = Math.max(...rows.map((row) => row.children.length));
  block.classList.add(`columns-media-${cols}-cols`);

  rows.forEach((row) => {
    row.classList.add('columns-media-row');
    const cells = [...row.children];
    cells.forEach((cell) => {
      // drop empty cells authors leave behind
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, video, iframe')) {
        cell.remove();
        return;
      }
      if (isMediaCell(cell)) {
        cell.classList.add('columns-media-media');
        decorateVideo(cell);
      } else {
        cell.classList.add('columns-media-text');
      }
    });
    const media = row.querySelector(':scope > .columns-media-media');
    const first = row.firstElementChild;
    if (media && first !== media) row.classList.add('columns-media-media-end');
    if (block.classList.contains('banner')) {
      row.querySelectorAll(':scope > .columns-media-text').forEach(groupBannerAside);
    }
  });

  optimizeImages(block);
}
