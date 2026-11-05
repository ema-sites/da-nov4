/*
 * Breadcrumb
 * Authored as a list of links (or one link/text per cell or row). Linked items
 * become ancestors; trailing plain text becomes the current page. The alt option
 * covers trails that end on a linked item (no current-page label).
 */

function collectItems(block) {
  const items = [];
  const lis = block.querySelectorAll('li');
  const sources = lis.length
    ? [...lis]
    : [...block.querySelectorAll(':scope > div > div')].flatMap((cell) => {
      const ps = cell.querySelectorAll('p');
      return ps.length ? [...ps] : [cell];
    });
  sources.forEach((el) => {
    const links = el.querySelectorAll('a[href]');
    if (links.length) {
      links.forEach((a) => items.push({ text: a.textContent.trim(), href: a.getAttribute('href') }));
      return;
    }
    const text = el.textContent.trim();
    if (text) items.push({ text });
  });
  return items.filter((item) => item.text);
}

export default function decorate(block) {
  const items = collectItems(block);
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const ol = document.createElement('ol');
  ol.className = 'breadcrumb-list';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    const last = i === items.length - 1;
    if (item.href) {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.text;
      li.append(a);
    } else {
      const span = document.createElement('span');
      span.textContent = item.text;
      li.append(span);
    }
    if (last && !item.href) li.setAttribute('aria-current', 'page');
    // decorative chevron; CSS decides which ones show (alt keeps the trailing one)
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.setAttribute('aria-hidden', 'true');
    li.append(sep);
    ol.append(li);
  });

  nav.append(ol);
  block.replaceChildren(nav);
}
