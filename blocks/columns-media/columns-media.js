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
  });

  optimizeImages(block);
}
