/*
 * Accordion Legal
 * Single collapsible legal-disclaimer toggle.
 *  - Row 1, cell 1: toggle label (e.g. "Things our lawyers want you to know")
 *  - Row 1, cell 2 (optional): with more rows, a summary that stays visible under
 *    the toggle; as the only row, the disclaimer body
 *  - Rows 2+: disclaimer body (hidden until opened)
 *
 * Body content that starts with a footnote marker ("1)", "2)", "*)", "†)") is split
 * into numbered footnotes with ids (legal-1, legal-dagger, ...) so in-page links
 * such as <a href="#legal-2"> open the disclaimer and scroll to that footnote.
 * A row whose first cell holds only a marker ("1)" or "1") also becomes a footnote.
 */

let idCounter = 0;

const MARKER_RE = /^\s*(\d{1,3}|[a-z]|[*†‡§¶#]{1,3})\)\s*/i;
const SHORT_MARKER_RE = /^\s*(\d{1,3}|[a-z]|[*†‡§¶#]{1,3})\)?\s*$/i;
const SYMBOL_IDS = {
  '*': 'asterisk',
  '†': 'dagger',
  '‡': 'double-dagger',
  '§': 'section',
  '¶': 'pilcrow',
  '#': 'hash',
};

function markerId(marker) {
  const key = marker.toLowerCase();
  if (/^[\da-z]+$/.test(key)) return `legal-${key}`;
  const name = [...key].map((ch) => SYMBOL_IDS[ch]).join('-');
  return name ? `legal-${name}` : '';
}

/** Collapse a label that was imported twice ("Label" + "Label"). */
function dedupeLabel(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  const half = t.length / 2;
  if (t.length > 1 && Number.isInteger(half) && t.slice(0, half) === t.slice(half)) {
    return t.slice(0, half).trim();
  }
  return t;
}

/**
 * Split a show/hide label pair imported as one string ("查看法律免责声明隐藏法律免责声明",
 * "View Legal DisclaimersHide Legal Disclaimers"): both halves end in the same phrase.
 * Returns [show, hide] or null.
 */
function splitToggleLabels(text) {
  let best = null;
  for (let i = 1; i < text.length; i += 1) {
    const a = text.slice(0, i);
    const b = text.slice(i);
    let k = 0;
    while (k < a.length && k < b.length && a[a.length - 1 - k] === b[b.length - 1 - k]) k += 1;
    const shorter = Math.min(a.length, b.length);
    if (a !== b && k >= 4 && k * 2 >= shorter && k < shorter && (!best || k > best.k)) {
      best = { k, labels: [a.trim(), b.trim()] };
    }
  }
  return best ? best.labels : null;
}

/** Element/text nodes of a cell, with loose inline runs wrapped in <p>. */
function cellBlocks(cell) {
  const blocks = [];
  let run = null;
  [...cell.childNodes].forEach((node) => {
    const isInline = node.nodeType === Node.TEXT_NODE
      || (node.nodeType === Node.ELEMENT_NODE
        && !/^(P|UL|OL|DIV|H[1-6]|TABLE|BLOCKQUOTE|PRE|HR|DL|PICTURE)$/.test(node.tagName));
    if (isInline) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim() && !run) return;
      if (!run) {
        run = document.createElement('p');
        blocks.push(run);
      }
      run.append(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      run = null;
      blocks.push(node);
    }
  });
  return blocks;
}

/** If el's text starts with a marker, strip it and return the marker. */
function takeMarker(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !node.textContent.trim()) node = walker.nextNode();
  if (!node) return null;
  const match = node.textContent.match(MARKER_RE);
  if (!match) return null;
  node.textContent = node.textContent.slice(match[0].length);
  return match[1];
}

function createItem(marker) {
  const item = document.createElement('div');
  item.className = 'accordion-legal-item';
  const markerCell = document.createElement('div');
  markerCell.className = 'accordion-legal-marker';
  const content = document.createElement('div');
  content.className = 'accordion-legal-content';
  if (marker) {
    markerCell.textContent = `${marker})`;
    const id = markerId(marker);
    if (id && !document.getElementById(id)) item.id = id;
  }
  item.append(markerCell, content);
  return item;
}

/** Group body blocks into footnote items (one per marker). */
function buildFootnotes(body, groups) {
  let current = null;
  const hasMarkers = groups.some(({ marker, blocks }) => marker
    || blocks.some((b) => MARKER_RE.test(b.textContent)));
  if (!hasMarkers) {
    groups.forEach(({ blocks }) => body.append(...blocks));
    return;
  }
  groups.forEach(({ marker, blocks }) => {
    if (marker) {
      current = createItem(marker);
      body.append(current);
    }
    blocks.forEach((el) => {
      const found = takeMarker(el);
      if (found) {
        current = createItem(found);
        body.append(current);
      } else if (!current) {
        current = createItem(null);
        body.append(current);
      }
      current.querySelector('.accordion-legal-content').append(el);
    });
  });
  body.classList.add('accordion-legal-footnotes');
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const [first, ...rest] = rows;
  const [labelCell, secondCell, ...extraCells] = [...first.children];

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'accordion-legal-toggle';
  button.setAttribute('aria-expanded', 'false');
  const labelText = labelCell ? dedupeLabel(labelCell.textContent) : '';
  const pair = splitToggleLabels(labelText);
  if (pair) {
    // source swaps the label on toggle; CSS shows the one matching aria-expanded
    pair.forEach((text, i) => {
      const span = document.createElement('span');
      span.className = i ? 'accordion-legal-label-hide' : 'accordion-legal-label-show';
      span.textContent = text;
      button.append(span);
    });
  } else {
    const label = document.createElement('span');
    label.textContent = labelText || 'Legal disclaimers';
    button.append(label);
  }

  const summary = document.createElement('div');
  summary.className = 'accordion-legal-summary';

  const body = document.createElement('div');
  body.className = 'accordion-legal-body';
  idCounter += 1;
  body.id = `accordion-legal-body-${idCounter}`;
  body.hidden = true;
  button.setAttribute('aria-controls', body.id);

  const groups = [];
  if (secondCell) {
    if (rest.length) summary.append(...secondCell.childNodes);
    else groups.push({ marker: null, blocks: cellBlocks(secondCell) });
  }
  extraCells.forEach((cell) => groups.push({ marker: null, blocks: cellBlocks(cell) }));
  rest.forEach((row) => {
    const cells = [...row.children];
    if (cells.length > 1 && SHORT_MARKER_RE.test(cells[0].textContent)) {
      const marker = cells[0].textContent.match(SHORT_MARKER_RE)[1];
      const blocks = cells.slice(1).flatMap((cell) => cellBlocks(cell));
      groups.push({ marker, blocks });
    } else {
      cells.forEach((cell) => groups.push({ marker: null, blocks: cellBlocks(cell) }));
    }
  });
  buildFootnotes(body, groups);

  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    block.classList.toggle('accordion-legal-open', open);
  };

  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  block.replaceChildren(button);
  if (summary.childNodes.length) block.append(summary);
  block.append(body);

  // In-page footnote links (#legal-2) open the disclaimer and jump to the footnote.
  const findTarget = (hash) => {
    if (!hash || hash.length < 2) return null;
    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch (e) {
      return null;
    }
    const target = document.getElementById(id);
    return target && body.contains(target) ? target : null;
  };

  const reveal = (target) => {
    setOpen(true);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    // keep the footnote clear of a fixed/sticky header
    const header = document.querySelector('header .nav-wrapper') || document.querySelector('header');
    const headerPos = header ? getComputedStyle(header).position : '';
    const offset = ['fixed', 'sticky'].includes(headerPos)
      ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset });
    target.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = findTarget(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    reveal(target);
  });

  window.addEventListener('hashchange', () => {
    const target = findTarget(window.location.hash);
    if (target) reveal(target);
  });

  const initial = findTarget(window.location.hash);
  if (initial) requestAnimationFrame(() => reveal(initial));
}
