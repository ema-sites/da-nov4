/* eslint-disable */
/* global WebImporter */

/**
 * Parser: hero-banner
 * Sources: RBC page banners (section.banner.fw-bnr, .lifestyle-banner, .half-banner-container,
 * #banner with background video, .hero-banner, .best-bank-tile-container ...).
 *
 * Row 1 (media, optional): background / feature picture and/or a link to the
 *   banner video (.mp4/.webm).
 * Row 2 (content): heading, text, CTA links (buttons keep their a.btn class
 *   so the cleanup transformer marks them strong/em).
 * Mobile-only duplicates are dropped. Markup without a heading, media or
 * text is left untouched as default content.
 */

// ---- shared rbc helpers (same in every rbc parser) ----
function cleanText(text) {
  return (text || '').replace(/[\s ]+/g, ' ').trim();
}

/**
 * Block variant classes from the catalog. The import script sets
 * data-catalog-variant on each matched element before calling the parser
 * ("" = catalog variant null = no variant class). Without the attribute
 * (homepage import, validator runs) the legacy default applies.
 */
function resolveVariants(element, fallback) {
  if (!element || !element.hasAttribute || !element.hasAttribute('data-catalog-variant')) return fallback || [];
  const v = element.getAttribute('data-catalog-variant');
  return v ? String(v).split(/[\s,]+/).filter(Boolean) : [];
}

function makeBlock(document, element, name, cells, variants) {
  const opts = { name, cells };
  if (variants && variants.length) opts.variants = variants;
  const block = WebImporter.Blocks.createBlock(document, opts);
  element.replaceWith(block);
  return block;
}

const HIDDEN_SEL = '.slick-cloned, .sr-only, .offscreen, .visually-hidden, .show-for-sr, .screen-reader-text, .sr-text, script, style, noscript, template, svg, button, input, textarea, iframe, video, audio, canvas, object, embed, [role="tooltip"], .tooltip-content, .modal, [role="dialog"]';

const TOGGLE_LIKE = '.collapse-toggle, [data-toggle="collapse"], button[aria-controls][aria-expanded], .accordion-toggle';

const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD', 'HR', 'FORM', 'FIELDSET', 'PICTURE', 'IMG', 'ADDRESS', 'PRE', 'CENTER']);

const KEEP_INLINE = new Set(['A', 'STRONG', 'B', 'EM', 'I', 'U', 'SUP', 'SUB', 'BR', 'CODE', 'S', 'DEL', 'SMALL']);

/** First url() of an inline background / background-image style. */
function bgUrl(el) {
  if (!el || !el.getAttribute) return '';
  const st = el.getAttribute('style') || '';
  const m = st.match(/background(?:-image)?\s*:[^;]*?url\(\s*(['"]?)(.*?)\1\s*\)/i);
  if (m && m[2] && !m[2].startsWith('data:')) return m[2];
  const data = el.getAttribute('data-bg') || el.getAttribute('data-background') || el.getAttribute('data-bg-src') || '';
  return data && !data.startsWith('data:') ? data : '';
}

function imgSrc(img) {
  if (!img || !img.getAttribute) return '';
  let src = img.getAttribute('src') || '';
  if (!src || src.startsWith('data:')) {
    src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    if (!src && srcset) src = srcset.split(',')[0].trim().split(/\s+/)[0];
  }
  if (!src) {
    const source = img.closest && img.closest('picture') && img.closest('picture').querySelector('source[srcset]');
    if (source) src = source.getAttribute('srcset').split(',')[0].trim().split(/\s+/)[0];
  }
  return src && !src.startsWith('data:') ? src : '';
}

/** New <img>; SVGs get a "#icon" fragment so html2md keeps them as real images. */
function makeImg(document, src, alt) {
  if (!src) return null;
  const img = document.createElement('img');
  img.src = /\.svg(\?.*)?$/i.test(src) && !src.includes('#') ? `${src}#icon` : src;
  img.alt = cleanText(alt || '');
  return img;
}

/** Decorative UI glyphs (chevrons, external-link arrows) that the block CSS redraws. */
function isDecorativeSrc(src) {
  return /\/images\/ui\/|chevron|ui-arrow|icon-external|external-link|new-window|spacer\.gif|pixel\.gif/i.test(src || '');
}

function cloneImg(document, img) {
  if (isDecorativeSrc(imgSrc(img))) return null;
  return makeImg(document, imgSrc(img), img.getAttribute('alt') || img.getAttribute('title') || '');
}

function isHidden(el) {
  if (!el.matches) return false;
  // tooltip triggers wrap a visible term: keep the term
  if (el.matches('button.tooltip-trigger') && cleanText(el.textContent)) return false;
  return el.matches(HIDDEN_SEL);
}

/** Fix RBC footnote/legal links: javascript:/empty href + data-target -> #anchor. */
function fixHref(a) {
  let href = a.getAttribute('href') || '';
  const target = a.getAttribute('data-target') || '';
  if ((!href || href === '#' || /^javascript:/i.test(href)) && /^#[\w-]+$/.test(target)) href = target;
  return href;
}

/** Copy inline content of `node` into `out`, keeping links, emphasis and images. */
function appendInline(document, node, out) {
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === 3) {
      const t = child.textContent.replace(/[\s ]+/g, ' ');
      if (t) out.append(document.createTextNode(t));
      return;
    }
    if (child.nodeType !== 1) return;
    // a modal/tooltip trigger button inside running text: keep its words
    if (child.tagName === 'BUTTON' && cleanText(child.textContent) && cleanText(node.textContent) !== cleanText(child.textContent)) {
      const span = child.cloneNode(true);
      span.querySelectorAll('.offscreen, .sr-only, .trigger-icon').forEach((n) => n.remove());
      out.append(document.createTextNode(` ${cleanText(span.textContent)} `.replace(/^ /, '')));
      return;
    }
    if (isHidden(child)) return;
    const tag = child.tagName;
    if (tag === 'IMG') {
      const img = cloneImg(document, child);
      if (img) out.append(img);
      return;
    }
    if (tag === 'PICTURE') {
      const img = child.querySelector('img');
      if (img) { const c = cloneImg(document, img); if (c) out.append(c); }
      return;
    }
    if (tag === 'BR') { out.append(document.createElement('br')); return; }
    if (tag === 'A') {
      const href = fixHref(child);
      if (!href || /^javascript:/i.test(href)) { appendInline(document, child, out); return; }
      const a = document.createElement('a');
      a.setAttribute('href', href);
      const cls = [...child.classList].filter((c) => ['btn', 'primary', 'secondary'].includes(c));
      if (cls.includes('btn')) a.className = cls.join(' ');
      if (child.getAttribute('title')) a.title = child.getAttribute('title');
      appendInline(document, child, a);
      if (cleanText(a.textContent) || a.querySelector('img')) out.append(a);
      return;
    }
    if (tag === 'SPAN' && (/(^|\s)(bold|text-bold|font-bold|fw-bold|roboto-bold|rbc-bold|semibold|fw-[5-9]00)(\s|$)/.test(child.className || '')
      || /font-weight:\s*(bold|[6-9]00)/.test(child.getAttribute('style') || ''))) {
      const el = document.createElement('strong');
      appendInline(document, child, el);
      if (cleanText(el.textContent)) out.append(el);
      return;
    }
    if (KEEP_INLINE.has(tag)) {
      const map = { B: 'strong', I: 'em' };
      const el = document.createElement((map[tag] || tag).toLowerCase());
      appendInline(document, child, el);
      if (cleanText(el.textContent) || el.querySelector('img')) out.append(el);
      else if (el.textContent) out.append(document.createTextNode(' '));
      return;
    }
    // span, font, label, div used inline, ...: unwrap
    appendInline(document, child, out);
  });
  return out;
}

/** Trim leading/trailing whitespace and <br> inside a block element. */
function trimNode(el) {
  while (el.firstChild && ((el.firstChild.nodeType === 3 && !el.firstChild.textContent.trim()) || el.firstChild.tagName === 'BR')) el.firstChild.remove();
  while (el.lastChild && ((el.lastChild.nodeType === 3 && !el.lastChild.textContent.trim()) || el.lastChild.tagName === 'BR')) el.lastChild.remove();
  if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = el.firstChild.textContent.replace(/^\s+/, '');
  if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = el.lastChild.textContent.replace(/\s+$/, '');
  return el;
}

function hasContent(el) {
  return !!(el && (cleanText(el.textContent) || (el.querySelector && el.querySelector('img'))
    || (el.nodeType === 1 && bgUrl(el)) || (el.querySelector && [...el.querySelectorAll('[style*="url("]')].some((n) => bgUrl(n)))));
}

function inlineEl(document, tag, src) {
  const el = trimNode(appendInline(document, src, document.createElement(tag)));
  return hasContent(el) ? el : null;
}

function isBlockish(el) {
  if (BLOCK_TAGS.has(el.tagName)) return true;
  return !!(el.querySelector && el.querySelector('p, div, h1, h2, h3, h4, h5, h6, ul, ol, table, li, section, dl, blockquote'));
}

function headingTag(el) {
  if (/^H[1-6]$/.test(el.tagName)) return el.tagName.toLowerCase();
  return '';
}

function buildList(document, list) {
  const out = document.createElement(list.tagName === 'OL' ? 'ol' : 'ul');
  [...list.children].forEach((li) => {
    if (li.tagName !== 'LI' || isHidden(li)) return;
    const item = document.createElement('li');
    let first = true;
    [...li.childNodes].forEach((n) => {
      if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
        const sub = buildList(document, n);
        if (sub.children.length) item.append(sub);
        return;
      }
      if (n.nodeType === 1 && isBlockish(n) && !isHidden(n)) {
        const tmp = document.createElement('span');
        const nested = n.querySelector('ul, ol');
        if (nested) {
          // block wrapper holding a nested list: inline text then the sub-list
          const clone = n.cloneNode(true);
          clone.querySelectorAll('ul, ol').forEach((l) => l.remove());
          appendInline(document, clone, tmp);
          if (cleanText(tmp.textContent) || tmp.querySelector('img')) { if (!first) item.append(document.createElement('br')); item.append(...tmp.childNodes); first = false; }
          n.querySelectorAll(':scope ul, :scope ol').forEach((l) => { if (!l.parentElement.closest('ul, ol') || !n.contains(l.parentElement.closest('ul, ol'))) { const sub = buildList(document, l); if (sub.children.length) item.append(sub); } });
          return;
        }
        appendInline(document, n, tmp);
        if (cleanText(tmp.textContent) || tmp.querySelector('img')) {
          if (!first) item.append(document.createElement('br'));
          item.append(...tmp.childNodes);
          first = false;
        }
        return;
      }
      const tmp = document.createElement('span');
      const wrap = document.createElement('span');
      wrap.append(n.cloneNode(true));
      appendInline(document, wrap, tmp);
      if (tmp.childNodes.length) { item.append(...tmp.childNodes); if (cleanText(tmp.textContent)) first = false; }
    });
    trimNode(item);
    if (hasContent(item)) out.append(item);
  });
  return out;
}

function buildTable(document, table) {
  const out = document.createElement('table');
  const tbody = document.createElement('tbody');
  out.append(tbody);
  table.querySelectorAll('tr').forEach((tr) => {
    if (tr.closest('table') !== table) return;
    const row = document.createElement('tr');
    [...tr.children].forEach((c) => {
      if (!/^T[HD]$/.test(c.tagName)) return;
      const cell = document.createElement(c.tagName.toLowerCase());
      if (c.getAttribute('colspan')) cell.setAttribute('colspan', c.getAttribute('colspan'));
      if (c.getAttribute('rowspan')) cell.setAttribute('rowspan', c.getAttribute('rowspan'));
      const parts = toBlocks(document, c);
      if (parts.length === 1 && parts[0].tagName === 'P') cell.append(...parts[0].childNodes);
      else cell.append(...parts);
      row.append(cell);
    });
    if (row.children.length) tbody.append(row);
  });
  return out;
}

/**
 * Convert an element's content into clean block-level nodes (h1-h6, p, ul,
 * ol, table, p>img, hr). Wrappers are flattened, loose inline runs become
 * paragraphs, inline backgrounds become images. opts.skip: elements to omit.
 */
function toBlocks(document, root, opts = {}) {
  const out = [];
  const skip = opts.skip || [];
  let para = null;
  const flush = () => {
    if (para) { trimNode(para); if (hasContent(para)) out.push(para); }
    para = null;
  };
  const addImg = (img) => {
    if (!img) return;
    flush();
    const p = document.createElement('p');
    p.append(img);
    out.push(p);
  };
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        if (!n.textContent.trim() && !para) return;
        if (!para) para = document.createElement('p');
        para.append(document.createTextNode(n.textContent.replace(/[\s ]+/g, ' ')));
        return;
      }
      if (n.nodeType === 1 && !skip.includes(n) && n.matches(TOGGLE_LIKE)) {
        // accordion question: keep its label as a bold paragraph
        flush();
        const clone = n.cloneNode(true);
        clone.querySelectorAll('.accordion-title-desc').forEach((d) => d.remove());
        const strong = inlineEl(document, 'strong', clone);
        if (strong) { const p = document.createElement('p'); p.append(strong); out.push(p); }
        const desc = n.querySelector('.accordion-title-desc');
        if (desc) { const d = inlineEl(document, 'p', desc); if (d) out.push(d); }
        return;
      }
      if (n.nodeType !== 1 || skip.includes(n) || isHidden(n)) return;
      if (isMobileTwin(n)) return;
      if (skip.some((s) => n.contains(s))) {
        walk(n);
        return;
      }
      const tag = n.tagName;
      const bg = bgUrl(n);
      if (bg && !opts.noBg) addImg(makeImg(document, bg, n.getAttribute('aria-label') || ''));
      const h = headingTag(n);
      if (h) {
        flush();
        const el = inlineEl(document, h, n);
        if (el) out.push(el);
        return;
      }
      if (tag === 'P' || tag === 'LABEL' || tag === 'BLOCKQUOTE' || tag === 'ADDRESS' || tag === 'FIGCAPTION' || tag === 'DT' || tag === 'DD' || tag === 'LEGEND' || tag === 'CAPTION') {
        if (n.querySelector('p, div, ul, ol, table, h1, h2, h3, h4, h5, h6')) { flush(); walk(n); flush(); return; }
        flush();
        const el = inlineEl(document, 'p', n);
        if (el) {
          if (tag === 'DT' && !el.querySelector('strong')) { const s = document.createElement('strong'); s.append(...el.childNodes); el.append(s); }
          out.push(el);
        }
        return;
      }
      if (tag === 'UL' || tag === 'OL') {
        flush();
        const list = buildList(document, n);
        if (list.children.length) out.push(list);
        return;
      }
      if (tag === 'TABLE') {
        flush();
        out.push(buildTable(document, n));
        return;
      }
      if (tag === 'HR') { flush(); if (opts.keepHr) out.push(document.createElement('hr')); return; }
      if (tag === 'SELECT') {
        // dropdown: placeholder option as text, real options as a list
        flush();
        const list = document.createElement('ul');
        [...n.querySelectorAll('option')].forEach((o) => {
          const t = cleanText(o.textContent);
          if (!t) return;
          const v = (o.getAttribute('value') || '').trim();
          if (!v || /^(default|0|-1|none|select)$/i.test(v) || o.disabled) {
            if (!list.children.length) { const p = document.createElement('p'); p.textContent = t; out.push(p); }
            return;
          }
          const li = document.createElement('li');
          li.textContent = t;
          list.append(li);
        });
        if (list.children.length) out.push(list);
        return;
      }
      if (tag === 'IMG') {
        const img = cloneImg(document, n);
        if (!img) return;
        // inline icon inside running text stays inline
        if (para && cleanText(para.textContent)) { para.append(img); return; }
        addImg(img);
        return;
      }
      if (tag === 'PICTURE') { const i = n.querySelector('img'); if (i) addImg(cloneImg(document, i)); return; }
      if (tag === 'A' && isBlockish(n)) {
        // card-style link wrapping blocks: keep blocks, link the first heading/para
        const href = fixHref(n);
        const start = out.length;
        flush();
        walk(n);
        flush();
        const target = out.slice(start).find((b) => /^(H[1-6]|P)$/.test(b.tagName) && cleanText(b.textContent) && !b.querySelector('a'));
        if (target && href && !/^javascript:/i.test(href)) {
          const a = document.createElement('a');
          a.setAttribute('href', href);
          a.append(...target.childNodes);
          target.append(a);
        }
        return;
      }
      if (isBlockish(n)) {
        flush();
        walk(n);
        flush();
        return;
      }
      if (!para) para = document.createElement('p');
      const holder = document.createElement('span');
      holder.append(n.cloneNode(true));
      appendInline(document, holder, para);
    });
  };
  if (root.nodeType === 1 && bgUrl(root) && !opts.noBg && !opts.noRootBg) addImg(makeImg(document, bgUrl(root), ''));
  walk(root);
  flush();
  return splitLinkParas(document, out);
}

/** A paragraph holding only two or more links/buttons becomes one paragraph per link. */
function splitLinkParas(document, nodes) {
  const res = [];
  nodes.forEach((n) => {
    if (n.tagName === 'P') {
      const links = [...n.children].filter((c) => c.tagName === 'A');
      const rest = [...n.childNodes].filter((c) => !(c.nodeType === 1 && (c.tagName === 'A' || c.tagName === 'BR')) && cleanText(c.textContent));
      if (!links.length && /^https?:\/\/\S+$/.test(cleanText(n.textContent)) && !n.querySelector('img')) return; // stray URL text
      if (links.length > 1 && !rest.length && links.length === n.children.length - n.querySelectorAll(':scope > br').length) {
        links.forEach((a) => { const p = document.createElement('p'); p.append(a); res.push(p); });
        return;
      }
    }
    res.push(n);
  });
  return res;
}

/** A .mobile-only element repeating a sibling .desktop-only element's text. */
function isMobileTwin(n) {
  if (!n.classList || !n.classList.contains('mobile-only') || !n.parentElement) return false;
  const t = cleanText(n.textContent);
  return [...n.parentElement.children].some((s) => s !== n && s.classList.contains('desktop-only') && cleanText(s.textContent) === t);
}
// ---- end shared helpers ----

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i;

/**
 * URL of the source page, used to resolve relative image paths. The live
 * document location wins; behind a local proxy (localhost) fall back to the
 * page's canonical / og:url, then document.baseURI.
 */
function pageUrl(document) {
  const candidates = [];
  try { candidates.push(document.defaultView && document.defaultView.location && document.defaultView.location.href); } catch (e) { /* no window */ }
  const canon = document.querySelector('link[rel="canonical"][href], meta[property="og:url"][content]');
  if (canon) candidates.push(canon.getAttribute('href') || canon.getAttribute('content'));
  candidates.push(document.baseURI);
  const ok = candidates.filter(Boolean).map((c) => { try { return new URL(c); } catch (e) { return null; } })
    .filter((u) => u && /^https?:$/.test(u.protocol));
  const remote = ok.find((u) => !LOCAL_HOST_RE.test(u.hostname));
  return (remote || ok[0] || { href: '' }).href;
}

/** Absolute URL against the source page; proxied localhost URLs get the page origin. */
function absolute(src, document) {
  if (!src) return src;
  const base = pageUrl(document);
  try {
    const u = new URL(src, base || undefined);
    const page = base ? new URL(base) : null;
    if (page && LOCAL_HOST_RE.test(u.hostname) && !LOCAL_HOST_RE.test(page.hostname)) {
      u.searchParams.delete('host');
      return `${page.origin}${u.pathname}${u.search}${u.hash}`;
    }
    return u.href;
  } catch (e) { return src; }
}

const BG_HOLDER_RE = /(banner|hero|bg|img|image|photo|picture|background)/i;

/**
 * Banner background of one element: inline style / data-bg (bgUrl), then the
 * data-img attribute RBC's script turns into the background, then (live DOM)
 * the computed background-image. Roots always use computed styles;
 * descendants only when they look like an image holder and carry no text,
 * so decorative CSS backgrounds (icons, energy lines) are not picked up.
 */
function heroBgUrl(el, document, isRoot) {
  if (!el || !el.getAttribute) return '';
  const inline = bgUrl(el);
  if (inline) return absolute(inline, document);
  let src = '';
  const data = el.getAttribute('data-img') || el.getAttribute('data-image') || el.getAttribute('data-bg-img') || '';
  if (data && !data.startsWith('data:') && /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(data)) src = data;
  if (!src && (isRoot || (BG_HOLDER_RE.test(el.className || '') && !cleanText(el.textContent)))) {
    try {
      const win = document.defaultView;
      if (win && win.getComputedStyle) {
        const m = (win.getComputedStyle(el).backgroundImage || '').match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
        if (m && m[2] && !m[2].startsWith('data:')) src = m[2];
      }
    } catch (e) { /* no computed styles */ }
  }
  if (!src || isDecorativeSrc(src) || /\.svg(\?|#|$)/i.test(src)) return '';
  return absolute(src, document);
}

function isMobileOnly(n) {
  return !!(n.closest && n.closest('.mobile-only, .show-mobile, .visible-xs, .mob-only'));
}

function findVideo(element) {
  const v = element.querySelector('video');
  if (!v) return null;
  const src = v.getAttribute('src') || (v.querySelector('source[src]') && v.querySelector('source[src]').getAttribute('src')) || v.getAttribute('data-src') || '';
  return src ? { node: v, src, poster: v.getAttribute('poster') || '' } : null;
}

/** Background/feature image: element bg, then descendant bg (desktop first), then a standalone image column. */
function findBackground(element, document) {
  const label = element.querySelector(':scope > .offscreen, :scope > .sr-only, :scope > [role="img"][aria-label]');
  const alt = label ? cleanText(label.getAttribute('aria-label') || label.textContent) : '';
  const rootBg = heroBgUrl(element, document, true);
  if (rootBg) return { src: rootBg, alt, nodes: [] };
  const bgs = [...element.querySelectorAll('*')].map((n) => [n, heroBgUrl(n, document, false)]).filter(([, u]) => u);
  const desktop = bgs.find(([n]) => !/mobile/i.test(n.className || '') && !isMobileOnly(n));
  const pick = desktop || bgs[0];
  if (pick) return { src: pick[1], alt: alt || cleanText(pick[0].getAttribute('aria-label') || ''), nodes: bgs.map(([n]) => n).filter((n) => !cleanText(n.textContent)) };
  // a standalone image column next to the text (split / lifestyle banners)
  const imgs = [...element.querySelectorAll('img')].filter((i) => imgSrc(i) && !isMobileOnly(i) && !isDecorativeSrc(imgSrc(i)));
  for (const img of imgs) {
    let col = img;
    while (col.parentElement && col.parentElement !== element && !cleanText(col.parentElement.textContent)) col = col.parentElement;
    if (!cleanText(col.textContent) && col !== img.parentElement?.closest('p')) {
      const holder = col.parentElement;
      // only a real column: its parent also holds the text column
      if (holder && cleanText(holder.textContent) && !holder.matches('p, a, span, li')) {
        return { src: imgSrc(img), alt: img.getAttribute('alt') || alt, nodes: [col] };
      }
    }
  }
  return null;
}

const BOX_RE = /(^|\s)(bg-[\w-]+|grid-one-fourth|grid-one-third|box|block-wpr|card|offer|contact|drop-shadow|callout)(\s|$)/;

/**
 * Aside cards: a side column next to the heading column (contact box, quote
 * button strip) or a framed box inside the text column holding an image
 * (offer card). Returned in document order.
 */
function findAsides(element, heading) {
  const asides = [];
  if (!heading) return asides;
  let col = heading;
  while (col.parentElement && col.parentElement !== element && col.parentElement.children.length < 2) col = col.parentElement;
  // walk up to the column whose parent is the multi-column row
  let node = heading;
  while (node.parentElement && node.parentElement !== element) {
    const parent = node.parentElement;
    const sibs = [...parent.children].filter((s) => s !== node && cleanText(s.textContent) && !s.matches('.mobile-only'));
    const boxes = sibs.filter((s) => BOX_RE.test(s.className || '') && !s.querySelector('h1, h2, h3, h4, h5, h6'));
    if (boxes.length && sibs.length === boxes.length) { asides.push(...boxes); break; }
    node = parent;
  }
  // framed offer box with an image inside the heading's column
  const scope = heading.parentElement || element;
  [...scope.querySelectorAll(':scope > div')].forEach((d) => {
    if (asides.includes(d) || d.contains(heading)) return;
    const framed = BOX_RE.test(d.className || '') || /background/.test(d.getAttribute('style') || '');
    if (framed && d.querySelector('img') && cleanText(d.textContent)) asides.push(d);
  });
  void col;
  return asides;
}

export default function parse(element, { document }) {
  const variants = resolveVariants(element, []);

  const video = findVideo(element);
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6, .h1, .h2, .h3');
  const asides = findAsides(element, heading);
  // images inside asides belong to the aside, not the background
  const hidden = asides.map((a) => { const c = a.cloneNode(false); a.replaceWith(c); return [a, c]; });
  const bg = findBackground(element, document);
  hidden.forEach(([a, c]) => c.replaceWith(a));
  if (!heading && !video && !bg) return; // not a banner: keep as default content

  const skip = [...element.querySelectorAll('.mobile-only, .banner-img-mobile, .banner-bg-overlay, video'), ...asides];
  if (bg) skip.push(...bg.nodes);
  const content = toBlocks(document, element, { skip, noBg: true, noRootBg: true });
  const asideRows = asides.map((a) => toBlocks(document, a, { noBg: true })).filter((b) => b.length);
  if (!content.length && !bg && !video) return;

  const cells = [];
  const media = [];
  if (bg) {
    const img = makeImg(document, bg.src, bg.alt);
    if (img) media.push(img);
  } else if (video && video.poster) {
    const img = makeImg(document, video.poster, '');
    if (img) media.push(img);
  }
  if (video) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = absolute(video.src, document);
    a.textContent = a.href;
    p.append(a);
    media.push(p);
  }
  if (media.length) cells.push([media]);
  cells.push([content.length ? content : '']);
  asideRows.forEach((r) => cells.push([r]));

  makeBlock(document, element, 'hero-banner', cells, variants);
}
