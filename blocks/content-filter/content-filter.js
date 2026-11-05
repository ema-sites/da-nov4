/*
 * Content Filter
 * Row = one filter control.
 *  - Row with a list (ul/ol) in any cell -> a labelled <select>
 *    (label = first cell text, options = list items; linked items navigate).
 *  - Any other row -> a filter button (label = first cell, key = second cell text)
 *    or a link chip when the row contains a link.
 * Non-link buttons toggle sections whose `data-filter` (Section Metadata "filter")
 * matches the key, and dispatch a `content-filter:change` event.
 */

function toKey(text) {
  return (text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function applyFilter(block, key) {
  const main = block.closest('main');
  if (main) {
    const sections = [...main.querySelectorAll(':scope > .section[data-filter]')];
    if (sections.length) {
      sections.forEach((section) => {
        const keys = section.dataset.filter.split(',').map(toKey);
        section.hidden = !(key === 'all' || keys.includes(key));
      });
    }
  }
  block.dispatchEvent(new CustomEvent('content-filter:change', { bubbles: true, detail: { key } }));
}

function buildSelect(block, row, list, index) {
  const cells = [...row.children];
  const labelText = cells[0] && !cells[0].contains(list) ? cells[0].textContent.trim() : '';
  const field = document.createElement('div');
  field.className = 'content-filter-field';
  const id = `content-filter-${index}-${Math.random().toString(36).slice(2, 7)}`;
  if (labelText) {
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    field.append(label);
  }
  const select = document.createElement('select');
  select.id = id;
  if (!labelText) select.setAttribute('aria-label', 'Filter');
  let hasLinks = false;
  [...list.children].forEach((li) => {
    const option = document.createElement('option');
    const a = li.querySelector('a');
    option.textContent = li.textContent.trim();
    if (a) {
      option.value = a.href;
      option.dataset.href = a.href;
      hasLinks = true;
    } else {
      option.value = toKey(li.textContent);
    }
    select.append(option);
  });
  field.append(select);

  if (hasLinks) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'content-filter-go';
    const goText = [...row.querySelectorAll('strong, em')].find((el) => !list.contains(el));
    go.textContent = goText ? goText.textContent.trim() : 'Go';
    go.addEventListener('click', () => {
      const opt = select.selectedOptions[0];
      if (opt?.dataset.href) window.location.href = opt.dataset.href;
    });
    field.append(go);
  } else {
    select.addEventListener('change', () => {
      block.dispatchEvent(new CustomEvent('content-filter:change', {
        bubbles: true, detail: { field: toKey(labelText), value: select.value },
      }));
    });
  }
  return field;
}

function buildItem(row, block, group) {
  const cells = [...row.children];
  const first = cells[0];
  if (!first || !first.textContent.trim()) {
    if (!row.querySelector('picture, img')) return null;
  }
  const link = row.querySelector('a');
  const icon = row.querySelector('.icon, picture');
  const labelText = (link ? link.textContent : first?.textContent || '').trim();

  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.className = 'content-filter-item';
    if (link.title) a.title = link.title;
    if (icon) a.append(icon);
    a.append(labelText);
    if (new URL(link.href, window.location.href).pathname === window.location.pathname) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    return a;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'content-filter-item';
  if (icon) button.append(icon);
  button.append(labelText);
  button.dataset.key = toKey(cells[1]?.textContent || labelText);
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    group.querySelectorAll('button.content-filter-item').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    applyFilter(block, button.dataset.key);
  });
  return button;
}

export default function decorate(block) {
  const rows = [...block.children];
  const items = document.createElement('div');
  items.className = 'content-filter-items';
  items.setAttribute('role', 'group');
  const fields = document.createElement('div');
  fields.className = 'content-filter-fields';
  const info = document.createElement('div');
  info.className = 'content-filter-info';

  rows.forEach((row, i) => {
    const list = row.querySelector('ul, ol');
    if (list) {
      fields.append(buildSelect(block, row, list, i));
      return;
    }
    // toolbar: plain text rows (e.g. results count) stay as information
    if (block.classList.contains('toolbar') && !row.querySelector('a, strong, em, picture, .icon')) {
      const p = document.createElement('p');
      p.textContent = row.textContent.trim();
      if (p.textContent) info.append(p);
      return;
    }
    const item = buildItem(row, block, items);
    if (item) items.append(item);
  });

  block.replaceChildren(...[info, items, fields].filter((el) => el.children.length));

  const firstButton = items.querySelector('button.content-filter-item');
  if (firstButton && !block.classList.contains('toolbar')) {
    firstButton.classList.add('active');
    firstButton.setAttribute('aria-pressed', 'true');
    applyFilter(block, firstButton.dataset.key);
  }
}
