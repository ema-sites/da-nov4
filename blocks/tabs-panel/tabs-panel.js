import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';

let instance = 0;

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

/**
 * Tabs: one row per tab. First cell = tab label; remaining cells = panel content.
 * Two or more content cells are laid out as panel columns. Rows without a label
 * are appended to the previous panel; empty rows are skipped.
 * Layout: vertical tab list by default; any `horizontal*` option puts tabs on top.
 * @param {Element} block
 */
export default function decorate(block) {
  instance += 1;
  const prefix = `tabs-panel-${instance}`;
  const horizontal = [...block.classList].some((c) => c.startsWith('horizontal'));
  block.classList.add(horizontal ? 'tabs-panel-horizontal' : 'tabs-panel-vertical');

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
