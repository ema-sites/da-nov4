/**
 * Fetches the footer fragment: /content first (local preview), then the site root (DA/EDS).
 * Relative image paths are resolved against the fragment URL.
 * @returns {Promise<HTMLElement|null>} container holding the fragment sections
 */
async function fetchFooter() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
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

/** First section: a list whose items are link columns (headings + link lists + badges) */
function buildLinkColumns(section) {
  const list = section.querySelector(':scope > ul');
  const grid = el('div', 'footer-columns');
  if (!list) return el('div', 'footer-links', section);
  [...list.children].forEach((li) => {
    const col = el('div', 'footer-column');
    [...li.children].forEach((child) => {
      if (child.tagName === 'P' && child.querySelector('strong') && !child.querySelector('a')) {
        const h = el('p', 'footer-heading', child.textContent.trim());
        col.append(h);
      } else if (child.tagName === 'UL') {
        child.className = 'footer-link-list';
        col.append(child);
      } else if (child.querySelector('img')) {
        child.className = 'footer-badge';
        col.append(child);
      } else {
        col.append(child);
      }
    });
    grid.append(col);
  });
  return el('div', 'footer-links', el('div', 'footer-inner', grid));
}

/** Second section: copyright + legal links on the left, social icons + back-to-top on the right */
function buildLegalBar(section) {
  const left = el('div', 'footer-legal');
  const right = el('div', 'footer-aside');
  [...section.children].forEach((child) => {
    if (child.tagName === 'UL') {
      child.className = 'footer-social';
      child.querySelectorAll('a').forEach((a) => {
        const img = a.querySelector('img');
        if (img && img.alt) a.setAttribute('aria-label', img.alt);
        a.target = '_blank';
        a.rel = 'noopener';
      });
      right.append(child);
    } else if (child.querySelector('a[href^="#"]') && child.querySelector('img')) {
      // in-page link with an icon -> back to top
      const a = child.querySelector('a');
      a.className = 'footer-top';
      a.setAttribute('aria-label', `Back to ${a.textContent.trim()}`);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelector('header a, header button')?.focus({ preventScroll: true });
      });
      right.append(el('div', 'footer-top-wrap', a));
    } else {
      if (child.querySelector('a')) child.className = 'footer-legal-links';
      left.append(child);
    }
  });
  return el('div', 'footer-bar', el('div', 'footer-inner', left, right));
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  block.textContent = '';
  if (!fragment) return;
  const [linksSec, legalSec, ...rest] = [...fragment.children].filter((c) => c.tagName === 'DIV');
  const footer = el('div', 'footer-content');
  if (linksSec) footer.append(buildLinkColumns(linksSec));
  if (legalSec) footer.append(buildLegalBar(legalSec));
  rest.forEach((sec) => footer.append(el('div', 'footer-extra', ...sec.childNodes)));
  block.append(footer);
}
