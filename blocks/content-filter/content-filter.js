/*
 * Content Filter
 * Row = one filter control.
 *  - Row with a list (ul/ol) in any cell -> a labelled <select>
 *    (label = first cell text, options = list items; linked items navigate).
 *  - Any other row -> a filter button (label = first cell, key = second cell text)
 *    or a link chip when the row contains a link.
 * Rows with a heading or ending in ":" are intro text; in toolbar/dropdown blocks plain
 * rows are intro text, or the action button label when they follow a dropdown.
 * Non-link buttons toggle sections whose `data-filter` (Section Metadata "filter")
 * matches the key (without tagged sections they scroll to the matching heading),
 * and dispatch a `content-filter:change` event.
 */

function toKey(text) {
  return (text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findTarget(main, key, label) {
  if (key && /^[a-z][\w-]*$/i.test(key)) {
    const byId = main.querySelector(`[id="${key}"]`);
    if (byId) return byId;
  }
  const want = toKey(label);
  if (!want) return null;
  return [...main.querySelectorAll('h2, h3, h4')].find((h) => toKey(h.textContent) === want) || null;
}

function applyFilter(block, key, { label = '', scroll = false } = {}) {
  const main = block.closest('main');
  if (main) {
    const sections = [...main.querySelectorAll(':scope > .section[data-filter]')];
    if (sections.length) {
      sections.forEach((section) => {
        const keys = section.dataset.filter.split(',').map(toKey);
        section.hidden = !(key === 'all' || keys.includes(key));
      });
    } else if (scroll) {
      // no tagged sections: behave as an anchor bar and scroll to the matching heading
      const target = findTarget(main, key, label);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  block.dispatchEvent(new CustomEvent('content-filter:change', { bubbles: true, detail: { key } }));
}

function addGoButton(block, field, text) {
  let go = field.querySelector('.content-filter-go');
  if (go) {
    go.textContent = text;
    return go;
  }
  go = document.createElement('button');
  go.type = 'button';
  go.className = 'content-filter-go';
  go.textContent = text;
  go.addEventListener('click', () => {
    const opt = field.querySelector('select')?.selectedOptions[0];
    if (!opt) return;
    if (opt.dataset.href) {
      window.location.href = opt.dataset.href;
      return;
    }
    applyFilter(block, opt.value, { label: opt.textContent, scroll: true });
  });
  field.append(go);
  return go;
}

function buildSelect(block, row, list, index) {
  const cells = [...row.children];
  let labelText = cells[0] && !cells[0].contains(list) ? cells[0].textContent.trim() : '';
  // identifier-like first cells (e.g. "rbc-caribbean") are field names, not visible labels
  const fieldName = /^[a-z0-9_-]+$/.test(labelText) ? labelText.replace(/[-_]+/g, ' ') : '';
  if (fieldName) labelText = '';
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
  if (!labelText) select.setAttribute('aria-label', fieldName || 'Filter');
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
    const goText = [...row.querySelectorAll('strong, em')].find((el) => !list.contains(el));
    addGoButton(block, field, goText ? goText.textContent.trim() : 'Go');
  } else {
    select.addEventListener('change', () => {
      block.dispatchEvent(new CustomEvent('content-filter:change', {
        bubbles: true, detail: { field: toKey(labelText || fieldName), value: select.value },
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
    applyFilter(block, button.dataset.key, { label: labelText, scroll: true });
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

  const toolbar = block.classList.contains('toolbar');
  const hasLists = rows.some((row) => row.querySelector('ul, ol'));
  let lastField = null;

  rows.forEach((row, i) => {
    const list = row.querySelector('ul, ol');
    if (list) {
      lastField = buildSelect(block, row, list, i);
      fields.append(lastField);
      return;
    }
    const text = row.textContent.trim();
    // headings (e.g. a page title beside a view toggle) and "Label:" rows are intro text
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading || /:$/.test(text)) {
      if (heading) [...row.children].forEach((cell) => info.append(...cell.childNodes));
      else if (info.lastElementChild?.textContent !== text) {
        const p = document.createElement('p');
        p.className = 'content-filter-label';
        p.textContent = text;
        info.append(p);
      }
      return;
    }
    const isText = text && !row.querySelector('a, picture, .icon');
    // toolbar / dropdown blocks: plain text rows are intro text (title, results count);
    // a plain row after a dropdown is the label of its action button
    if (isText && (toolbar || hasLists)) {
      if (lastField && !toolbar) {
        addGoButton(block, lastField, text);
      } else {
        const p = document.createElement('p');
        p.textContent = text;
        info.append(p);
      }
      return;
    }
    const item = buildItem(row, block, items);
    if (item) items.append(item);
  });

  block.replaceChildren(...[info, items, fields].filter((el) => el.children.length));

  // anchor bars (no tagged sections): disable entries with nothing to scroll to, e.g. empty letters
  const main = block.closest('main');
  const buttons = [...items.querySelectorAll('button.content-filter-item')];
  if (main && buttons.length > 2 && !main.querySelector(':scope > .section[data-filter]')) {
    const found = buttons.map((b) => !!findTarget(main, b.dataset.key, b.textContent));
    if (found.some(Boolean)) {
      buttons.forEach((b, i) => { if (!found[i]) b.disabled = true; });
    }
  }

  const firstButton = items.querySelector('button.content-filter-item:not(:disabled)');
  if (firstButton && !toolbar) {
    firstButton.classList.add('active');
    firstButton.setAttribute('aria-pressed', 'true');
    applyFilter(block, firstButton.dataset.key);
  }
}
