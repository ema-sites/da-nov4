/* eslint-disable */
/* global WebImporter */

/**
 * Parser: accordion-faq
 * Source: #help-accordion (two .grid-half columns of .accordion-panel)
 *
 * One row per panel, in document (column) order, 2 cells:
 * topic label (plain text; the #accordionN toggle link is dropped) |
 * answer content (bulleted link list).
 */

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  const cells = [];
  element.querySelectorAll('.accordion-panel').forEach((panel) => {
    const toggle = panel.querySelector('.collapse-toggle');
    const label = cleanText(toggle ? toggle.textContent : '');

    const body = [];
    const inner = panel.querySelector('.collapse-inner') || panel.querySelector('.collapse-content');
    if (inner) {
      [...inner.children].forEach((el) => {
        if (el.matches('ul, ol')) {
          const list = document.createElement(el.tagName.toLowerCase());
          el.querySelectorAll(':scope > li').forEach((li) => {
            const text = cleanText(li.textContent);
            if (!text) return;
            const item = document.createElement('li');
            const a = li.querySelector('a[href]');
            if (a) {
              const link = document.createElement('a');
              link.href = a.getAttribute('href');
              link.textContent = cleanText(a.textContent);
              item.append(link);
            } else {
              item.textContent = text;
            }
            list.append(item);
          });
          if (list.children.length) body.push(list);
        } else if (cleanText(el.textContent)) {
          body.push(el.cloneNode(true));
        }
      });
    }

    if (!label && !body.length) return;
    cells.push([label, body]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
