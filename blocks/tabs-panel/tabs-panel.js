import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';

let instance = 0;

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

const onlyChild = (el, selector) => el.children.length === 1
  && el.firstElementChild.matches(selector)
  && el.textContent.trim() === el.firstElementChild.textContent.trim();

// a paragraph holding only a bold label (no link), directly followed by an h4
const isEyebrow = (el) => el.tagName === 'P' && onlyChild(el, 'strong')
  && !el.querySelector('a') && el.nextElementSibling?.tagName === 'H4';
const isLinkPara = (el) => el.tagName === 'P' && !el.classList.contains('button-wrapper')
  && onlyChild(el, 'a') && !el.querySelector('a.button');
const isButtonPara = (el) => el.tagName === 'P'
  && (el.classList.contains('button-wrapper') || !!el.querySelector(':scope > a.button, :scope > strong > a'));

function wrap(className, nodes) {
  const div = document.createElement('div');
  div.className = className;
  div.append(...nodes);
  return div;
}

// wrap runs of 2+ adjacent lists so they can sit side by side
function wrapListRuns(nodes, className) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 1) out.push(wrap(className, run));
    else out.push(...run);
    run = [];
  };
  nodes.forEach((node) => {
    if (node.tagName === 'UL' || node.tagName === 'OL') run.push(node);
    else {
      flush();
      out.push(node);
    }
  });
  flush();
  return out;
}

function buildCard(nodes) {
  const pictureIndex = nodes.findIndex((n) => n.tagName === 'P' && onlyChild(n, 'picture'));
  const headEnd = pictureIndex >= 0 ? pictureIndex : nodes.findIndex((n, i) => i > 1 && n.tagName !== 'P');
  const head = nodes.slice(0, headEnd < 0 ? nodes.length : headEnd);
  let rest = nodes.slice(head.length);
  const card = document.createElement('div');
  card.className = 'tabs-panel-card';

  const top = wrap('tabs-panel-card-top', [wrap('tabs-panel-card-head', head)]);
  head[0].classList.add('tabs-panel-card-eyebrow');
  const fee = head[2]?.tagName === 'P' ? head[2] : null;
  if (fee) fee.classList.add('tabs-panel-card-fee');
  if (pictureIndex >= 0) {
    top.append(wrap('tabs-panel-card-media', [rest.shift()]));
    // the fee line is repeated under the image for small screens
    if (fee && rest[0]?.tagName === 'P' && rest[0].textContent.trim() === fee.textContent.trim()) {
      const mobileFee = rest.shift();
      mobileFee.classList.add('tabs-panel-card-fee', 'tabs-panel-card-fee-mobile');
      top.append(mobileFee);
    }
  }

  const links = rest.filter((n) => isLinkPara(n) || isButtonPara(n));
  rest = rest.filter((n) => !links.includes(n));
  const body = wrap('tabs-panel-card-body', wrapListRuns(rest, 'tabs-panel-card-lists'));
  if (links.length) body.append(wrap('tabs-panel-card-links', links));
  card.append(top, body);
  return card;
}

/**
 * Product cards inside a panel: an eyebrow paragraph (bold label) + h4 title starts a card;
 * the card runs to its link line (a text link, optionally followed by a button).
 * Content before the first card is the intro; content after the last card is the footer.
 * Only applied when a panel holds two or more such cards.
 * @param {Element} content
 */
function decorateCards(content) {
  const nodes = [...content.children];
  const starts = nodes.filter(isEyebrow);
  if (starts.length < 2) return;

  const intro = nodes.slice(0, nodes.indexOf(starts[0]));
  const cards = [];
  let footer = [];
  starts.forEach((start, i) => {
    const end = i + 1 < starts.length ? nodes.indexOf(starts[i + 1]) : nodes.length;
    const slice = nodes.slice(nodes.indexOf(start), end);
    // the card ends after its first text link and any buttons right after it
    const linkAt = slice.findIndex((n, j) => j > 1 && isLinkPara(n));
    let cut = slice.length;
    if (linkAt >= 0) {
      cut = linkAt + 1;
      while (cut < slice.length && isButtonPara(slice[cut])) cut += 1;
    }
    cards.push(buildCard(slice.slice(0, cut)));
    if (i === starts.length - 1) footer = slice.slice(cut);
  });

  const parts = [];
  if (intro.length) parts.push(wrap('tabs-panel-intro', wrapListRuns(intro, 'tabs-panel-lists')));
  parts.push(wrap('tabs-panel-cards', cards));
  if (footer.length) parts.push(wrap('tabs-panel-footer', footer));
  content.classList.add('tabs-panel-has-cards');
  content.replaceChildren(...parts);
}

/**
 * Groups inside a panel: each h4 and the content after it (up to the next h4)
 * becomes a group, so two or more h4 sections can sit side by side as boxes.
 * @param {Element} content
 */
function decorateGroups(content) {
  const nodes = [...content.children];
  const starts = nodes.filter((n) => n.tagName === 'H4');
  if (starts.length < 2) return;
  const first = nodes.indexOf(starts[0]);
  const groups = starts.map((start, i) => {
    const end = i + 1 < starts.length ? nodes.indexOf(starts[i + 1]) : nodes.length;
    return wrap('tabs-panel-group', nodes.slice(nodes.indexOf(start), end));
  });
  content.classList.add('tabs-panel-has-groups');
  content.replaceChildren(...nodes.slice(0, first), wrap('tabs-panel-groups', groups));
}

/**
 * Collapsible tables: a bold-only paragraph directly followed by a table becomes
 * a toggle button that shows and hides the table (source collapsible rate tables).
 * @param {Element} content
 * @param {string} prefix
 */
function decorateCollapsibles(content, prefix) {
  [...content.querySelectorAll(':scope > p')].forEach((p, i) => {
    const table = p.nextElementSibling;
    if (table?.tagName !== 'TABLE' || !onlyChild(p, 'strong')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tabs-panel-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.append(...p.firstElementChild.childNodes);
    const region = wrap('tabs-panel-collapse', [table]);
    region.id = `${prefix}-collapse-${i + 1}`;
    region.hidden = true;
    button.setAttribute('aria-controls', region.id);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      region.hidden = !open;
    });
    const item = wrap('tabs-panel-collapsible', [button, region]);
    p.replaceWith(item);
  });
}

// looks whose tab list sits beside the panel; every other look puts the tabs above it
const VERTICAL_LOOKS = ['grey', 'horizontal-8'];

/**
 * Tabs: one row per tab. First cell = tab label; remaining cells = panel content.
 * Two or more content cells are laid out as panel columns. Rows without a label
 * are appended to the previous panel; empty rows are skipped.
 * Layout: tabs above the panel; the VERTICAL_LOOKS put the tab list beside it.
 * @param {Element} block
 */
export default function decorate(block) {
  instance += 1;
  const prefix = `tabs-panel-${instance}`;
  const looks = [...block.classList].filter((c) => !['tabs-panel', 'block'].includes(c));
  const horizontal = !looks.some((c) => VERTICAL_LOOKS.includes(c));
  block.classList.add(horizontal ? 'tabs-panel-horizontal' : 'tabs-panel-vertical');
  if (!looks.length) block.classList.add('tabs-panel-default');

  const tablist = document.createElement('div');
  tablist.className = 'tabs-panel-list';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');

  const panels = document.createElement('div');
  panels.className = 'tabs-panel-panels';

  const tabs = [];
  const used = new Set();

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const isEmpty = !row.textContent.trim() && !row.querySelector('picture, img');
    if (!cells.length || isEmpty) return;
    const [labelCell, ...contentCells] = cells;
    const label = labelCell.textContent.trim();

    if (!label) {
      // continuation row (no label): append its content to the previous panel
      const last = tabs[tabs.length - 1];
      if (last) {
        const target = last.panel.querySelector('.tabs-panel-content');
        cells.forEach((cell) => target.append(...cell.childNodes));
      }
      return;
    }

    let id = toClassName(label) || `tab-${tabs.length + 1}`;
    while (used.has(id)) id = `${id}-${tabs.length + 1}`;
    used.add(id);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tabs-panel-tab';
    button.id = `${prefix}-tab-${id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${prefix}-panel-${id}`);
    const firstPara = labelCell.children.length === 1 && labelCell.firstElementChild.tagName === 'P';
    button.append(...(firstPara ? labelCell.firstElementChild.childNodes : labelCell.childNodes));

    const panel = document.createElement('div');
    panel.className = 'tabs-panel-panel';
    panel.id = `${prefix}-panel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    panel.tabIndex = 0;

    const content = document.createElement('div');
    content.className = 'tabs-panel-content';
    const filled = contentCells.filter((cell) => cell.innerHTML.trim() !== '');
    if (filled.length > 1) {
      content.classList.add('tabs-panel-columns');
      filled.forEach((cell) => {
        const col = document.createElement('div');
        col.className = 'tabs-panel-column';
        col.append(...cell.childNodes);
        content.append(col);
      });
    } else if (filled.length === 1) {
      content.append(...filled[0].childNodes);
      decorateCards(content);
      if (!looks.length) decorateGroups(content);
      if (block.classList.contains('alt')) decorateCollapsibles(content, `${prefix}-${id}`);
    }
    panel.append(content);

    tablist.append(button);
    panels.append(panel);
    tabs.push({ button, panel });
  });

  const select = (index, focus = false) => {
    tabs.forEach(({ button, panel }, i) => {
      const active = i === index;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    });
    if (focus) tabs[index].button.focus();
  };

  tabs.forEach(({ button }, i) => {
    button.addEventListener('click', () => select(i));
    button.addEventListener('keydown', (e) => {
      const next = ['ArrowRight', 'ArrowDown'].includes(e.key);
      const prev = ['ArrowLeft', 'ArrowUp'].includes(e.key);
      if (!next && !prev && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      let target = i;
      if (next) target = (i + 1) % tabs.length;
      if (prev) target = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') target = 0;
      if (e.key === 'End') target = tabs.length - 1;
      select(target, true);
    });
  });

  if (tabs.length) select(0);
  if (tabs.length < 2) block.classList.add('tabs-panel-single');

  optimizeImages(panels);
  block.replaceChildren(tablist, panels);
}
