/* eslint-disable */
/* global WebImporter */

/**
 * Parser: columns-resources
 * Sources:
 *  - homepage: #welcome-to-rbc ~ .grid-wpr (three .grid-one-third callouts, legacy path,
 *    variant feature-panels)
 *  - other pages: resource rows - lead column (heading + link list / body copy) followed by
 *    bordered callout cards (.grid-one-third / .col-6 / .grid-half columns); generic
 *    one-cell-per-column rows.
 *
 * Legacy homepage path:
 * One row; one cell per callout panel. Each panel keeps headings, lead text,
 * link lists (consecutive links grouped into a <ul>), a trailing CTA link and
 * a closing image (blocks/columns-resources/columns-resources.js).
 * Icon-list items (ul.icon-list > li > h3 > a.icon-list-*) become
 * <li><img icon><h3><a/></h3></li>: the 40x40 ::before icon as a real image
 * (block tags such lists columns-resources-icon-list) and the h3 kept.
 * SVG icon URLs get a "#icon" fragment so html2md keeps them as images.
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

const HIDDEN_SEL = '.slick-cloned, .sr-only, .offscreen, .visually-hidden, .show-for-sr, .screen-reader-text, .sr-text, script, style, noscript, template, svg, button, input, textarea, iframe, video, audio, canvas, object, embed, [role="tooltip"], .tooltip-content, .modal, [role="dialog"]';

const TOGGLE_LIKE = '.collapse-toggle, [data-toggle="collapse"], button[aria-controls][aria-expanded], .accordion-toggle';

const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD', 'HR', 'FORM', 'FIELDSET', 'PICTURE', 'IMG', 'ADDRESS', 'PRE', 'CENTER']);

const KEEP_INLINE = new Set(['A', 'STRONG', 'B', 'EM', 'I', 'U', 'SUP', 'SUB', 'BR', 'CODE', 'S', 'DEL', 'SMALL']);

const BG_HOLDER_RE = /(banner|hero|bg|img|image|photo|picture|background)/i;

const BG_ATTR_SEL = '[style*="url("], [data-bg], [data-background], [data-bg-src], [data-img], [data-img-defer], [data-image], [data-bg-img]';

/**
 * Background image of one element: the first url() of an inline background /
 * background-image style, then data-bg* / data-img attributes (RBC's script
 * turns data-img into the background; below the fold it waits in
 * data-img-defer until scrolled into view), then, on the live DOM, the
 * computed background-image of a text-free image holder (class like *-img,
 * bg, banner). Computed SVG backgrounds and UI glyphs (icons, energy lines)
 * are decorative and ignored. URLs may be relative: makeImg resolves them.
 */
function bgUrl(el) {
  if (!el || !el.getAttribute) return '';
  const st = el.getAttribute('style') || '';
  const m = st.match(/background(?:-image)?\s*:[^;]*?url\(\s*(['"]?)(.*?)\1\s*\)/i);
  if (m && m[2] && !m[2].startsWith('data:')) return m[2];
  const data = el.getAttribute('data-bg') || el.getAttribute('data-background') || el.getAttribute('data-bg-src') || '';
  if (data && !data.startsWith('data:')) return data;
  const img = el.getAttribute('data-img') || el.getAttribute('data-img-defer') || el.getAttribute('data-image') || el.getAttribute('data-bg-img') || '';
  if (img && !img.startsWith('data:') && /\.(jpe?g|png|webp|gif|avif|svg)(\?|#|$)/i.test(img) && !isDecorativeSrc(img)) return img;
  if (BG_HOLDER_RE.test(typeof el.className === 'string' ? el.className : '') && !cleanText(el.textContent) && !(el.querySelector && el.querySelector('img'))) {
    try {
      const win = el.ownerDocument && el.ownerDocument.defaultView;
      if (win && win.getComputedStyle && el.isConnected) {
        const c = (win.getComputedStyle(el).backgroundImage || '').match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
        if (c && c[2] && !c[2].startsWith('data:') && !/\.svg(\?|#|$)/i.test(c[2]) && !isDecorativeSrc(c[2])) return c[2];
      }
    } catch (e) { /* no computed styles */ }
  }
  return '';
}

const MOBILE_BG_SEL = '.mobile-only, .show-mobile, .visible-xs, .mob-only, .hidden-md, .hidden-lg, .desktop-hidden, .banner-img-mobile, [class*="img-mobile"], [class*="mobile-img"], [class*="bg-mobile"], [class*="mobile-bg"]';

/** A background holder only shown on small screens (the desktop copy carries the image). */
function isMobileBg(n) {
  if (!n || !n.matches) return false;
  if (n.matches(MOBILE_BG_SEL)) return true;
  try {
    const win = n.ownerDocument && n.ownerDocument.defaultView;
    return !!(win && win.getComputedStyle && n.isConnected && win.getComputedStyle(n).display === 'none');
  } catch (e) { return false; }
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

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i;

/**
 * URL of the source page, used to resolve relative image paths. The document
 * base (honours <base href>) or live location wins; behind a local proxy
 * (localhost) fall back to the page's canonical / og:url.
 */
function pageUrl(document) {
  const candidates = [document.baseURI];
  try { candidates.push(document.defaultView && document.defaultView.location && document.defaultView.location.href); } catch (e) { /* no window */ }
  const canon = document.querySelector('link[rel="canonical"][href], meta[property="og:url"][content]');
  if (canon) candidates.push(canon.getAttribute('href') || canon.getAttribute('content'));
  const ok = candidates.filter(Boolean).map((c) => { try { return new URL(c); } catch (e) { return null; } })
    .filter((u) => u && /^https?:$/.test(u.protocol));
  const remote = ok.find((u) => !LOCAL_HOST_RE.test(u.hostname));
  return (remote || ok[0] || { href: '' }).href;
}

/**
 * Absolute URL against the source page; proxied localhost URLs get the page
 * origin. The importer's adjustImageUrls drops any <img> whose src is relative
 * without ./ / or ../ (e.g. "_assets-custom/x.jpg"), so every image is resolved here.
 */
function absolute(src, document) {
  if (!src || /^(data|blob):/i.test(src)) return src;
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

/** New <img> (absolute src); SVGs get a "#icon" fragment so html2md keeps them as real images. */
function makeImg(document, rawSrc, alt) {
  if (!rawSrc) return null;
  const src = absolute(rawSrc, document);
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

// hidden widget UI: compare-tray toggles ("Compare"/"Added"), hidden text placeholders
const HIDDEN_UI_SEL = 'p[hidden], span[hidden], a[hidden], img[hidden], .btn-compare, .compare-card-button';

function isHidden(el) {
  if (!el.matches) return false;
  // tooltip triggers wrap a visible term: keep the term
  if (el.matches('button.tooltip-trigger') && cleanText(el.textContent)) return false;
  if (el.matches(HIDDEN_SEL) || el.matches(HIDDEN_UI_SEL)) return true;
  // unfilled JS template output
  return el.childElementCount <= 1 && cleanText(el.textContent) === 'undefined';
}

/** Struck-through text (old prices): <s>/<del>, strike classes, inline or computed line-through. */
function isStruck(el) {
  if (/^(S|DEL|STRIKE)$/.test(el.tagName)) return true;
  if (/(^|\s)(strike|strikethrough|strike-through|line-through|text-strike|text-line-through)(\s|$)/i.test(typeof el.className === 'string' ? el.className : '')) return true;
  if (/text-decoration(?:-line)?\s*:[^;]*line-through/i.test(el.getAttribute('style') || '')) return true;
  try {
    const win = el.ownerDocument && el.ownerDocument.defaultView;
    return !!(win && win.getComputedStyle && el.isConnected && /line-through/.test(win.getComputedStyle(el).textDecorationLine || ''));
  } catch (e) { return false; }
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
      // collapse whitespace but keep non-breaking spaces ("1\u00a0500\u00a0$")
      const t = child.textContent.replace(/[^\S\u00a0]+/g, ' ');
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
      // javascript: and bare "#" links (modal openers such as an "Offer" pill) keep only their text
      if (!href || href === '#' || /^javascript:/i.test(href)) { appendInline(document, child, out); return; }
      const a = document.createElement('a');
      a.setAttribute('href', href);
      const cls = [...child.classList].filter((c) => ['btn', 'primary', 'secondary'].includes(c));
      if (cls.includes('btn')) a.className = cls.join(' ');
      if (child.getAttribute('title')) a.title = child.getAttribute('title');
      appendInline(document, child, a);
      if (cleanText(a.textContent) || a.querySelector('img')) out.append(a);
      return;
    }
    if (tag !== 'A' && isStruck(child)) {
      const del = document.createElement('del');
      appendInline(document, child, del);
      if (cleanText(del.textContent)) out.append(del);
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
    || (el.nodeType === 1 && bgUrl(el)) || (el.querySelector && [...el.querySelectorAll(BG_ATTR_SEL)].some((n) => bgUrl(n)))));
}

/** Drop image-only .mobile-only duplicates of desktop media. */
function dropMobileDuplicates(root) {
  root.querySelectorAll('.desktop-hidden').forEach((m) => {
    if (m.parentElement && m.parentElement.querySelector(':scope > .desktop-only')) m.remove();
  });
  root.querySelectorAll('.mobile-only').forEach((m) => {
    if (!cleanText(m.textContent) && root.querySelector('.desktop-only')) m.remove();
    else if (!cleanText(m.textContent) && !m.querySelector('img') && !bgUrl(m)) m.remove();
  });
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
  // invalid markup: loose text / inline runs straight inside the list (an offer line
  // "Get up to <strong>70,000 points</strong><sup>1</sup> ...") become one item each
  const kids = [];
  let run = null;
  [...list.childNodes].forEach((n) => {
    const inline = (n.nodeType === 3 && n.textContent.trim()) || (n.nodeType === 1 && n.tagName !== 'LI' && !isBlockish(n) && !isHidden(n));
    if (inline || (run && n.nodeType === 3)) {
      if (!run) { run = document.createElement('span'); kids.push(run); }
      run.append(n.cloneNode(true));
      return;
    }
    run = null;
    if (n.nodeType === 1) kids.push(n);
  });
  kids.forEach((li) => {
    if (isHidden(li)) return;
    if (li.tagName !== 'LI') {
      // invalid markup: <p>/<div> straight inside a list, e.g. a "View more" toggle
      // followed by a collapsible <div> holding the remaining items
      if (li.matches(TOGGLE_LIKE)) return;
      const rest = li.cloneNode(true);
      rest.querySelectorAll(TOGGLE_LIKE).forEach((t) => t.remove());
      if (!cleanText(rest.textContent) && !rest.querySelector('img')) return;
      const nested = [...li.querySelectorAll('ul, ol')].filter((l) => !l.parentElement.closest('ul, ol') || !li.contains(l.parentElement.closest('ul, ol')));
      if (nested.length) {
        nested.forEach((l) => out.append(...buildList(document, l).children));
        return;
      }
      const item = trimNode(appendInline(document, rest, document.createElement('li')));
      if (hasContent(item)) out.append(item);
      return;
    }
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
  let bodyStarted = false;
  table.querySelectorAll('tr').forEach((tr) => {
    if (tr.closest('table') !== table) return;
    const row = document.createElement('tr');
    const srcCells = [...tr.children].filter((c) => /^T[HD]$/.test(c.tagName));
    // a header-only row after body rows is a section label (e.g. a collapsible
    // <tbody> toggle); kept as <th> it would be hoisted into the table head
    const allTh = srcCells.length && srcCells.every((c) => c.tagName === 'TH');
    const sectionRow = allTh && bodyStarted;
    if (!allTh) bodyStarted = true;
    srcCells.forEach((c) => {
      const cell = document.createElement(sectionRow ? 'td' : c.tagName.toLowerCase());
      if (c.getAttribute('colspan')) cell.setAttribute('colspan', c.getAttribute('colspan'));
      if (c.getAttribute('rowspan')) cell.setAttribute('rowspan', c.getAttribute('rowspan'));
      // yes/no glyph images (ui-checkmark / ui-close) carry the cell's meaning: text marks
      const src = c.cloneNode(true);
      src.querySelectorAll('img').forEach((img) => {
        const s = img.getAttribute('src') || '';
        if (!/checkmark|check-mark|ui-close|ui-x\b/i.test(s)) return;
        img.replaceWith(document.createTextNode(/check/i.test(s) ? '\u2713' : '\u2717'));
      });
      const parts = toBlocks(document, src);
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
  const seenBg = new Set(); // a holder and its child often repeat the same background
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
        para.append(document.createTextNode(n.textContent.replace(/[^\S\u00a0]+/g, ' ')));
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
      const bg = opts.noBg || isMobileBg(n) ? '' : bgUrl(n);
      if (bg && !seenBg.has(bg)) { seenBg.add(bg); addImg(makeImg(document, bg, n.getAttribute('aria-label') || '')); }
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
        if (target && href && href !== '#' && !/^javascript:/i.test(href)) {
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
  if (root.nodeType === 1 && bgUrl(root) && !opts.noBg && !opts.noRootBg) { seenBg.add(bgUrl(root)); addImg(makeImg(document, bgUrl(root), '')); }
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

/** Descend through single-child wrappers. */
function unwrapSingle(el) {
  let node = el;
  while (node.children.length === 1 && !headingTag(node.children[0]) && !/^(P|UL|OL|TABLE|IMG|A)$/.test(node.children[0].tagName)
    && !cleanText([...node.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(''))) {
    node = node.children[0];
  }
  return node;
}

function isHeadingLike(el) {
  if (headingTag(el)) return true;
  if (!el.classList) return false;
  return [...el.classList].some((c) => /^h[1-6]$/.test(c)) && cleanText(el.textContent).length < 160;
}

function hasHeading(el) {
  if (isHeadingLike(el)) return true;
  return !!el.querySelector('h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6, p > strong:first-child, p.text-bold, .title, [class*="title"]');
}

/** Replace element with the block table, keeping intro/outro content around it. */
function replaceWithBlock(document, element, name, cells, variants, before = [], after = []) {
  const opts = { name, cells };
  if (variants && variants.length) opts.variants = variants;
  const block = WebImporter.Blocks.createBlock(document, opts);
  const pre = before.flatMap((n) => toBlocks(document, n));
  const post = after.flatMap((n) => toBlocks(document, n));
  element.replaceWith(...pre, block, ...post);
  return block;
}

/** Convert source cell elements to block cells, dropping empty cells/rows; keeps the sources. */
function finishRows(document, srcRows, before, after) {
  const rows = [];
  const sources = [];
  srcRows.forEach((r) => {
    const cells = [];
    const srcs = [];
    r.forEach((c) => {
      const b = toBlocks(document, c);
      if (b.length) { cells.push(b); srcs.push(c); }
    });
    if (cells.length) { rows.push(cells); sources.push(srcs); }
  });
  return { rows, sources, before, after };
}

function columnRows(document, element) {
  const node = unwrapSingle(element);
  const tableRows = node.matches('.table-row') ? [node] : [...node.querySelectorAll(':scope > .table-row')];
  if (tableRows.length) {
    const src = tableRows.map((r) => [...r.children].filter((c) => !isHidden(c)));
    return finishRows(document, src, [], []);
  }
  const isCol = (k) => !isHidden(k) && hasContent(k) && !k.matches('.divider');
  const kids = [...node.children].filter(isCol);
  const isDirect = (k) => !!headingTag(k) || ['P', 'UL', 'OL', 'TABLE', 'A', 'SPAN', 'IMG', 'BR', 'STRONG', 'EM', 'B'].includes(k.tagName);
  const colsOf = (k) => [...unwrapSingle(k).children].filter(isCol);
  const direct = kids.filter(isDirect);
  if (direct.length === kids.length) {
    return finishRows(document, [[node]], [], []);
  }
  if (!direct.length && kids.length >= 2) {
    // several row wrappers (each a multi-column grid) or one row of columns
    const multi = kids.filter((k) => colsOf(k).length >= 2 && !hasHeading(k.firstElementChild ? k : k));
    const rowLike = kids.filter((k) => colsOf(k).length >= 2 && colsOf(k).every((c) => !isDirect(c)));
    if (rowLike.length >= 2 && rowLike.length === kids.length && kids.every((k) => k.className && k.className === kids[0].className)) {
      return finishRows(document, kids.map((k) => colsOf(k)), [], []);
    }
    void multi;
    return finishRows(document, [kids], [], []);
  }
  if (kids.length < 2) return finishRows(document, [[node]], [], []);
  // intro heading/text around one or more nested column wrappers
  const rowIdx = kids.map((k, i) => (!isDirect(k) && colsOf(k).length >= 2 && colsOf(k).filter((c) => !isDirect(c)).length >= 2 ? i : -1)).filter((i) => i >= 0);
  if (!rowIdx.length) return finishRows(document, [kids], [], []);
  const first = rowIdx[0];
  const last = rowIdx[rowIdx.length - 1];
  const src = kids.slice(first, last + 1).map((k) => (rowIdx.includes(kids.indexOf(k)) ? colsOf(k) : [k]));
  return finishRows(document, src, kids.slice(0, first), kids.slice(last + 1));
}

/** Pad rows to the same cell count. */
function padRows(rows) {
  const max = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => (r.length < max ? [...r, ...Array(max - r.length).fill('')] : r));
}
// ---- end shared helpers ----

function makeLink(document, a) {
  const link = document.createElement('a');
  link.href = a.getAttribute('href');
  link.textContent = cleanText(a.textContent);
  return link;
}

// Product-link icons are CSS ::before backgrounds on a.icon-list-* (see source CSS).
// Fallback map for DOMs without computed styles (e.g. cached HTML / jsdom).
const ICON_BASE = 'https://www.rbcroyalbank.com';
const ICON_MAP = {
  l_account: '/_assets-custom/homepage/images/cash-new-40.svg',
  l_mortgage: '/dvl/v0.1/assets/images/icons/icon-mortgages.svg',
  l_loan: '/dvl/v0.1/assets/images/icons/icon-loans.svg',
  l_loan2: '/dvl/v0.1/assets/images/icons/icon-loans.svg',
  l_investing: '/dvl/v0.1/assets/images/icons/icon-investments.svg',
  l_credit: '/dvl/v0.1/assets/images/icons/icon-credit-cards.svg',
  'l_credit-card': '/dvl/v0.1/assets/images/icons/icon-credit-cards.svg',
};

function iconUrl(document, li, a) {
  // 1. live page: computed ::before background-image
  try {
    const win = document.defaultView;
    if (win && win.getComputedStyle) {
      const bi = win.getComputedStyle(a, '::before').backgroundImage || '';
      const m = bi.match(/url\(["']?([^"')]+)["']?\)/);
      if (m && m[1]) return new URL(m[1], document.baseURI || ICON_BASE).href;
    }
  } catch (e) { /* no computed styles */ }
  // 2. known icon classes (a.icon-list-<key>, li#<key>)
  const cls = [...a.classList].find((c) => c.startsWith('icon-list-'));
  const key = cls ? cls.slice('icon-list-'.length) : '';
  const path = ICON_MAP[key] || ICON_MAP[li.id];
  return path ? `${ICON_BASE}${path}` : '';
}

function buildPanel(document, panel) {
  const out = [];
  const copy = panel.querySelector('.callout-copy') || panel;
  let list = null;

  const flushList = () => {
    if (list && list.children.length) out.push(list);
    list = null;
  };
  const addListLink = (a, srcLi) => {
    if (!cleanText(a.textContent)) return;
    if (!list) list = document.createElement('ul');
    const li = document.createElement('li');
    // icon list item (ul.icon-list > li > h3 > a.icon-list-*): icon <img> + heading link
    const src = srcLi && srcLi.closest('ul.icon-list') ? iconUrl(document, srcLi, a) : '';
    if (src) {
      const img = document.createElement('img');
      // html2md turns any <img src="*.svg"> into a :name: icon shorthand (needs /icons/*.svg);
      // a fragment keeps it a real image without changing the fetched resource.
      img.src = /\.svg$/i.test(src) ? `${src}#icon` : src;
      img.alt = '';
      li.append(img);
    }
    const heading = srcLi && srcLi.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
    if (heading && heading.contains(a)) {
      const h = document.createElement(heading.tagName.toLowerCase());
      h.append(makeLink(document, a));
      li.append(h);
    } else {
      li.append(makeLink(document, a));
    }
    list.append(li);
  };

  const walk = (node) => {
    [...node.children].forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        flushList();
        if (!cleanText(el.textContent)) return;
        const h = document.createElement(tag);
        h.textContent = cleanText(el.textContent);
        out.push(h);
      } else if (tag === 'p') {
        flushList();
        if (!cleanText(el.textContent)) return;
        const p = document.createElement('p');
        [...el.cloneNode(true).childNodes].forEach((n) => p.append(n));
        out.push(p);
      } else if (tag === 'ul' || tag === 'ol') {
        flushList();
        el.querySelectorAll(':scope > li').forEach((li) => {
          const a = li.querySelector('a');
          if (a) addListLink(a, li);
        });
        flushList();
      } else if (tag === 'a') {
        addListLink(el);
      } else {
        walk(el);
      }
    });
  };
  walk(copy);
  flushList();

  // A single trailing-link list (e.g. "Learn More") reads better as a CTA paragraph.
  const last = out[out.length - 1];
  if (last && last.tagName === 'UL' && last.children.length === 1) {
    const p = document.createElement('p');
    p.append(last.querySelector('a'));
    out[out.length - 1] = p;
  }

  // footer CTA outside the copy (e.g. "View all")
  panel.querySelectorAll('.callout-link a').forEach((a) => {
    if (!cleanText(a.textContent)) return;
    const p = document.createElement('p');
    p.append(makeLink(document, a));
    out.push(p);
  });

  // closing image
  panel.querySelectorAll('.callout-img img').forEach((img) => {
    const out2 = document.createElement('img');
    out2.src = img.getAttribute('src');
    out2.alt = img.getAttribute('alt') || '';
    const p = document.createElement('p');
    p.append(out2);
    out.push(p);
  });

  return out;
}

function isHomepagePanels(element) {
  const prev = element.parentElement && element.parentElement.querySelector('#welcome-to-rbc');
  return !!prev || !!element.querySelector('ul.icon-list');
}

export default function parse(element, { document }) {
  if (!isHomepagePanels(element)) {
    // generic: one row; lead column + bordered cards (one cell per source column)
    const variants = resolveVariants(element, []);
    dropMobileDuplicates(element);
    const { rows, before, after } = columnRows(document, element);
    if (!rows.length) return;
    replaceWithBlock(document, element, 'columns-resources', padRows(rows), variants, before, after);
    return;
  }

  const panels = [...element.querySelectorAll(':scope > .grid-one-third')];
  const row = panels
    .map((col) => buildPanel(document, col.querySelector('.callout') || col))
    .filter((content) => content.length);

  const cells = row.length ? [row] : [];
  const block = WebImporter.Blocks.createBlock(document, {
    name: 'columns-resources',
    variants: resolveVariants(element, ['feature-panels']),
    cells,
  });
  element.replaceWith(block);
}
