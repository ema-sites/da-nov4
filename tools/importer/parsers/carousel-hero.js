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
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function cloneImg(document, img) {
  if (!img) return null;
  const out = document.createElement('img');
  out.src = img.getAttribute('src');
  out.alt = img.getAttribute('alt') || '';
  return out;
}

/** Copy inline content (text, links, sup, span.highlight) without layout wrappers. */
function inlineClone(document, src, tag) {
  const out = document.createElement(tag);
  const copy = src.cloneNode(true);
  copy.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
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

  // body paragraphs (skip duplicated desktop-hidden legal copy, skip conditions link handled below)
  textRoot.querySelectorAll(':scope > p, .offer-ends').forEach((el) => {
    if (el.matches('.desktop-hidden')) return;
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

  // CTA buttons / links
  const ctas = [...textRoot.querySelectorAll('a.btn, a.standalone-link, a.view-details')];
  const seen = new Set();
  ctas.forEach((a) => {
    if (seen.has(a)) return;
    seen.add(a);
    if (!cleanText(a.textContent)) return;
    const p = document.createElement('p');
    const link = ctaLink(document, a);
    if (a.classList.contains('primary') || a.classList.contains('custom-white') || a.matches('.cta-links > a.btn')) {
      const strong = document.createElement('strong');
      strong.append(link);
      p.append(strong);
    } else {
      p.append(link);
    }
    content.push(p);
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
      if (thumb) parts.push(cloneImg(document, thumb));
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
