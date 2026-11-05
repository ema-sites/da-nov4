// media query match that indicates desktop width
const isDesktop = window.matchMedia('(width >= 900px)');

/**
 * Fetches the nav fragment: /content first (local preview), then the site root (DA/EDS).
 * Relative image paths are resolved against the fragment URL.
 * @returns {Promise<HTMLElement|null>} container holding the fragment sections
 */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  container.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:|\/|data:)/.test(src)) img.src = new URL(src, resp.url).href;
  });
  return container;
}

const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  children.filter(Boolean).forEach((c) => node.append(c));
  return node;
};

/** Text of an element without the text of its nested lists */
const ownText = (li) => [...li.childNodes]
  .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'UL'))
  .map((n) => n.textContent)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

function closeAll(nav, except) {
  nav.querySelectorAll('[aria-expanded="true"]').forEach((t) => {
    if (t === except) return;
    t.setAttribute('aria-expanded', 'false');
    const item = t.closest('.nav-item, .nav-has-dropdown');
    if (item) item.classList.remove('is-open');
  });
}

function setOpen(nav, trigger, open) {
  if (open) closeAll(nav, trigger);
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  const item = trigger.closest('.nav-item, .nav-has-dropdown');
  if (item) item.classList.toggle('is-open', open);
}

/** li with a label and a nested list -> button + dropdown list (utility / tools rows) */
function buildDropdown(li, nav) {
  const list = li.querySelector(':scope > ul');
  const label = ownText(li);
  const button = el('button', 'nav-dropdown-trigger', label);
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  list.className = 'nav-dropdown';
  list.querySelectorAll(':scope > li').forEach((item) => {
    if (!item.querySelector('a')) item.classList.add('nav-dropdown-current');
  });
  li.replaceChildren(button, list);
  li.classList.add('nav-has-dropdown');
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(nav, button, button.getAttribute('aria-expanded') !== 'true');
  });
}

/** One column <li> of a panel -> column element (link groups or promo card) */
function buildColumn(li) {
  const col = el('div', 'nav-panel-col');
  const img = li.querySelector('img');
  if (img && !li.querySelector(':scope > ul')) {
    const card = el('div', 'nav-promo');
    const media = el('div', 'nav-promo-image', img);
    const body = el('div', 'nav-promo-body');
    [...li.children].forEach((child) => {
      if (!child.contains(img) || child.textContent.trim()) body.append(child);
    });
    body.querySelectorAll('p:empty').forEach((p) => p.remove());
    card.append(media, body);
    col.append(card);
    return col;
  }
  [...li.children].forEach((child) => {
    if (child.tagName === 'P' && child.querySelector('strong') && !child.querySelector('a')) {
      child.className = 'nav-panel-title';
      child.querySelectorAll('strong').forEach((s) => s.replaceWith(...s.childNodes));
    } else if (child.tagName === 'UL') {
      child.className = 'nav-panel-links';
    }
    col.append(child);
  });
  return col;
}

function buildGrid(list) {
  const cols = [...list.children].map(buildColumn);
  const grid = el('div', 'nav-panel-grid', ...cols);
  grid.style.setProperty('--nav-panel-cols', cols.length);
  return grid;
}

/** A panel list whose items each hold their own column list -> side tabs */
const isTabbed = (list) => [...list.children].every((li) => {
  const sub = li.querySelector(':scope > ul');
  return sub && [...sub.children].some((c) => c.querySelector(':scope > ul'));
});

function buildTabbedPanel(list) {
  const tabs = el('ul', 'nav-tabs');
  const panes = el('div', 'nav-tab-panes');
  [...list.children].forEach((li, i) => {
    const titleP = li.querySelector(':scope > p');
    const badge = titleP && titleP.querySelector('em');
    const label = titleP ? titleP.querySelector('strong')?.textContent.trim() || titleP.textContent.trim() : ownText(li);
    const tab = el('button', 'nav-tab', el('span', 'nav-tab-label', label));
    tab.type = 'button';
    if (badge) tab.append(el('span', 'nav-badge', badge.textContent.trim()));
    const pane = el('div', 'nav-tab-pane', buildGrid(li.querySelector(':scope > ul')));
    const activate = () => {
      tabs.querySelectorAll('.nav-tab').forEach((t) => t.setAttribute('aria-selected', 'false'));
      panes.querySelectorAll('.nav-tab-pane').forEach((p) => { p.hidden = true; });
      tab.setAttribute('aria-selected', 'true');
      pane.hidden = false;
    };
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    pane.hidden = i !== 0;
    tab.addEventListener('mouseenter', activate);
    tab.addEventListener('focus', activate);
    tab.addEventListener('click', activate);
    tabs.append(el('li', '', tab));
    panes.append(pane);
  });
  tabs.setAttribute('role', 'tablist');
  return el('div', 'nav-panel nav-panel-tabbed', el('div', 'nav-panel-inner', tabs, panes));
}

function buildMainNav(section, nav, header) {
  const list = section.querySelector('ul');
  list.className = 'nav-sections';
  [...list.children].forEach((li) => {
    li.classList.add('nav-item');
    const trigger = li.querySelector(':scope > a');
    const sub = li.querySelector(':scope > ul');
    if (!sub) return;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    const iconOnly = trigger.querySelector('img') && !trigger.textContent.trim();
    let panel;
    if (isTabbed(sub)) {
      panel = buildTabbedPanel(sub);
    } else {
      // paragraphs after the column list are panel-wide footnotes
      const notes = [...li.querySelectorAll(':scope > p')];
      notes.forEach((p) => { p.className = 'nav-panel-note'; });
      panel = el('div', 'nav-panel', el('div', 'nav-panel-inner', buildGrid(sub), ...notes));
    }
    sub.remove();
    li.append(panel);
    if (iconOnly) {
      // icon-only item: a click toggle that stays open until clicked away
      li.classList.add('nav-item-toggle');
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-label', trigger.querySelector('img').alt || 'More');
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(nav, trigger, trigger.getAttribute('aria-expanded') !== 'true');
      });
    } else {
      li.classList.add('nav-item-hover');
      li.addEventListener('mouseenter', () => { if (isDesktop.matches) setOpen(nav, trigger, true); });
      trigger.addEventListener('focus', () => { if (isDesktop.matches) setOpen(nav, trigger, true); });
    }
  });
  header.addEventListener('mouseleave', () => {
    if (!isDesktop.matches) return;
    nav.querySelectorAll('.nav-item-hover > a[aria-expanded="true"]').forEach((t) => setOpen(nav, t, false));
  });
  return el('div', 'nav-main', el('div', 'nav-main-inner', list));
}

function buildSearch(section, nav, action) {
  const logo = section.querySelector('img');
  const placeholder = [...section.querySelectorAll('p')].map((p) => p.textContent.trim()).find(Boolean) || 'Search';
  const form = el('form', 'nav-search-form');
  form.method = 'get';
  form.action = action;
  form.setAttribute('role', 'search');
  const input = el('input', 'nav-search-input');
  input.type = 'search';
  input.name = 'question';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  input.autocomplete = 'off';
  form.append(input);
  const close = el('button', 'nav-search-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close search');
  const bar = el('div', 'nav-search-bar', el('div', 'nav-search-inner', logo ? el('div', 'nav-search-logo', logo) : null, form, close));
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', placeholder);
  const backdrop = el('div', 'nav-search-backdrop');
  const overlay = el('div', 'nav-search', bar, backdrop);
  overlay.hidden = true;
  const hide = () => {
    overlay.hidden = true;
    document.body.classList.remove('nav-search-open');
    nav.querySelector('.nav-search-trigger')?.setAttribute('aria-expanded', 'false');
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  overlay.show = () => {
    closeAll(nav);
    overlay.hidden = false;
    document.body.classList.add('nav-search-open');
    input.focus();
  };
  overlay.hide = hide;
  return overlay;
}

function buildBrand(section, nav) {
  const logoLink = section.querySelector(':scope > p a');
  if (logoLink) {
    logoLink.className = 'nav-logo';
    const text = logoLink.textContent.trim();
    [...logoLink.childNodes].forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    logoLink.append(el('span', 'nav-logo-text', text));
    logoLink.setAttribute('aria-label', text);
  }
  const tools = section.querySelector(':scope > ul');
  let searchAction = '/search-public/index.html';
  if (tools) {
    tools.className = 'nav-tools';
    [...tools.children].forEach((li) => {
      const a = li.querySelector(':scope > a, :scope > strong > a');
      if (li.querySelector(':scope > ul')) {
        buildDropdown(li, nav);
      } else if (a && a.querySelector('img')) {
        // link with an icon -> search trigger
        searchAction = a.getAttribute('href') || searchAction;
        const label = el('span', 'nav-search-label', ...a.childNodes);
        const btn = el('button', 'nav-search-trigger', label);
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open search dialog');
        li.replaceChildren(btn);
        li.classList.add('nav-tool-search');
      } else if (li.querySelector(':scope > strong > a')) {
        const strong = li.querySelector(':scope > strong');
        a.className = 'nav-cta';
        strong.replaceWith(a);
        li.classList.add('nav-tool-cta');
      } else if (a) {
        a.className = 'nav-tool-link';
      }
    });
  }
  return { el: el('div', 'nav-brand', el('div', 'nav-brand-inner', logoLink?.closest('p') ? logoLink : null, tools)), searchAction };
}

function buildUtility(section, nav) {
  const list = section.querySelector('ul');
  if (list) {
    list.className = 'nav-lob';
    const here = window.location.pathname.replace(/^\/content/, '').replace(/\.html$/, '').replace(/\/index$/, '/');
    let activeSet = false;
    [...list.children].forEach((li) => {
      if (li.querySelector(':scope > ul')) { buildDropdown(li, nav); return; }
      const a = li.querySelector('a');
      if (!a) return;
      const path = new URL(a.href, window.location.href).pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
      if (!activeSet && (path === here || (here === '/' && /\/personal$/.test(path)))) {
        li.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
        a.prepend(el('span', 'nav-sr-only', 'You are in:'));
        activeSet = true;
      }
    });
    const first = list.querySelector('li > a');
    if (!activeSet && first) {
      first.parentElement.classList.add('is-active');
      first.prepend(el('span', 'nav-sr-only', 'You are in:'));
    }
  }
  // an in-page link (#...) is the skip link; other paragraph links sit on the right
  const skip = [...section.querySelectorAll(':scope > p a')].find((a) => a.getAttribute('href')?.startsWith('#'));
  if (skip) {
    skip.className = 'nav-skip';
    const target = skip.getAttribute('href').slice(1);
    const main = document.querySelector('main');
    if (main && target && !document.getElementById(target)) main.id = target;
    nav.prepend(skip);
  }
  const extra = [...section.querySelectorAll(':scope > p a')];
  extra.forEach((a) => { a.className = 'nav-utility-link'; });
  const extraWrap = extra.length ? el('div', 'nav-utility-extra', ...extra) : null;
  return el('div', 'nav-utility', el('div', 'nav-utility-inner', list, extraWrap));
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNav();
  block.textContent = '';
  if (!fragment) return;
  const sections = [...fragment.children].filter((c) => c.tagName === 'DIV');
  // the published nav wraps each top-level list item's label in a <p>; unwrap it
  sections.forEach((s) => s.querySelectorAll(':scope > ul > li > p:first-child').forEach((p) => p.replaceWith(...p.childNodes)));
  const header = block.closest('header') || block;
  const nav = el('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');

  const [utilitySec, brandSec, mainSec, searchSec] = sections;
  if (utilitySec) nav.append(buildUtility(utilitySec, nav));
  let searchAction = '/search-public/index.html';
  if (brandSec) {
    const brand = buildBrand(brandSec, nav);
    searchAction = brand.searchAction;
    nav.append(brand.el);
  }
  if (mainSec) nav.append(buildMainNav(mainSec, nav, header));
  const search = searchSec ? buildSearch(searchSec, nav, searchAction) : null;

  nav.querySelector('.nav-search-trigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.currentTarget.setAttribute('aria-expanded', 'true');
    search?.show();
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAll(nav);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (search && !search.hidden) { search.hide(); return; }
    const open = nav.querySelector('[aria-expanded="true"]');
    closeAll(nav);
    if (open) open.focus();
  });
  nav.addEventListener('focusout', (e) => {
    if (!nav.contains(e.relatedTarget)) closeAll(nav);
  });
  isDesktop.addEventListener('change', () => {
    closeAll(nav);
    search?.hide();
  });

  const wrapper = el('div', 'nav-wrapper', nav);
  block.append(wrapper);
  if (search) block.append(search);
}
