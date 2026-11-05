/* eslint-disable */
/* global WebImporter */

/**
 * Parser: search-site (boxed)
 * Source: #intellResponse_form ("Still need help?" ask box)
 *
 * One row, 2 cells:
 *   text cell: <p>field label</p><p>placeholder</p>
 *   link cell: <a href="{form action}">{button label}</a>
 * blocks/search-site/search-site.js reads the first paragraph as the visible
 * label and the rest as the input placeholder.
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const FALLBACK_ACTION = '/search-public/index.html';
const FALLBACK_PLACEHOLDER = 'Type your question here';

export default function parse(element, { document }) {
  const form = element.matches('form') ? element : element.querySelector('form');
  const labelEl = element.querySelector('label, .ask-callout-title');
  const input = element.querySelector('#intelli-search')
    || element.querySelector('input[type="text"], input[type="search"]')
    || [...element.querySelectorAll('input')].pop();
  const button = element.querySelector('button, input[type="submit"]');

  const label = cleanText(labelEl ? labelEl.textContent : '');
  const placeholder = cleanText(input && (input.getAttribute('placeholder') || input.getAttribute('aria-label')))
    || FALLBACK_PLACEHOLDER;
  const buttonText = cleanText(button ? (button.textContent || button.getAttribute('value')) : '') || 'Find';
  const action = (form && form.getAttribute('action')) || FALLBACK_ACTION;

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
    variants: ['boxed'],
    cells,
  });
  element.replaceWith(block);
}
