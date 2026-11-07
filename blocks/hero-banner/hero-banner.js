/*
 * Hero Banner
 * Rows (any order is tolerated, cells are optional):
 *  - media row: a background picture and/or a video link (.mp4/.webm/.mov) with no heading
 *  - content row: heading, text, CTA links (first row with text content)
 *  - extra rows: aside cards (contact box, offer card, overlap card)
 */

const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;
const VIDEO_TYPES = { ogg: 'video/ogg', webm: 'video/webm' };

// options that define their own layout; without one the default layout is picked from the photo
const LAYOUT_OPTIONS = [
  'split', 'split-strip', 'split-overlap-card', 'video', 'video-2', 'energy-lines',
  'contact-box', 'offer-card', 'orange',
];
// full-bleed banner photos are cut to the banner height (e.g. 1440x524, 1922x560)
const MAX_BANNER_HEIGHT = 700;
// photos at least this wide (width / height) are designed as full-bleed banner backgrounds
const OVERLAY_MIN_RATIO = 2.4;

function isMediaRow(row) {
  const hasPicture = !!row.querySelector('picture');
  const videoLink = [...row.querySelectorAll('a[href]')].find((a) => VIDEO_RE.test(a.href));
  const hasHeading = !!row.querySelector('h1, h2, h3, h4, h5, h6');
  const text = row.textContent.trim();
  const linkText = videoLink ? videoLink.textContent.trim() : '';
  return (hasPicture || videoLink) && !hasHeading && text.length <= linkText.length + 2;
}

function buildVideo(link, poster) {
  const video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  const posterImg = poster?.querySelector('img');
  if (posterImg) video.poster = posterImg.currentSrc || posterImg.src;
  const source = document.createElement('source');
  source.src = link.href;
  const ext = new URL(link.href, window.location.href).pathname.split('.').pop().toLowerCase();
  // .mp4 and .mov (H.264) both play as video/mp4
  source.type = VIDEO_TYPES[ext] || 'video/mp4';
  video.append(source);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.autoplay = false;
  }
  return video;
}

function flatten(row) {
  const wrapper = document.createElement('div');
  [...row.children].forEach((cell) => wrapper.append(...cell.childNodes));
  if (!row.children.length) wrapper.append(...row.childNodes);
  return wrapper;
}

export default function decorate(block) {
  const rows = [...block.children];
  const mediaRows = rows.filter(isMediaRow);
  const otherRows = rows.filter((r) => !mediaRows.includes(r) && (r.textContent.trim() || r.querySelector('picture')));

  const media = document.createElement('div');
  media.className = 'hero-banner-media';
  mediaRows.forEach((row) => {
    const picture = row.querySelector('picture');
    const videoLink = [...row.querySelectorAll('a[href]')].find((a) => VIDEO_RE.test(a.href));
    if (videoLink) {
      media.append(buildVideo(videoLink, picture));
      if (picture) {
        picture.classList.add('hero-banner-poster');
        media.append(picture);
      }
      block.classList.add('hero-banner-has-video');
    } else if (picture) {
      media.append(picture);
    }
  });

  // without a dedicated media row, a picture alone in the content's first cell is the background
  const [contentRow, ...asideRows] = otherRows;
  let content = null;
  if (contentRow) {
    const cells = [...contentRow.children];
    if (!media.children.length && cells.length > 1) {
      const picCell = cells.find((c) => c.querySelector('picture') && !c.querySelector('h1, h2, h3, h4, h5, h6') && !c.textContent.trim());
      if (picCell) {
        media.append(picCell.querySelector('picture'));
        picCell.remove();
      }
    }
    content = flatten(contentRow);
    content.className = 'hero-banner-content';
    content.querySelectorAll('a').forEach((a) => {
      const p = a.closest('p');
      if (p && p.textContent.trim() === a.textContent.trim()) {
        p.classList.add('button-container');
        a.classList.add('button');
      }
    });
  }

  const asides = asideRows.map((row) => {
    const aside = flatten(row);
    aside.className = 'hero-banner-card';
    return aside;
  });

  const inner = document.createElement('div');
  inner.className = 'hero-banner-inner';
  if (content) inner.append(content);
  asides.forEach((a) => inner.append(a));

  block.replaceChildren(...[media, inner].filter((el) => el.children.length));
  if (!media.children.length) {
    block.classList.add('no-image');
    return;
  }

  // default banners (no layout option): wide photos that leave room for the text are
  // used as a full-bleed background; narrower photos get the energy-lines panel layout
  const hasLayout = LAYOUT_OPTIONS.some((c) => block.classList.contains(c));
  const img = media.querySelector('img');
  if (hasLayout || !img || block.classList.contains('hero-banner-has-video')) return;
  block.classList.add('hero-banner-overlay');
  const pickLayout = () => {
    if (!img.naturalWidth) return;
    if (img.naturalWidth / img.naturalHeight >= OVERLAY_MIN_RATIO) {
      if (img.naturalHeight <= MAX_BANNER_HEIGHT) block.style.setProperty('--hero-banner-height', `${img.naturalHeight}px`);
      return;
    }
    block.classList.remove('hero-banner-overlay');
    block.classList.add('energy-lines');
  };
  if (img.complete) pickLayout();
  else img.addEventListener('load', pickLayout, { once: true });
}
