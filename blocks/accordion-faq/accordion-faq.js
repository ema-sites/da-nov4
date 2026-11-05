/*
 * Accordion FAQ
 * Rows:
 *  - question | answer           -> collapsible item
 *  - single cell, heading only   -> group heading (starts a new group)
 *  - single cell, picture only   -> media (image-beside / background-image options)
 *  - single cell, other content  -> intro text above the items
 */

const SHOW_LIMIT = 3;

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

function buildItem(labelCell, bodyCell) {
  const details = document.createElement('details');
  details.className = 'accordion-faq-item';
  const summary = document.createElement('summary');
  summary.className = 'accordion-faq-item-label';
  summary.append(...labelCell.childNodes);
  const body = document.createElement('div');
  body.className = 'accordion-faq-item-body';
  if (bodyCell) body.append(...bodyCell.childNodes);
  details.append(summary, body);
  return details;
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
      group.append(buildItem(cells[0], cells[1]));
      // extra cells: append to body so nothing authored is lost
      const body = group.lastElementChild.querySelector('.accordion-faq-item-body');
      cells.slice(2).forEach((c) => body.append(...c.childNodes));
      return;
    }
    const [cell] = cells;
    if (isPictureOnly(cell)) {
      media.append(...cell.childNodes);
    } else if (isHeadingOnly(cell) && (group || block.classList.contains('grouped'))) {
      newGroup(cell.firstElementChild);
    } else if (!group) {
      intro.append(...cell.childNodes);
    } else {
      // single-cell row after items: treat as a question with no answer
      group.append(buildItem(cell, null));
    }
  });

  if (block.classList.contains('grouped')) {
    items.querySelectorAll('.accordion-faq-group').forEach(addShowMore);
  }

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
