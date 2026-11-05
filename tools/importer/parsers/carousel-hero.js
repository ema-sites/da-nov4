/* eslint-disable */
/* global WebImporter */

/**
 * Parser: carousel-hero (thumbnail-tabs)
 * Source: #hero-carousel-region (rbcroyalbank.com homepage)
 *
 * Block rows (one per slide), 4 cells each:
 *   [background picture] | content | [foreground picture] | tab label (+ thumbnail)
 * Empty cells are ignored by blocks/carousel-hero/carousel-hero.js.
 * Tabs come from .hero-previews .preview-card, paired with slides by index.
 * A preview card without an <img> carries its thumbnail as an inline/CSS
 * background (banner_previews/banner-N.webp); that url() becomes the tab picture.
 *
 * Content cell keeps source document order (pill, heading, body, CTAs,
 * disclaimers). Encodings consumed by scripts.js decorateButtons:
 *   <strong><a>       -> a.button.primary  : blue primary button (a.btn.primary)
 *   <strong><em><a>   -> a.button.accent   : white filled button, blue text
 *                                             (a.btn.tertiary / .custom-white / .text-blue)
 *   <em><a>           -> a.button.secondary: transparent outline button (other a.btn)
 *   plain <a>         -> text link (a.standalone-link chevron link, inline links)
 * Heading highlight (span.highlight, yellow "$1,000") is authored as <em>.
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function cloneImg(document, img) {
  if (!img) return null;
  const out = document.createElement('img');
  const src = img.getAttribute('src') || '';
  // html2md turns any <img src="*.svg"> into a :name: icon shorthand (needs /icons/*.svg);
  // a fragment keeps it a real image without changing the fetched resource.
  out.src = /\.svg$/i.test(src) ? `${src}#icon` : src;
  out.alt = img.getAttribute('alt') || '';
  return out;
}

/** Copy inline content (text, links, sup, span.highlight) without layout wrappers. */
function inlineClone(document, src, tag) {
  const out = document.createElement(tag);
  const copy = src.cloneNode(true);
  copy.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
  // highlighted words (span.highlight) -> <em> so the block CSS can colour them
  copy.querySelectorAll('span.highlight').forEach((s) => {
    const em = document.createElement('em');
    em.append(...s.childNodes);
    s.replaceWith(em);
  });
  copy.childNodes.forEach((n) => out.append(n.cloneNode(true)));
  // unwrap plain spans so headings stay clean
  out.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  return out;
}

function ctaLink(document, a) {
  const link = document.createElement('a');
  let href = a.getAttribute('href') || '';
  if (!href || /^javascript:/i.test(href)) href = '#';
  link.href = href;
  link.textContent = cleanText(a.textContent);
  return link;
}

/** CTA variant from source classes (see header for the mapping). */
function ctaVariant(a) {
  if (!a.classList.contains('btn')) return 'link';
  if (a.classList.contains('primary')) return 'primary';
  if (['tertiary', 'custom-white', 'text-blue', 'white'].some((c) => a.classList.contains(c))) return 'accent';
  return 'secondary';
}

function ctaParagraph(document, a) {
  const p = document.createElement('p');
  const link = ctaLink(document, a);
  const variant = ctaVariant(a);
  if (variant === 'primary') {
    const strong = document.createElement('strong');
    strong.append(link);
    p.append(strong);
  } else if (variant === 'accent') {
    const strong = document.createElement('strong');
    const em = document.createElement('em');
    em.append(link);
    strong.append(em);
    p.append(strong);
  } else if (variant === 'secondary') {
    const em = document.createElement('em');
    em.append(link);
    p.append(em);
  } else {
    p.append(link);
  }
  return p;
}

// Known preview backgrounds, for DOMs whose inline styles were stripped (cached HTML).
const PREVIEW_FALLBACK = {
  'banner-5': '/_assets-custom/homepage/images/banner_previews/banner-5.webp',
  'banner-6': '/_assets-custom/homepage/images/banner_previews/banner-6.webp',
};

function bgUrl(value) {
  const urls = [...(value || '').matchAll(/url\((['"]?)(.*?)\1\)/g)]
    .map((m) => m[2]).filter((u) => u && !u.startsWith('data:'));
  return urls[0] || '';
}

/** Thumbnail URL of a preview card drawn as a background image. */
function previewBackground(document, preview, section) {
  const nodes = [preview, ...preview.querySelectorAll('*')];
  for (const el of nodes) {
    const u = bgUrl(el.getAttribute('style'));
    if (u) return u;
  }
  try {
    const win = document.defaultView;
    if (win && win.getComputedStyle) {
      for (const el of nodes) {
        const u = bgUrl(win.getComputedStyle(el).backgroundImage);
        if (u) return u;
      }
    }
  } catch (e) { /* no computed styles */ }
  return (section && PREVIEW_FALLBACK[section.id]) || '';
}

function buildContent(document, slideRoot) {
  const content = [];
  const textRoot = slideRoot.querySelector('.copy, .banner-text') || slideRoot;

  // eyebrow pill
  const pill = textRoot.querySelector('.pill');
  if (pill && cleanText(pill.textContent)) {
    const p = document.createElement('p');
    p.textContent = cleanText(pill.textContent);
    content.push(p);
  }

  // heading
  const heading = textRoot.querySelector('h1, h2, h3');
  if (heading && cleanText(heading.textContent)) {
    content.push(inlineClone(document, heading, heading.tagName.toLowerCase()));
  }

  // body paragraphs, offer notes and CTAs in source document order
  const CTA_SEL = 'a.btn, a.standalone-link, a.view-details';
  const items = [...textRoot.querySelectorAll(`:scope > p, .offer-ends, ${CTA_SEL}`)];
  const taken = [];
  items.forEach((el) => {
    if (taken.some((t) => t.contains(el))) return;
    if (el.tagName === 'A') {
      if (!cleanText(el.textContent)) return;
      content.push(ctaParagraph(document, el));
      return;
    }
    // skip duplicated desktop-hidden legal copy
    if (el.matches('.desktop-hidden')) return;
    taken.push(el);
    if (el.classList.contains('offer-ends')) {
      const icon = el.querySelector('img');
      const text = cleanText(el.textContent);
      if (!text) return;
      const p = document.createElement('p');
      if (icon) p.append(cloneImg(document, icon), ' ');
      p.append(text);
      content.push(p);
      return;
    }
    if (!cleanText(el.textContent)) return;
    content.push(inlineClone(document, el, 'p'));
  });

  return content;
}

export default function parse(element, { document }) {
  const slides = [...element.querySelectorAll('.hero-slides > .hero-slide')];
  const previews = [...element.querySelectorAll('.hero-previews > .preview-card')];
  const cells = [];

  slides.forEach((slide, idx) => {
    const section = slide.querySelector(':scope > section') || slide;

    // background image: direct child img of the slide section
    const bgImg = section.querySelector(':scope > img, :scope > picture img');
    const bgCell = bgImg ? [cloneImg(document, bgImg)] : '';

    const content = buildContent(document, section);

    // foreground image: ipad .img, or desktop/first banner-img
    const fgImg = section.querySelector('.img img')
      || section.querySelector('.banner-img-desktop img')
      || section.querySelector('.banner-img img');
    const fgCell = fgImg ? [cloneImg(document, fgImg)] : '';

    // tab cell: preview label + optional thumbnail
    let tabCell = '';
    const preview = previews[idx];
    if (preview) {
      const label = cleanText((preview.querySelector('.preview-title') || preview).textContent);
      const thumb = preview.querySelector('img');
      const parts = [];
      if (thumb) {
        parts.push(cloneImg(document, thumb));
      } else {
        const src = previewBackground(document, preview, section);
        if (src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          parts.push(img);
        }
      }
      if (label) {
        const p = document.createElement('p');
        p.textContent = label;
        parts.push(p);
      }
      if (label) tabCell = parts;
    }

    if (!content.length && !bgImg && !fgImg) return;
    cells.push([bgCell, content, fgCell, tabCell]);
  });

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'carousel-hero',
    variants: ['thumbnail-tabs'],
    cells,
  });
  element.replaceWith(block);
}
