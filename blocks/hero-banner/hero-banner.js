/*
 * Hero Banner
 * Rows (any order is tolerated, cells are optional):
 *  - media row: a background picture and/or a video link (.mp4/.webm) with no heading
 *  - content row: heading, text, CTA links (first row with text content)
 *  - extra rows: aside cards (contact box, offer card, overlap card)
 */

const VIDEO_RE = /\.(mp4|webm|ogg)(\?|#|$)/i;

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
  source.type = `video/${ext === 'ogg' ? 'ogg' : ext}`;
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
  if (!media.children.length) block.classList.add('no-image');
}
