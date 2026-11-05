/* eslint-disable */
/* global WebImporter */

/**
 * Parser: breadcrumb
 * Source: nav#breadcrumb-wpr.breadcrumb-wpr > ol > li.breadcrumb-level-N
 *
 * One row, one cell holding a list: linked ancestors as <li><a>, the
 * trailing current page as plain text. The mobile "..." home link and the
 * chevron/scroll button glyphs are dropped.
 * In-page anchor bars that the catalog grouped here (nav.in-page-links with
 * only #anchor links) become an anchor-nav block instead.
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

/** Fix RBC footnote/legal links: javascript:/empty href + data-target -> #anchor. */
function fixHref(a) {
  let href = a.getAttribute('href') || '';
  const target = a.getAttribute('data-target') || '';
  if ((!href || href === '#' || /^javascript:/i.test(href)) && /^#[\w-]+$/.test(target)) href = target;
  return href;
}
// ---- end shared helpers ----

export default function parse(element, { document }) {
  const variants = resolveVariants(element, []);

  const levels = [...element.querySelectorAll('li')].filter((li) => !li.closest('button'));
  const items = [];
  levels.forEach((li) => {
    const links = [...li.querySelectorAll('a[href]')]
      .filter((a) => !a.matches('.breadcrumb-home-link-mobile') && cleanText(a.textContent) && cleanText(a.textContent) !== '...');
    if (links.length) {
      // html2md merges the desktop and mobile ("...") home links into "Personal..."
      links.forEach((a) => items.push({ text: cleanText(a.textContent).replace(/\s*(\.\.\.|\u2026)$/, ''), href: fixHref(a) }));
      return;
    }
    const clone = li.cloneNode(true);
    clone.querySelectorAll('[aria-hidden="true"], .offscreen, .sr-only, button').forEach((n) => n.remove());
    const text = cleanText(clone.textContent);
    if (text) items.push({ text });
  });
  if (!items.length) {
    // no list: plain links / text
    element.querySelectorAll('a[href]').forEach((a) => {
      if (cleanText(a.textContent)) items.push({ text: cleanText(a.textContent), href: fixHref(a) });
    });
  }
  if (!items.length) return;

  const list = document.createElement('ul');
  items.forEach((item) => {
    const li = document.createElement('li');
    if (item.href) {
      const a = document.createElement('a');
      a.setAttribute('href', item.href);
      a.textContent = item.text;
      li.append(a);
    } else {
      li.textContent = item.text;
    }
    list.append(li);
  });

  // an in-page anchor bar is not a trail
  const anchorsOnly = items.every((i) => i.href && i.href.startsWith('#'));
  const isTrail = element.matches('#breadcrumb-wpr, .breadcrumb-wpr, [class*="breadcrumb"]')
    || !!element.querySelector('[class*="breadcrumb"]');
  if (anchorsOnly && !isTrail) {
    makeBlock(document, element, 'anchor-nav', [[[list]]], []);
    return;
  }
  makeBlock(document, element, 'breadcrumb', [[[list]]], variants);
}
