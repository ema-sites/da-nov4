/* eslint-disable */
/* global WebImporter */

/**
 * RBC Royal Bank cleanup transformer.
 * Removes non-authorable site chrome, consent/tracking widgets and
 * duplicate mobile-only markup. Selectors come from migration-work/cleaned.html.
 */

// Chrome and widgets that must go before parsers run (affects block matching).
const BEFORE_SELECTORS = [
  // Site header: smart app banner, skip-nav, top nav, search bar, mega menu
  '#dvl-wpr > header',
  '#smart-bnr-rbcapp',
  '#skip-nav',
  '#nav-header',
  '#header.master-header',
  '#search-bar',
  '.mega-menu-wpr',
  // Off-canvas mobile side menu
  '#side-menu-id',
  // Footer
  '#dvl-wpr > footer',
  // OneTrust cookie banner / preference center
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '#onetrust-pc-sdk',
  '[id^="ot-sdk"]',
  // jQuery UI search autocomplete lists
  'ul.ui-autocomplete',
  // UserWay accessibility badge / feedback tab widgets
  'uws-badge',
  '[id^="kampyle"]',
  '.kampyle_vertical_button',
  '[id^="QSIFeedbackButton"]',
  '.feedback-tab',
  '#feedback-tab',
  // Tracking pixels and helper nodes
  '[id^="batBeacon"]',
  '.high-contrast-test',
  'body > div.hide',
  // Mobile-only duplicate of the bento grid (desktop .bento-box is the block)
  '#bento-section .glider-wpr',
  // Empty placeholder div
  '#test-wp',
  // Mobile-only "MENU" toggle in the breadcrumb/title bar (display:none on
  // desktop): <div class="nav-bar"><div class="nav-inner"><button|div
  // class="nav-btn" aria-label="Open Menu"><span>MENU</span></…><h1 …>.
  // Left in, it imports as a "MENU" paragraph above the page title.
  '.nav-bar .nav-inner > .nav-btn',
  '.nav-btn[aria-label="Open Menu"]',
  'button.mobile-nav-btn',
];

/**
 * Product pages: a scroll-triggered sticky bar (aside.sticky-nav__custom) repeats
 * the page <h1>; it imports as a second page title. Drop the repeated title and
 * the bar when nothing else is left (some bars carry a unique offer line + CTA).
 */
function removeStickyTitleBars(element) {
  const norm = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  element.querySelectorAll('aside.sticky-nav__custom').forEach((bar) => {
    if (bar.matches('[data-catalog-block]') || bar.querySelector('[data-catalog-block]')) return;
    const titles = [...element.querySelectorAll('h1')].filter((h) => !bar.contains(h)).map(norm);
    bar.querySelectorAll('h1').forEach((h) => { if (titles.includes(norm(h))) h.remove(); });
    const rest = bar.cloneNode(true);
    rest.querySelectorAll('.offscreen, .sr-only').forEach((n) => n.remove());
    if (!norm(rest)) bar.remove();
  });
}

// Modal / popup containers. Their content is only shown on demand (jQuery
// popupoverlay wrappers appended to <body>, .modal dialogs), so it is removed
// unless it is actually rendered on the page at import time.
const MODAL_SELECTORS = [
  '.popup_wrapper',
  '.popup_content',
  '.modal',
  '.modal-container',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
  'dialog:not([open])',
];

// Marker set on every native source <table> before parsers run.
const SRC_TABLE_ATTR = 'data-src-table';

// Helper nodes inside source table cells that are not authorable text.
const TABLE_CELL_JUNK = '.tablesaw-cell-label, .tablesaw-checkbox, .sr-only, .offscreen, .trigger-icon, script, style, noscript';

// Final cleanup after parsers have run.
const AFTER_SELECTORS = [
  // Embedded app shells (e.g. the Angular calculator) carry a stray
  // <base href="./"> inside <body>; html2md (hast-util-to-mdast) freezes it as
  // the link base and `new URL(href, './')` throws "Invalid base URL".
  'base',
  'iframe',
  'script',
  'style',
  'noscript',
  'link',
  'img[src*="bat.bing.com"]',
  'img[src*="doubleclick.net"]',
  'img[src*="facebook.com/tr"]',
  // Leftover form widgets of JS tools kept as default content (questionnaires):
  // html2md writes radios/checkboxes as "[ ]" and the progress bar as "0%".
  'input[type="radio"]',
  'input[type="checkbox"]',
  '.progress-bar',
  '[role="progressbar"]',
  // carousel arrows/dots left next to a carousel header ("Click to go back in the carousel")
  'button.carousel-button',
  '.carousel-ctrl',
  '.slick-arrow',
  'button.slick-prev',
  'button.slick-next',
  '.slick-dots',
];

const TRACKING_ATTRS = [
  'data-dig-id',
  'data-dig-label',
  'data-dig-category',
  'data-dig-action',
  'data-dig-details',
  'onclick',
];

/**
 * True when the element is laid out and visible in a live browser. Outside a
 * rendering engine (jsdom) nothing is rendered, so modals count as hidden.
 */
function isRendered(el) {
  const win = el.ownerDocument && el.ownerDocument.defaultView;
  if (!win || typeof win.getComputedStyle !== 'function' || typeof el.getClientRects !== 'function') return false;
  try {
    if (!el.getClientRects().length) return false;
    const cs = win.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  } catch (e) {
    return false;
  }
}

/**
 * Business GIC / term-deposit pages publish their rate tables only in a
 * "View Interest Rates" popup (#modal_wrapper, opened by a.modal_open). That is
 * the page's core data, so a popup whose opener (popupoverlay convention:
 * class "<popup id>_open") mentions rates is kept.
 */
function isRatesPopup(el) {
  const content = el.matches('.popup_content[id]') ? el : el.querySelector('.popup_content[id]');
  const id = (content && content.id) || (el.id || '').replace(/_wrapper$/, '');
  if (!id || !/^[\w-]+$/.test(id) || !el.querySelector('table')) return false;
  return [...el.ownerDocument.querySelectorAll(`.${id}_open`)]
    .some((t) => /\b(rates?|taux)\b/i.test(t.textContent || ''));
}

function removeHiddenModals(element) {
  const kept = [];
  element.querySelectorAll(MODAL_SELECTORS.join(', ')).forEach((el) => {
    if (!el.isConnected || kept.some((k) => k.contains(el))) return;
    // never take out a whole page wrapper by accident
    if (el.matches('main, body') || el.querySelector('main')) return;
    // a popup page whose only <h1> is inside the modal is the page itself; product
    // detail popups (with their own <h1>) next to a page <h1> are not
    if (el.querySelector('h1') && ![...el.ownerDocument.querySelectorAll('h1')].some((h) => !el.contains(h))) return;
    if (isRendered(el)) return;
    if (isRatesPopup(el)) {
      kept.push(el);
      el.querySelectorAll('.close').forEach((c) => c.remove());
      return;
    }
    el.remove();
  });
}

/**
 * stacktable.js renders every comparison table twice: the original
 * (table.large-only) and a stacked mobile copy (table.small-only). Drop the copy.
 */
function removeMobileTableCopies(element) {
  element.querySelectorAll('table.small-only').forEach((t) => {
    const parent = t.parentElement;
    if (parent && [...parent.children].some((s) => s !== t && s.matches('table.large-only'))) t.remove();
  });
}

/**
 * Rebuild a native table that no parser claimed as a "Table Striped" block:
 * one block row per source row, cells as-is (the header row stays the first
 * data row). Cell markup (links, sup, lists, emphasis) is moved over unchanged.
 */
function convertSourceTable(document, table) {
  const rows = [];
  [...table.querySelectorAll('tr')].forEach((tr) => {
    if (tr.closest('table') !== table) return;
    const cells = [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
    if (!cells.length) return;
    const row = cells.map((c) => {
      c.querySelectorAll(TABLE_CELL_JUNK).forEach((n) => n.remove());
      const div = document.createElement('div');
      div.append(...c.childNodes);
      return div;
    });
    if (row.every((d) => !d.textContent.trim() && !d.querySelector('img, picture'))) return;
    rows.push(row);
  });
  const caption = table.querySelector(':scope > caption');
  const captionP = caption && caption.textContent.trim() ? document.createElement('p') : null;
  if (captionP) captionP.append(...caption.childNodes);

  if (!rows.length) {
    if (captionP) table.replaceWith(captionP); else table.remove();
    return;
  }
  // a layout table holding a single cell: keep its content as default content
  if (rows.length === 1 && rows[0].length === 1) {
    const frag = document.createDocumentFragment();
    if (captionP) frag.append(captionP);
    frag.append(...rows[0][0].childNodes);
    table.replaceWith(frag);
    return;
  }
  // a single spanning cell stays single; other short rows are padded to the widest row
  const max = Math.max(...rows.map((r) => r.length));
  const cells = rows.map((r) => (r.length === 1 || r.length === max ? r : [...r, ...Array(max - r.length).fill('')]));
  const block = WebImporter.Blocks.createBlock(document, { name: 'Table Striped', cells });
  if (captionP) table.before(captionP);
  table.replaceWith(block);
}

/**
 * Native tables still marked after the parsers ran were not claimed by any
 * block. Left alone, html2md reads them as blocks named after their first row.
 * Tables sitting inside a block table a parser created are block content.
 */
function convertUnclaimedTables(element) {
  const document = element.ownerDocument;
  [...element.querySelectorAll(`table[${SRC_TABLE_ATTR}]`)].forEach((table) => {
    if (!table.isConnected) return;
    if (table.parentElement && table.parentElement.closest('table')) return;
    convertSourceTable(document, table);
  });
  element.querySelectorAll(`[${SRC_TABLE_ATTR}]`).forEach((t) => t.removeAttribute(SRC_TABLE_ATTR));
}

const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIALOG', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI',
  'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL']);
const BLOCK_SELECTOR = [...BLOCK_TAGS].map((t) => t.toLowerCase()).join(', ');
const FLOW_CONTAINERS = 'div, section, article, aside, main, header, footer, nav, form, fieldset, figure';

function isBlockNode(n) {
  return n.nodeType === 1 && (BLOCK_TAGS.has(n.tagName) || !!n.querySelector(BLOCK_SELECTOR));
}

/**
 * Wrap loose inline runs (text, links, sup, ...) that sit directly in a flow
 * container into <p>. html2md mishandles a bare inline run ending in
 * <sup><a>…</a></sup> next to block content (e.g. a caption
 * <div>Offer<sup><a href="#legal-1">1</a></sup></div> followed by <p>s): it
 * drops every blank line in the document, so the whole page imports as one
 * run-on paragraph of literal markdown. Wrapping is otherwise neutral, as
 * html2md turns such runs into paragraphs anyway.
 */
function wrapLooseInline(element) {
  const document = element.ownerDocument;
  [element, ...element.querySelectorAll(FLOW_CONTAINERS)].forEach((c) => {
    // inside list items, headings, paragraphs or inline wrappers a <p> would change the output
    if (c !== element && c.parentElement && c.parentElement.closest('p, h1, h2, h3, h4, h5, h6, li, pre, a, span, strong, em, b, i')) return;
    let run = [];
    const flush = () => {
      const meaningful = run.some((n) => (n.nodeType === 3 && n.textContent.trim())
        || (n.nodeType === 1 && n.tagName !== 'BR'));
      if (meaningful) {
        const p = document.createElement('p');
        run[0].before(p);
        p.append(...run);
      }
      run = [];
    };
    [...c.childNodes].forEach((n) => {
      if (n.nodeType === 3 || (n.nodeType === 1 && !isBlockNode(n))) run.push(n);
      else flush();
    });
    flush();
  });
}

const MOBILE_COPY = '.mobile-only, .mobile-only-flex, .banner-mobile, .show-for-small-only';
const DESKTOP_COPY = '.desktop-only, .banner-desktop, .hide-for-small-only';

function wordSet(el) {
  return new Set((el.textContent || '').toLowerCase().split(/[^a-z0-9$%]+/).filter((w) => w.length > 1));
}

/**
 * RBC pages often render a section twice: a desktop copy (.desktop-only,
 * .banner-desktop) and a mobile copy (.mobile-only, .banner-mobile) that is
 * display:none on desktop. Both import as default content, duplicating the
 * text. Drop a hidden mobile copy when a desktop sibling carries the same words.
 */
function removeMobileTwins(element) {
  element.querySelectorAll(MOBILE_COPY).forEach((m) => {
    if (!m.isConnected || !m.parentElement || isRendered(m)) return;
    // a copy the catalog mapped to a block is kept for its parser
    if (m.matches('[data-catalog-block]') || m.querySelector('[data-catalog-block]')) return;
    const words = wordSet(m);
    if (!words.size) return;
    const twin = [...m.parentElement.children].some((s) => {
      if (s === m || !s.matches(DESKTOP_COPY)) return false;
      const other = wordSet(s);
      const shared = [...words].filter((w) => other.has(w)).length;
      return shared / Math.max(words.size, other.size) >= 0.8;
    });
    if (twin) m.remove();
  });
}

export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    WebImporter.DOMUtils.remove(element, BEFORE_SELECTORS);
    removeHiddenModals(element);
    removeMobileTableCopies(element);
    removeMobileTwins(element);
    removeStickyTitleBars(element);
    element.querySelectorAll('table').forEach((t) => t.setAttribute(SRC_TABLE_ATTR, ''));
  }

  if (hookName === 'afterTransform') {
    convertUnclaimedTables(element);
    WebImporter.DOMUtils.remove(element, AFTER_SELECTORS);
    // Mark RBC buttons the EDS way: filled primary -> <strong>, outline -> <em>.
    element.querySelectorAll('a.btn').forEach((a) => {
      if (a.closest('strong, em')) return;
      const wrap = element.ownerDocument.createElement(a.classList.contains('primary') ? 'strong' : 'em');
      a.replaceWith(wrap);
      wrap.append(a);
    });
    // The importer turns background-image into an <img>, but a layered value
    // (url(...), linear-gradient(... 50% ...)) becomes one malformed src.
    // Keep only the first url() layer; drop gradient-only backgrounds.
    element.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const bg = el.style.backgroundImage || '';
      if (!bg.includes(',') && /^url\(/.test(bg.trim())) return;
      const url = bg.match(/url\((['"]?)(.*?)\1\)/);
      if (url && url[2] && !url[2].startsWith('data:')) {
        el.style.backgroundImage = `url("${url[2]}")`;
      } else {
        el.style.removeProperty('background-image');
      }
    });
    element.querySelectorAll('*').forEach((el) => {
      TRACKING_ATTRS.forEach((attr) => {
        if (el.hasAttribute(attr)) el.removeAttribute(attr);
      });
    });
    wrapLooseInline(element);
  }
}
