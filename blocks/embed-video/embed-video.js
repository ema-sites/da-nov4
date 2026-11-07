/*
 * Embed Video
 * One row per video: optional poster image + video link (YouTube, Vimeo, mp4 or any
 * embeddable URL) + optional caption text. Multiple rows render side by side.
 * With a poster, the player loads on click; without, it lazy-loads when visible.
 */

const FRAME_ALLOW = 'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope';

function frame(src, title) {
  const wrap = document.createElement('div');
  wrap.className = 'embed-video-frame';
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allow = FRAME_ALLOW;
  iframe.setAttribute('allowfullscreen', '');
  wrap.append(iframe);
  return wrap;
}

function youtubeSrc(url, autoplay) {
  const usp = new URLSearchParams(url.search);
  let vid = usp.get('v') || '';
  if (url.hostname.includes('youtu.be')) [, vid] = url.pathname.split('/');
  if (!vid && url.pathname.startsWith('/embed/')) [, , vid] = url.pathname.split('/');
  const suffix = autoplay ? '&mute=1&autoplay=1' : '';
  return vid
    ? `https://www.youtube.com/embed/${encodeURIComponent(vid)}?rel=0${suffix}`
    : url.href;
}

function vimeoSrc(url, autoplay) {
  const id = url.pathname.split('/').filter(Boolean).pop();
  return `https://player.vimeo.com/video/${id}${autoplay ? '?muted=1&autoplay=1' : ''}`;
}

function buildPlayer(link, autoplay) {
  let url;
  try {
    url = new URL(link, window.location.href);
  } catch (e) {
    return null;
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
    const video = document.createElement('video');
    video.src = url.href;
    video.controls = true;
    video.playsInline = true;
    if (autoplay) {
      video.autoplay = true;
      video.muted = true;
    }
    const wrap = document.createElement('div');
    wrap.className = 'embed-video-frame';
    wrap.append(video);
    return wrap;
  }
  if (/youtube|youtu\.be/.test(url.hostname)) return frame(youtubeSrc(url, autoplay), 'Content from YouTube');
  if (/vimeo/.test(url.hostname)) return frame(vimeoSrc(url, autoplay), 'Content from Vimeo');
  return frame(url.href, `Content from ${url.hostname}`);
}

function decorateItem(row) {
  const link = row.querySelector('a[href]');
  const picture = row.querySelector('picture');
  const item = document.createElement('div');
  item.className = 'embed-video-item';
  if (!link) {
    // nothing to play: keep authored content
    item.append(...row.childNodes);
    return item;
  }

  const captionNodes = [...row.querySelectorAll(':scope > div > *')]
    .filter((el) => !el.contains(link) && !el.contains(picture) && el.textContent.trim());

  const media = document.createElement('div');
  media.className = 'embed-video-media';
  item.append(media);

  // a plain web page (not a video file or player) embeds as a fixed-height panel
  if (!picture && !/youtube|youtu\.be|vimeo|\.(mp4|webm|ogg)(\?|#|$)/i.test(link.href)) {
    item.classList.add('embed-video-page');
  }

  if (picture) {
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'embed-video-placeholder';
    placeholder.setAttribute('aria-label', link.title || link.textContent.trim() || 'Play video');
    const play = document.createElement('span');
    play.className = 'embed-video-play';
    placeholder.append(picture, play);
    placeholder.addEventListener('click', () => {
      const player = buildPlayer(link.href, true);
      if (player) media.replaceChildren(player);
    }, { once: true });
    media.append(placeholder);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        const player = buildPlayer(link.href, false);
        if (player) media.replaceChildren(player);
      }
    });
    observer.observe(media);
  }

  if (captionNodes.length) {
    const caption = document.createElement('div');
    caption.className = 'embed-video-caption';
    caption.append(...captionNodes);
    item.append(caption);
  }
  return item;
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.textContent.trim() || row.querySelector('picture, a'));
  const items = rows.map(decorateItem);
  block.replaceChildren(...items);
  if (items.length > 1) block.classList.add('embed-video-multi');
}
