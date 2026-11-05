/* eslint-disable */
/* global WebImporter */

/**
 * Parser: search-site
 * Sources: #intellResponse_form ("Still need help?" ask box, homepage variant boxed),
 * #global-search combo inputs (input + a.btn search link), other site-search forms.
 * Markup without a text input is left as default content.
 *
 * One row, 2 cells:
 *   text cell: <p>field label</p><p>placeholder</p>
 *   link cell: <a href="{form action}">{button label}</a>
 * blocks/search-site/search-site.js reads the first paragraph as the visible
 * label and the rest as the input placeholder.
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
// ---- end shared helpers ----

const FALLBACK_ACTION = '/search-public/index.html';
const FALLBACK_PLACEHOLDER = 'Type your question here';

export default function parse(element, { document }) {
  const form = element.matches('form') ? element : element.querySelector('form');
  const input = element.querySelector('#intelli-search')
    || element.querySelector('input[type="text"], input[type="search"]')
    || [...element.querySelectorAll('input:not([type="hidden"])')].pop();
  if (!input) return; // no search field: not a search box (e.g. a select-driven tool)
  // a visible label only (screen-reader-only "Search" labels are not shown)
  const labelEl = element.querySelector('label:not(.offscreen):not(.sr-only), .ask-callout-title');
  const button = element.querySelector('button, input[type="submit"], a.btn');

  const label = cleanText(labelEl ? labelEl.textContent : '');
  const placeholder = cleanText(input && (input.getAttribute('placeholder') || input.getAttribute('aria-label')))
    || FALLBACK_PLACEHOLDER;
  const buttonText = cleanText(button ? (button.textContent || button.getAttribute('value')) : '') || 'Find';
  let action = (form && form.getAttribute('action')) || '';
  if (!action && button && button.tagName === 'A') action = (button.getAttribute('href') || '').replace(/([?&])question=[^&]*$/, '').replace(/[?&]$/, '');
  if (!action || /^javascript:/i.test(action)) action = FALLBACK_ACTION;

  const textCell = [];
  if (label) {
    const p = document.createElement('p');
    p.textContent = label;
    textCell.push(p);
  }
  const ph = document.createElement('p');
  ph.textContent = placeholder;
  textCell.push(ph);

  const linkP = document.createElement('p');
  const a = document.createElement('a');
  a.href = action;
  a.textContent = buttonText;
  linkP.append(a);

  const cells = [[textCell, [linkP]]];
  const block = WebImporter.Blocks.createBlock(document, {
    name: 'search-site',
    variants: resolveVariants(element, ['boxed']),
    cells,
  });
  element.replaceWith(block);
}
