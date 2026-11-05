/*
 * Anchor Nav
 * In-page link bar. Any rows/cells containing links (or a list of links) are
 * collected into one horizontal list. Links to #ids on the page get an active
 * state while their target section is in view.
 * Rows without links are kept as plain text cells (e.g. a label/value row).
 */

function watchTargets(links) {
  if (!('IntersectionObserver' in window)) return;
  const map = new Map();
  links.forEach((a) => {
    const hash = a.getAttribute('href') || '';
    if (!hash.startsWith('#') || hash.length < 2) return;
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (e) {
      target = null;
    }
    if (target) map.set(target, a);
  });
  if (!map.size) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      map.get(entry.target).setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '0px 0px -60% 0px' });
  map.forEach((_, target) => observer.observe(target));
}

export default function decorate(block) {
  const links = [...block.querySelectorAll('a[href]')];
  const nav = document.createElement('nav');
  nav.className = 'anchor-nav-links';
  nav.setAttribute('aria-label', block.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || 'On this page');

  if (!links.length) {
    // no links: keep authored cells as a simple row
    [...block.children].forEach((row) => {
      row.classList.add('anchor-nav-row');
      [...row.children].forEach((cell) => cell.classList.add('anchor-nav-cell'));
    });
    return;
  }

  const ul = document.createElement('ul');
  links.forEach((a) => {
    const li = document.createElement('li');
    li.append(a);
    a.classList.remove('button');
    a.closest('.button-container')?.classList.remove('button-container');
    ul.append(li);
  });
  nav.append(ul);
  block.replaceChildren(nav);
  watchTargets(links);
}
