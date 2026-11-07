/*
 * Accordion FAQ
 * Rows:
 *  - question | answer           -> collapsible item (button + region, as source .collapse-toggle)
 *  - single cell, heading only   -> group heading (starts a new group)
 *  - single cell, picture only   -> media (image-beside / background-image options)
 *  - single cell, other content  -> intro text above the items
 */

const SHOW_LIMIT = 3;
let idCounter = 0;

function isHeadingOnly(cell) {
  const els = [...cell.children];
  return els.length > 0 && els.every((el) => /^H[1-6]$/.test(el.tagName));
}

function isPictureOnly(cell) {
  const pic = cell.querySelector('picture, img');
  return !!pic && cell.textContent.trim() === '';
}

function labels() {
  const fr = (document.documentElement.lang || '').toLowerCase().startsWith('fr');
  return fr
    ? { more: 'Afficher plus', less: 'Afficher moins' }
    : { more: 'Show More', less: 'Show Less' };
}

// the question text goes into a <button>; a lone paragraph or heading is unwrapped
// (a heading is kept around the button so the outline survives)
function buildLabel(labelCell, button) {
  const els = [...labelCell.children];
  const text = labelCell.textContent.trim();
  const only = els.length === 1 && text === els[0].textContent.trim() ? els[0] : null;
  if (only && /^H[1-6]$/.test(only.tagName)) {
    button.append(...only.childNodes);
    only.className = 'accordion-faq-item-heading';
    only.replaceChildren(button);
    return only;
  }
  button.append(...(only && only.tagName === 'P' ? only.childNodes : labelCell.childNodes));
  return button;
}

function buildItem(labelCell, bodyCell) {
  idCounter += 1;
  const id = `accordion-faq-${idCounter}`;
  const item = document.createElement('div');
  item.className = 'accordion-faq-item';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'accordion-faq-item-label';
  button.id = `${id}-label`;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-body`);
  const label = buildLabel(labelCell, button);
  const body = document.createElement('div');
  body.className = 'accordion-faq-item-body';
  body.id = `${id}-body`;
  body.setAttribute('role', 'region');
  body.setAttribute('aria-labelledby', button.id);
  body.hidden = true;
  if (bodyCell) body.append(...bodyCell.childNodes);
  item.append(label, body);
  return item;
}

function setOpen(item, open) {
  const button = item.querySelector('.accordion-faq-item-label');
  const body = item.querySelector('.accordion-faq-item-body');
  button.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  item.classList.toggle('accordion-faq-item-open', open);
}

// a list made only of links (e.g. "I'm buying my first home") gets the chevron link-list look
function markLinkLists(body) {
  body.querySelectorAll(':scope > ul').forEach((ul) => {
    const lis = [...ul.children];
    const linksOnly = lis.length > 0 && lis.every((li) => {
      const a = li.querySelector(':scope > a');
      return a && a.textContent.trim() === li.textContent.trim();
    });
    if (linksOnly) ul.classList.add('accordion-faq-links');
  });
}

// default layout: split the items into two columns that grow independently when opened
function splitColumns(group) {
  const items = [...group.querySelectorAll(':scope > .accordion-faq-item')];
  if (items.length < 2) return;
  const half = Math.ceil(items.length / 2);
  [items.slice(0, half), items.slice(half)].forEach((colItems) => {
    const col = document.createElement('div');
    col.className = 'accordion-faq-column';
    col.append(...colItems);
    group.append(col);
  });
}

function addShowMore(group) {
  const items = [...group.querySelectorAll(':scope .accordion-faq-item')];
  if (items.length <= SHOW_LIMIT) return;
  const { more, less } = labels();
  items.slice(SHOW_LIMIT).forEach((item) => item.classList.add('accordion-faq-item-hidden'));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'accordion-faq-toggle';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = more;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    items.slice(SHOW_LIMIT).forEach((item) => item.classList.toggle('accordion-faq-item-hidden', expanded));
    button.setAttribute('aria-expanded', String(!expanded));
    button.textContent = expanded ? more : less;
  });
  group.append(button);
}

export default function decorate(block) {
  const intro = document.createElement('div');
  intro.className = 'accordion-faq-intro';
  const media = document.createElement('div');
  media.className = 'accordion-faq-media';
  const items = document.createElement('div');
  items.className = 'accordion-faq-items';
  const grouped = block.classList.contains('grouped');

  let group = null;
  const newGroup = (heading) => {
    group = document.createElement('div');
    group.className = 'accordion-faq-group';
    if (heading) {
      heading.classList.add('accordion-faq-group-heading');
      group.append(heading);
    }
    items.append(group);
    return group;
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (cells.length === 0) return;
    if (cells.length >= 2) {
      if (!group) newGroup();
      const item = buildItem(cells[0], cells[1]);
      // extra cells: append to body so nothing authored is lost
      const body = item.querySelector('.accordion-faq-item-body');
      cells.slice(2).forEach((c) => body.append(...c.childNodes));
      group.append(item);
      return;
    }
    const [cell] = cells;
    if (isPictureOnly(cell)) {
      media.append(...cell.childNodes);
    } else if (isHeadingOnly(cell) && (group || grouped)) {
      newGroup(cell.firstElementChild);
    } else if (grouped) {
      // grouped option: a plain-text single cell is a topic heading
      const heading = document.createElement('h4');
      const source = cell.children.length === 1 ? cell.firstElementChild : cell;
      heading.append(...source.childNodes);
      newGroup(heading);
    } else if (!group) {
      // a bare-text cell becomes its own paragraph
      if (cell.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, div')) {
        intro.append(...cell.childNodes);
      } else {
        const p = document.createElement('p');
        p.append(...cell.childNodes);
        intro.append(p);
      }
    } else {
      // single-cell row after items: treat as a question with no answer
      group.append(buildItem(cell, null));
    }
  });

  items.querySelectorAll('.accordion-faq-item-body').forEach(markLinkLists);

  if (grouped) {
    items.querySelectorAll('.accordion-faq-group').forEach(addShowMore);
  } else if (!media.childNodes.length && !block.className.match(/\b(image|background-image)/)) {
    items.querySelectorAll('.accordion-faq-group').forEach(splitColumns);
  }

  // one open item per group, like the source accordions (data-parent)
  block.addEventListener('click', (e) => {
    const button = e.target.closest('.accordion-faq-item-label');
    if (!button || !block.contains(button)) return;
    const item = button.closest('.accordion-faq-item');
    const open = button.getAttribute('aria-expanded') !== 'true';
    if (open) {
      item.closest('.accordion-faq-group').querySelectorAll('.accordion-faq-item-open').forEach((other) => {
        if (other !== item) setOpen(other, false);
      });
    }
    setOpen(item, open);
  });

  const content = document.createElement('div');
  content.className = 'accordion-faq-content';
  if (intro.childNodes.length) content.append(intro);
  content.append(items);

  block.replaceChildren();
  if (media.childNodes.length) {
    block.classList.add('accordion-faq-has-media');
    block.append(media);
  }
  block.append(content);
}
