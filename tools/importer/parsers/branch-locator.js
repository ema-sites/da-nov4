/* eslint-disable */
/* global WebImporter */

/**
 * Parser: branch-locator
 * Source: .branch-locator-section .section-inner
 *
 * Rows (blocks/branch-locator/branch-locator.js):
 *   1. map picture (background) - the <img> sits on the parent
 *      section.branch-locator-section, outside the matched element, so it is
 *      moved into the block (or rebuilt from section[data-img]).
 *   2. H2 heading
 *   3. form row: field label | link (href = form action, text = button label)
 * Hidden inputs (lang, searchBranch, searchATM) carry no authorable choices.
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const FALLBACK_ACTION = 'https://maps.rbcroyalbank.com/';

export default function parse(element, { document }) {
  const cells = [];

  // 1. background map picture from the parent section
  const section = element.closest('section') || element.parentElement;
  let bgImg = null;
  if (section && section !== element) {
    const srcImg = [...section.children].find((c) => c.tagName === 'IMG')
      || section.querySelector(':scope > picture img');
    if (srcImg) {
      bgImg = document.createElement('img');
      bgImg.src = srcImg.getAttribute('src');
      bgImg.alt = srcImg.getAttribute('alt') || '';
      // remove the original so it does not linger as default content
      (srcImg.closest('picture') || srcImg).remove();
    } else if (section.getAttribute('data-img')) {
      bgImg = document.createElement('img');
      bgImg.src = section.getAttribute('data-img');
      bgImg.alt = '';
    }
  }
  if (!bgImg) {
    const inner = element.querySelector(':scope > img');
    if (inner) {
      bgImg = document.createElement('img');
      bgImg.src = inner.getAttribute('src');
      bgImg.alt = inner.getAttribute('alt') || '';
    }
  }
  if (bgImg) cells.push([[bgImg], '']);

  // 2. heading
  const heading = element.querySelector('h1, h2, h3');
  if (heading && cleanText(heading.textContent)) {
    const h = document.createElement(heading.tagName.toLowerCase());
    h.textContent = cleanText(heading.textContent);
    cells.push([[h], '']);
  }

  // 3. form row: label | action link
  const form = element.querySelector('form');
  const labelEl = element.querySelector('form label, label');
  const button = element.querySelector('form button, button, input[type="submit"]');
  const labelText = cleanText(labelEl ? labelEl.textContent : '');
  const buttonText = cleanText(button ? (button.textContent || button.getAttribute('value')) : '') || 'Search';
  let action = (form && form.getAttribute('action')) || FALLBACK_ACTION;
  if (/^javascript:/i.test(action)) action = FALLBACK_ACTION;

  const labelP = document.createElement('p');
  labelP.textContent = labelText;
  const linkP = document.createElement('p');
  const a = document.createElement('a');
  a.href = action;
  a.textContent = buttonText;
  linkP.append(a);
  cells.push([labelText ? [labelP] : '', [linkP]]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'branch-locator', cells });
  element.replaceWith(block);
}
