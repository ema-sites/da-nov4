/* eslint-disable */
/* global WebImporter */

/**
 * Parser: accordion-legal
 * Source: section.disclaimer .section-inner
 *
 * Row 1: toggle label ("Things our lawyers want you to know").
 * Rows 2+: one row per legal footnote (.table-row#legal-N): the number
 * ("1)") prefixes the first paragraph; loose inline text is wrapped into
 * paragraphs, split at <br> and block children (lists) are kept.
 */

const BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

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
function toBlocks(document, cell) {
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
    if (BLOCK_TAGS.has(node.tagName)) {
      flush();
      if (node.tagName === 'DIV') {
        out.push(...toBlocks(document, node));
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

export default function parse(element, { document }) {
  const cells = [];

  // row 1: toggle label (the button repeats the label in two spans)
  const toggle = element.querySelector('.disclaimer-btn, .collapse-toggle, button');
  let label = '';
  if (toggle) {
    const span = toggle.querySelector('span');
    label = dedupeLabel(span ? span.textContent : toggle.textContent);
  }
  cells.push([label || 'Legal disclaimers']);

  // rows 2+: footnotes
  const rows = [...element.querySelectorAll('.table-wpr > .table-row')];
  if (rows.length) {
    rows.forEach((row) => {
      const [numCell, textCell] = [...row.querySelectorAll(':scope > .table-cell')];
      const num = cleanText(numCell && (numCell.querySelector('.disclaimer') || numCell).textContent
        .replace(/legal disclaimer/i, ''));
      const content = toBlocks(document, textCell || row);
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
  } else {
    // fallback: whatever the collapse body holds
    const body = element.querySelector('.collapse-inner, .collapse-content');
    if (body) {
      const content = toBlocks(document, body);
      if (content.length) cells.push([content]);
    }
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-legal', cells });
  element.replaceWith(block);
}
