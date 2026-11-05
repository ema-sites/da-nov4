function isCurrent(href) {
  try {
    const url = new URL(href, window.location.href);
    const strip = (p) => p.replace(/(index)?\.html$/, '').replace(/\/$/, '');
    const { origin, pathname } = window.location;
    return url.origin === origin && strip(url.pathname) === strip(pathname);
  } catch {
    return false;
  }
}

/**
 * Collect nav items from authored rows. A row may hold:
 * - a title (heading or text without links) -> toggle label
 * - one or more links, optionally with an icon/picture -> nav items
 * - a list of links -> one nav item per list entry
 */
function readContent(block) {
  let title = null;
  const items = [];
  [...block.children].forEach((row) => {
    const links = [...row.querySelectorAll('a[href]')];
    if (!links.length) {
      const text = row.textContent.trim();
      if (text && !title) title = row.querySelector('h1, h2, h3, h4, h5, h6') || text;
      return;
    }
    const listEntries = [...row.querySelectorAll('li')].filter((li) => li.querySelector('a[href]'));
    if (listEntries.length) {
      listEntries.forEach((li) => {
        items.push({ link: li.querySelector('a[href]'), icon: li.querySelector('picture, .icon, img') });
      });
      return;
    }
    const icon = row.querySelector('picture, .icon, img');
    links.forEach((link, i) => items.push({ link, icon: i === 0 ? icon : null }));
  });
  return { title, items };
}

let navCount = 0;

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const { title, items } = readContent(block);
  navCount += 1;
  const listId = `section-nav-list-${navCount}`;

  const nav = document.createElement('nav');
  nav.className = 'section-nav-nav';
  const label = typeof title === 'string' ? title : title?.textContent.trim();
  nav.setAttribute('aria-label', label || 'Section navigation');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'section-nav-toggle';
  toggle.setAttribute('aria-controls', listId);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = label || 'In this section';

  const list = document.createElement('ul');
  list.className = 'section-nav-list';
  list.id = listId;

  items.forEach(({ link, icon }) => {
    const li = document.createElement('li');
    li.className = 'section-nav-item';
    const a = document.createElement('a');
    a.href = link.href;
    if (link.title) a.title = link.title;
    if (icon) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'section-nav-icon';
      iconWrap.append(icon.closest('picture') || icon);
      a.append(iconWrap);
    }
    const text = document.createElement('span');
    text.className = 'section-nav-label';
    text.textContent = link.textContent.trim();
    a.append(text);
    if (isCurrent(a.href)) {
      a.setAttribute('aria-current', 'page');
      li.classList.add('section-nav-active');
    }
    li.append(a);
    list.append(li);
  });

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    block.classList.toggle('section-nav-open', !expanded);
  });

  nav.append(toggle, list);
  block.replaceChildren(nav);
}
