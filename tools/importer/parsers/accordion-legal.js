/* eslint-disable */
/* global WebImporter */

/**
 * Parser: accordion-legal
 * Sources:
 *  - homepage: section.disclaimer .section-inner (unchanged output)
 *  - other pages: section#disclaimer / section.disclaimer (whole section), the <p> holding
 *    a collapse toggle whose body is a sibling, single .accordion-panel items and
 *    multi-panel .accordion wrappers.
 *
 * One block per collapse toggle.
 * Row 1: toggle label (+ optional summary cell, e.g. .accordion-title-desc).
 * Rows 2+: one row per legal footnote (.table-row#legal-N): the number
 * ("1)") prefixes the first paragraph; loose inline text is wrapped into
 * paragraphs, split at <br> and block children (lists) are kept. Any other
 * collapse body becomes one content row.
 * Intro text next to the toggle stays default content. A collapse body that
 * sits outside the matched element is emptied (not removed) so the catalog's
 * nth-child selectors for later instances still resolve.
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

/** Descend through single-child wrappers. */
function unwrapSingle(el) {
  let node = el;
  while (node.children.length === 1 && !headingTag(node.children[0]) && !/^(P|UL|OL|TABLE|IMG|A)$/.test(node.children[0].tagName)
    && !cleanText([...node.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(''))) {
    node = node.children[0];
  }
  return node;
}
// ---- end shared helpers ----

const LEGAL_BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

/**
 * The toggle has two identical spans (closed/open state). The importer's
 * inline-element review merges adjacent spans into one before parsers run,
 * so the label can arrive as "LabelLabel": collapse an exact repeat.
 */
function dedupeLabel(text) {
  const t = cleanText(text);
  for (let n = 1; n <= 3; n += 1) {
    // "Label" + optional whitespace + "Label"
    const half = (t.length - (n - 1)) / 2;
    if (half >= 1 && Number.isInteger(half)) {
      const a = t.slice(0, half);
      const b = t.slice(t.length - half);
      if (a === b && !cleanText(t.slice(half, t.length - half))) return a.trim();
    }
  }
  return t;
}

/** Convert mixed inline/block children into a list of block elements. */
function legalBlocks(document, cell) {
  const out = [];
  let para = null;
  const flush = () => {
    if (para && cleanText(para.textContent)) out.push(para);
    para = null;
  };
  [...cell.childNodes].forEach((node) => {
    if (node.nodeType === 3) {
      if (!node.textContent.trim() && !para) return;
      if (!para) para = document.createElement('p');
      para.append(node.textContent.replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.matches('.offscreen, .sr-only')) return;
    if (node.tagName === 'BR') {
      flush();
      return;
    }
    if (LEGAL_BLOCK_TAGS.has(node.tagName)) {
      flush();
      if (node.tagName === 'DIV') {
        out.push(...legalBlocks(document, node));
      } else if (cleanText(node.textContent) || node.querySelector('img')) {
        out.push(node.cloneNode(true));
      }
      return;
    }
    if (!para) para = document.createElement('p');
    para.append(node.cloneNode(true));
  });
  flush();
  // trim leading/trailing whitespace inside paragraphs
  out.forEach((el) => {
    if (el.tagName !== 'P') return;
    const first = el.firstChild;
    if (first && first.nodeType === 3) first.textContent = first.textContent.replace(/^\s+/, '');
    const last = el.lastChild;
    if (last && last.nodeType === 3) last.textContent = last.textContent.replace(/\s+$/, '');
  });
  return out;
}

/** Footnote rows (.table-wpr > .table-row) -> one cell row each. */
function footnoteRows(document, scope) {
  const cells = [];
  [...scope.querySelectorAll('.table-wpr > .table-row')].forEach((row) => {
    const [numCell, textCell] = [...row.querySelectorAll(':scope > .table-cell')];
    const num = cleanText(numCell && (numCell.querySelector('.disclaimer') || numCell).textContent
      .replace(/legal disclaimer/i, ''));
    const content = legalBlocks(document, textCell || row);
    if (!content.length && !num) return;
    if (num) {
      if (content[0] && content[0].tagName === 'P') {
        content[0].prepend(`${num} `);
      } else {
        const p = document.createElement('p');
        p.textContent = num;
        content.unshift(p);
      }
    }
    cells.push([content]);
  });
  return cells;
}

function toggleLabel(toggle) {
  const span = toggle.querySelector('span:not(.offscreen):not(.sr-only)');
  if (span && toggle.querySelectorAll(':scope > span').length >= 2) return dedupeLabel(span.textContent);
  const clone = toggle.cloneNode(true);
  clone.querySelectorAll('.accordion-title-desc, .offscreen, .sr-only, p').forEach((n) => n.remove());
  const label = dedupeLabel(clone.textContent) || dedupeLabel(toggle.textContent);
  // merged open/closed state labels: "View Legal Disclaimers Hide Legal Disclaimers"
  const m = label.match(/^(.+?)(?:\s+|(?<=[a-z\u00e0-\u00ff]))(Hide|Masquer|Cacher|Fermer)\b/);
  return m ? m[1] : label;
}

function toggleTarget(document, toggle, element) {
  const ref = toggle.getAttribute('data-target') || toggle.getAttribute('aria-controls')
    || (toggle.getAttribute('href') || '').replace(/^[^#]*/, '');
  const id = (ref || '').replace(/^#/, '');
  let target = null;
  if (id) {
    try { target = element.querySelector(`#${CSS.escape(id)}`); } catch (e) { target = null; }
    if (!target) target = document.getElementById(id);
  }
  if (!target) {
    let n = toggle.closest('p') || toggle;
    while (n && !n.nextElementSibling && n !== element) n = n.parentElement;
    const next = n && n.nextElementSibling;
    if (next && next.matches('.collapse-content, .collapse, [role="region"]')) target = next;
  }
  return target;
}

const TOGGLE_SEL = '.collapse-toggle, [data-toggle="collapse"], button[aria-controls], .disclaimer-btn';

export default function parse(element, { document }) {
  const variants = resolveVariants(element, []);
  const toggles = [...element.querySelectorAll(TOGGLE_SEL)].filter((t, i, all) => !all.some((o) => o !== t && o.contains(t)));

  // no toggle: a footnote list or plain legal text
  if (!toggles.length) {
    const cells = [['Legal disclaimers']];
    const rows = footnoteRows(document, element);
    if (rows.length) cells.push(...rows);
    else {
      const content = toBlocks(document, element);
      if (!content.length) return;
      const first = content[0];
      if (content.length > 1 && /^H[1-6]$/.test(first.tagName)) cells[0] = [cleanText(first.textContent)];
      cells.push([content.slice(cells[0][0] === 'Legal disclaimers' ? 0 : 1)]);
    }
    makeBlock(document, element, 'accordion-legal', cells, variants);
    return;
  }

  const blocks = [];
  const used = [];
  toggles.forEach((toggle) => {
    const target = toggleTarget(document, toggle, element);
    const label = toggleLabel(toggle);
    const desc = toggle.querySelector('.accordion-title-desc');
    const cells = [];
    const summary = desc && cleanText(desc.textContent) ? inlineEl(document, 'p', desc) : null;
    cells.push(summary ? [label || 'Legal disclaimers', [summary]] : [label || 'Legal disclaimers']);
    if (target) {
      used.push(target);
      const rows = footnoteRows(document, target);
      if (rows.length) cells.push(...rows.map((r) => (summary ? [...r, ''] : r)));
      else {
        const body = toBlocks(document, target);
        if (body.length) cells.push(summary ? [body, ''] : [body]);
      }
      if (!element.contains(target)) {
        // keep the sibling in place (empty) so later nth-child selectors still match
        target.textContent = '';
      }
    }
    blocks.push(WebImporter.Blocks.createBlock(document, variants.length
      ? { name: 'accordion-legal', variants, cells }
      : { name: 'accordion-legal', cells }));
  });

  // intro / trailing content beside the toggles stays default content
  const scope = unwrapSingle(element);
  const firstToggleIdx = [...scope.children].findIndex((c) => toggles.some((t) => c.contains(t)));
  const pre = [];
  const post = [];
  [...scope.children].forEach((c, i) => {
    if (toggles.some((t) => c.contains(t) || t.contains(c)) || used.some((u) => u === c || c.contains(u) || u.contains(c))) return;
    if (firstToggleIdx >= 0 && i < firstToggleIdx) pre.push(...toBlocks(document, c));
    else post.push(...toBlocks(document, c));
  });
  element.replaceWith(...pre, ...blocks, ...post);
}
