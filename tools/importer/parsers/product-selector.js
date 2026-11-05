/* eslint-disable */
/* global WebImporter */

/**
 * Parser: product-selector
 * Sources: RBC selectors - account selection panels (.account-selection-wpr: intro, option
 * cards .snl-selection / .vip-selection, detail blocks .snl-account-block ...), graphic
 * radio pickers (credit-card selector: legend + radio labels + tooltip text), tool
 * question steps.
 *
 * Captures authorable content; the block JS builds the controls.
 * Rows: intro (heading + text) | optional question (legend) | one row per option:
 * option label (icon, text, fee) | detail panel (name, price, features, CTA) | optional
 * final CTA link row. Details are paired with options by order. Markup without any
 * choosable option (bare sliders) is left as default content.
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

const OPTION_SEL = '[class*="-selection"]:not([class*="-selection-wpr"]), .option-card, .choice, .selector-option';
const DETAIL_SEL = '[class*="account-block"], .option-detail, .detail-panel, [class*="-details-panel"]';

export default function parse(element, { document }) {
  const variants = resolveVariants(element, []);
  element.querySelectorAll('.irs, .lottie, .tooltip-component > button').forEach((n) => n.remove());

  const rows = [];
  let options = [...element.querySelectorAll(OPTION_SEL)].filter((n, i, all) => !all.some((o) => o !== n && o.contains(n)));
  let details = [...element.querySelectorAll(DETAIL_SEL)].filter((n, i, all) => !all.some((o) => o !== n && o.contains(n)));
  const radios = [...element.querySelectorAll('input[type="radio"], input[type="checkbox"]')];

  let optionRows = [];
  if (options.length) {
    optionRows = options.map((o, i) => {
      const label = toBlocks(document, o);
      const detail = details[i] ? toBlocks(document, details[i]) : [];
      return detail.length ? [label, detail] : [label];
    });
  } else if (radios.length) {
    options = radios.map((r) => r.closest('.button-img-container, .radio-tooltip, .option, label, div') || r);
    optionRows = radios.map((r) => {
      let label = null;
      if (r.id) { try { label = element.querySelector(`label[for="${CSS.escape(r.id)}"]`); } catch (e) { label = null; } }
      label = label || r.closest('label');
      const text = label ? cleanText(label.textContent) : cleanText(r.value || '');
      if (!text) return null;
      const p = document.createElement('p');
      p.textContent = text;
      const container = r.closest('.button-img-container, .radio-tooltip') || r.parentElement;
      const tip = container && container.querySelector('.tooltip-container, .rcc-tooltip, .description, .option-desc');
      const detail = tip ? toBlocks(document, tip) : [];
      return detail.length ? [[p], detail] : [[p]];
    }).filter(Boolean);
  }
  if (!optionRows.length) return; // nothing to choose from

  // intro: content before the first option, outside options/details
  const used = [...options, ...details];
  const legend = element.querySelector('legend');
  const intro = toBlocks(document, element, { skip: [...used, ...(legend ? [legend] : [])], noBg: true });
  // trailing CTA link (outside options/details) becomes the last row
  let cta = null;
  if (intro.length) {
    const last = intro[intro.length - 1];
    if (last.tagName === 'P' && last.querySelectorAll('a').length === 1 && cleanText(last.textContent) === cleanText(last.querySelector('a').textContent)) {
      cta = intro.pop();
    }
  }
  if (intro.length) rows.push([intro]);
  if (legend && cleanText(legend.textContent)) rows.push([cleanText(legend.textContent)]);
  rows.push(...optionRows);
  if (cta) rows.push([[cta]]);

  makeBlock(document, element, 'product-selector', rows, variants);
}
