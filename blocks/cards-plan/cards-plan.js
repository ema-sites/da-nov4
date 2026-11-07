import { createOptimizedPicture } from '../../scripts/aem.js';

const SLIDER_OPTIONS = ['slider', 'slider-3'];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function classifyCell(cell, index, total) {
  if (!cell.textContent.trim() && cell.querySelector('picture, img')) return 'cards-plan-card-image';
  const startsWithHeading = /^H[1-6]$/.test(cell.firstElementChild?.tagName || '');
  if (total > 1 && index < total - 1 && startsWithHeading && !cell.querySelector('ul, ol')) {
    return 'cards-plan-card-header';
  }
  return 'cards-plan-card-body';
}

/* A bold-only paragraph followed by an italic-only one ("<strong>Title</strong>", "<em>Brand</em>")
   is a heading and its tagline. */
const onlyChild = (el, tag) => el?.tagName === 'P' && el.children.length === 1
  && el.firstElementChild.tagName === tag
  && el.textContent.trim() === el.firstElementChild.textContent.trim();
const isBoldTitle = (el) => onlyChild(el, 'STRONG') && onlyChild(el.nextElementSibling, 'EM');

/* When everything is in one cell, split the leading heading block into a header. */
function splitHeader(li, greedy = false) {
  if (li.querySelector('.cards-plan-card-header')) return;
  const body = li.querySelector('.cards-plan-card-body');
  if (!body) return;
  const isHeading = (el) => el && (/^H[1-6]$/.test(el.tagName) || isBoldTitle(el));
  const isText = (el, max) => el?.tagName === 'P'
    && !el.querySelector('picture, img, a:not(:has(> sup))')
    && el.textContent.trim().length <= max;
  let first = body.firstElementChild;
  // a short line above the heading is its eyebrow
  const eyebrow = isText(first, 80) && isHeading(first.nextElementSibling) ? first : null;
  if (eyebrow) first = eyebrow.nextElementSibling;
  if (!isHeading(first)) return;
  const header = document.createElement('div');
  header.className = 'cards-plan-card-header';
  if (eyebrow) {
    eyebrow.classList.add('cards-plan-card-eyebrow');
    header.append(eyebrow);
  }
  header.append(first);
  // a short paragraph straight after the heading is the plan tagline; slider cards take
  // every plain paragraph up to the feature list
  let next = body.firstElementChild;
  while (isText(next, greedy ? Infinity : 80)) {
    header.append(next);
    next = greedy ? body.firstElementChild : null;
  }
  body.before(header);
}

/* Drop importer leftovers: bare text in a paragraph that only repeats its link's label
   ("Comparer Comparer <a>Comparer</a>" from hidden duplicate buttons). */
function dropRepeatedLabels(p) {
  const link = p.querySelector('a');
  if (!link) return;
  const label = link.textContent.trim();
  const texts = [...p.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
  const stray = texts.map((n) => n.textContent).join(' ').trim();
  if (stray && stray.split(/\s+/).join(' ').replaceAll(label, '').trim() === '') texts.forEach((n) => n.remove());
}

function markActions(body) {
  if (!body) return;
  body.querySelectorAll(':scope > p').forEach(dropRepeatedLabels);
  const items = [...body.children];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const el = items[i];
    const onlyLinks = el.querySelector('a') && el.textContent.trim() === [...el.querySelectorAll('a')].map((a) => a.textContent).join('').trim();
    if (!onlyLinks) break;
    el.classList.add('cards-plan-card-action');
  }
  body.querySelectorAll('ul, ol').forEach((list) => {
    if (!list.closest('.cards-plan-card-action')) list.classList.add('cards-plan-card-features');
  });
}

/* A paragraph that starts with an amount ("$3.00 USD /mo", "HK$0 /mo") is the plan price;
   its trailing unit ("/mo") is wrapped so it can be set smaller, and a short
   paragraph right after it ("No minimum balance") is the price note. */
const PRICE_RE = /^\s*[A-Z]{0,3}[$€£¥]\s?\d/;
const UNIT_RE = /\s*(\/\s?[\p{L}.]+)\s*$/u;

function markPrice(body) {
  if (!body) return;
  const price = [...body.children].find((el) => el.tagName === 'P'
    && !el.classList.contains('cards-plan-card-action')
    && !el.querySelector('picture, img, a:not(:has(> sup))')
    && PRICE_RE.test(el.textContent));
  if (!price) return;
  price.classList.add('cards-plan-card-price');
  // the unit is the end of the last text, before any footnote links
  const last = [...price.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).pop();
  const m = last?.textContent.match(UNIT_RE);
  if (m && m.index > 0) {
    const unit = document.createElement('span');
    unit.className = 'cards-plan-card-price-unit';
    [, unit.textContent] = m;
    last.textContent = last.textContent.slice(0, m.index);
    last.after(unit);
  }
  const note = price.nextElementSibling;
  if (note?.tagName === 'P' && !note.classList.contains('cards-plan-card-action')
    && !note.querySelector('a') && note.textContent.trim().length <= 80) {
    note.classList.add('cards-plan-card-price-note');
  }
}

function wrap(className, ...children) {
  const div = document.createElement('div');
  div.className = className;
  div.append(...children);
  return div;
}

/* "Label :<br>value" paragraphs (card rates) become label + value span, grouped in a row. */
function markRates(body) {
  if (!body) return;
  const isRate = (el) => {
    if (el.tagName !== 'P') return false;
    const br = el.querySelector(':scope > br');
    if (!br?.nextSibling) return false;
    const before = [...el.childNodes].slice(0, [...el.childNodes].indexOf(br));
    const label = before.map((n) => n.textContent).join('');
    return before.every((n) => n.nodeType === Node.TEXT_NODE) && /:\s*$/.test(label);
  };
  let group = null;
  [...body.children].forEach((el) => {
    if (!isRate(el)) {
      group = null;
      return;
    }
    const br = el.querySelector(':scope > br');
    const value = document.createElement('span');
    value.className = 'cards-plan-rate-value';
    while (br.nextSibling) value.append(br.nextSibling);
    if (value.firstChild.nodeType === Node.TEXT_NODE) {
      value.firstChild.textContent = value.firstChild.textContent.trimStart();
    }
    el.append(value);
    el.classList.add('cards-plan-rate');
    if (!group) {
      group = wrap('cards-plan-rates');
      el.before(group);
    }
    group.append(el);
  });
}

/* Bold "Label:" paragraphs each followed by a value paragraph become label/value rows. */
function markLabelRows(body) {
  if (!body) return;
  const isLabel = (el) => el?.tagName === 'P' && !el.querySelector('a, img')
    && (el.children.length === 0 || (el.children.length === 1 && el.firstElementChild.tagName === 'STRONG'))
    && el.textContent.trim().length <= 40 && /:\s*$/.test(el.textContent);
  let rows = null;
  [...body.children].forEach((el) => {
    if (el.parentElement !== body) return;
    const value = el.nextElementSibling;
    const isValue = value?.tagName === 'P' && !isLabel(value)
      && !value.querySelector('a:not(:has(> sup))');
    if (!isLabel(el) || !isValue) {
      rows = null;
      return;
    }
    if (!rows) {
      rows = wrap('cards-plan-rows');
      el.before(rows);
    }
    rows.append(wrap('cards-plan-row', el, value));
  });
}

/* Credit-card mini card (source .mini-card): [offer caption], card name, fee label, fee value,
   three rate label/value pairs, compare link and card link, all as plain paragraphs. */
const OFFER_RE = /offer|offre|优惠|優惠|limited|spécial/i;
const FEE_LABEL_RE = /^(annual fee|monthly fee|interest rate|frais annuels|frais mensuels|年费|年費|月费|月費)\s*:?$/i;
const isFeeLabel = (el) => el.tagName === 'P' && !el.querySelector('strong')
  && FEE_LABEL_RE.test(el.textContent.trim());
const isLinkOnly = (el) => el.tagName === 'P' && el.querySelector('a')
  && el.textContent.trim() === [...el.querySelectorAll('a')].map((a) => a.textContent).join('').trim();
const isShort = (el, max) => el?.tagName === 'P' && !el.querySelector('a, img')
  && el.textContent.trim().length <= max;
const isRateLabel = (el) => isShort(el, 40) && !/\d/.test(el.textContent);
const isRateValue = (el) => el?.tagName === 'P' && !el.querySelector('img')
  && /\d/.test(el.textContent) && el.textContent.trim().length <= 40;

function isMiniCard(cell) {
  const items = [...cell.children];
  if (items.some((el) => el.tagName !== 'P') || (items.length !== 11 && items.length !== 12)) return false;
  const [compare, link] = items.slice(-2);
  const feeLabel = items[items.length === 12 ? 2 : 1];
  return !!compare.querySelector('a') && /compar/i.test(compare.textContent) && isLinkOnly(link)
    && FEE_LABEL_RE.test(feeLabel.textContent.trim());
}

function buildMiniCard(li, body) {
  if (!isMiniCard(body)) return;
  const items = [...body.children];
  const [compare, link] = items.slice(-2);
  const caption = items.length === 12 ? items.shift() : null;
  const [name, feeLabel, feeValue, ...rates] = items.slice(0, -2);
  li.classList.add('cards-plan-mini');
  if (caption) caption.className = 'cards-plan-mini-caption';
  name.className = 'cards-plan-mini-name';
  dropRepeatedLabels(compare);
  compare.className = 'cards-plan-mini-compare';
  const pairs = [0, 2, 4].map((i) => wrap('cards-plan-mini-rate', rates[i], rates[i + 1]));
  body.replaceChildren(
    ...(caption ? [caption] : []),
    wrap('cards-plan-mini-details', name, wrap('cards-plan-mini-fee', feeLabel, feeValue)),
    wrap('cards-plan-mini-rates', ...pairs),
    wrap('cards-plan-mini-footer', compare, link),
  );
}

/* Credit-card grid card (source #card-grid-container .card-container), authored as flat
   paragraphs: [captions], title, "Annual Fee" label, fee, [description], [offer caption and
   text], features, "view card" link, three rate label/value pairs, [compare], actions. */
/* Icon features: an image-only paragraph followed by a heading and its text become one
   .cards-plan-card-feature (icon beside heading and text). */
function groupIconFeatures(body) {
  if (!body) return;
  const isIcon = (el) => el?.tagName === 'P' && !el.textContent.trim() && el.querySelector('img');
  [...body.children].forEach((el) => {
    if (!isIcon(el) || !/^H[2-6]$/.test(el.nextElementSibling?.tagName || '')) return;
    const feature = wrap('cards-plan-card-feature');
    el.classList.add('cards-plan-card-feature-icon');
    el.before(feature);
    feature.append(el, el.nextElementSibling);
    const text = feature.nextElementSibling;
    if (text?.tagName === 'P' && !isIcon(text) && !isLinkOnly(text)) feature.append(text);
  });
}

function findRates(items, from) {
  for (let i = from; i + 5 < items.length; i += 1) {
    const isPair = (k) => isRateLabel(items[i + k]) && isRateValue(items[i + k + 1]);
    if ([0, 2, 4].every(isPair)) return i;
  }
  return -1;
}

function buildCreditCard(li, cells, content) {
  li.classList.add('cards-plan-cc');
  const image = document.createElement('div');
  image.className = 'cards-plan-card-image';
  cells.filter((c) => c !== content).forEach((c) => image.append(...c.childNodes));
  // "#" links are leftovers of source tab buttons ("Offer"): keep their text only
  content.querySelectorAll('a[href="#"]:not(:has(sup))').forEach((a) => a.replaceWith(...a.childNodes));
  const items = [...content.children];
  const feeAt = items.findIndex(isFeeLabel);
  const titleAt = feeAt - 1;
  const groups = [];
  // captions above the title sit on the image panel
  if (titleAt > 0) image.append(wrap('cards-plan-cc-captions', ...items.slice(0, titleAt)));
  if (titleAt >= 0) items[titleAt].classList.add('cards-plan-cc-title');
  const fee = wrap('cards-plan-cc-fee', ...items.slice(feeAt, feeAt + 2));
  groups.push(wrap('cards-plan-cc-header', ...(titleAt >= 0 ? [items[titleAt]] : []), fee));
  let i = feeAt + 2;
  // a short line with a figure right under the fee is its note ("1 year", "First year only")
  const note = items[i];
  if (note?.tagName === 'P' && !note.querySelector('img, a:not(:has(> sup))')
    && note.textContent.trim().length <= 12 && /\d/.test(note.textContent)) {
    fee.append(note);
    i += 1;
  }
  const rateAt = findRates(items, i);
  const end = rateAt >= 0 ? rateAt : items.length;
  const len = (el) => el.textContent.trim().length;
  // an offer caption is a short line over a much longer offer text
  const isOfferLink = (el) => isLinkOnly(el) && len(el) <= 30 && OFFER_RE.test(el.textContent);
  const isCaption = (k) => k + 1 < end && (isShort(items[k], 30) || isOfferLink(items[k]))
    && (OFFER_RE.test(items[k].textContent) || (!/\p{Script=Han}/u.test(items[k].textContent)
      && len(items[k + 1]) >= Math.max(30, 2.5 * len(items[k]))));
  if (!isCaption(i) && isCaption(i + 1)) {
    items[i].classList.add('cards-plan-cc-description');
    groups.push(items[i]);
    i += 1;
  }
  if (isCaption(i)) {
    groups.push(wrap('cards-plan-cc-offer', ...items.slice(i, i + 2)));
    i += 2;
  }
  const rest = items.slice(i);
  const seen = new Set();
  let features = null;
  rest.forEach((el, k) => {
    const at = i + k;
    if (rateAt >= 0 && at >= rateAt && at < rateAt + 6) {
      if (at === rateAt) {
        const pairs = [0, 2, 4]
          .map((n) => wrap('cards-plan-cc-rate', items[rateAt + n], items[rateAt + n + 1]));
        groups.push(wrap('cards-plan-cc-rates', ...pairs));
      }
      features = null;
      return;
    }
    if (isLinkOnly(el)) {
      el.classList.add('cards-plan-card-action');
      groups.push(el);
      features = null;
      return;
    }
    const compareLabel = /^\s*compar\w*\s*$/i.test(el.textContent);
    if (el.tagName === 'P' && (el.querySelector('a') || compareLabel) && /^\s*compar/i.test(el.textContent)) {
      dropRepeatedLabels(el);
      el.className = 'cards-plan-cc-compare';
      groups.push(el);
      features = null;
      return;
    }
    // the import repeats the feature list (source desktop and mobile copies): keep one
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (seen.has(text)) return;
    seen.add(text);
    if (!features) {
      features = wrap('cards-plan-cc-features');
      groups.push(features);
    }
    features.append(el);
  });
  const body = wrap('cards-plan-card-body', ...groups);
  li.replaceChildren(...(image.childNodes.length ? [image] : []), body);
}

function buildSlider(block, ul) {
  const track = document.createElement('div');
  track.className = 'cards-plan-track';
  track.append(ul);
  const nav = document.createElement('div');
  nav.className = 'cards-plan-nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cards-plan-prev';
  prev.setAttribute('aria-label', 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cards-plan-next';
  next.setAttribute('aria-label', 'Next');
  nav.append(prev, next);

  const cards = [...ul.children];
  const dots = document.createElement('ul');
  dots.className = 'cards-plan-dots';
  cards.forEach((card, i) => {
    const dot = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.append(button);
    dots.append(dot);
  });

  const step = () => {
    const [a, b] = cards;
    return b ? b.offsetLeft - a.offsetLeft : track.clientWidth;
  };
  const current = () => Math.round(track.scrollLeft / step());
  const update = () => {
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    const active = current();
    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('active', i === active);
      dot.firstElementChild.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  dots.addEventListener('click', (e) => {
    const dot = e.target.closest('li');
    if (!dot) return;
    track.scrollTo({ left: [...dots.children].indexOf(dot) * step(), behavior: 'smooth' });
  });
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  block.replaceChildren(track, nav, dots);
  requestAnimationFrame(update);
}

/* The import turns the source's non-breaking spaces into plain ones; restore them inside
   amounts ("1 500 $", "20,99 %") so a figure never wraps away from its unit. */
function keepAmountsTogether(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/(\d) (?=\d{3}(?!\d)|[$%])/g, '$1\u00a0');
    if (text !== node.textContent) node.textContent = text;
  }
}

/* Generic "read more" links get the card title as hidden text, like the source's offscreen
   span, so each link is unique for screen readers ("Lisez la suite (Outils et calculatrices)"). */
const GENERIC_LINK_RE = /^(lisez la suite|read more|learn more|en savoir plus)$/i;

function nameGenericLinks(li) {
  const title = li.querySelector('h2, h3, h4, h5, h6, .cards-plan-cc-title');
  if (!title) return;
  li.querySelectorAll('a').forEach((a) => {
    if (!GENERIC_LINK_RE.test(a.textContent.trim())) return;
    const hidden = document.createElement('span');
    hidden.className = 'cards-plan-offscreen';
    hidden.textContent = ` (${title.textContent.trim()})`;
    a.append(hidden);
  });
}

/* light: the feature list is collapsed behind a "View More" toggle, like the source cards. */
const TOGGLE_OPTIONS = ['light'];
const TOGGLE_LABELS = {
  en: ['View More', 'View Less'],
  fr: ['Voir plus', 'Voir moins'],
};

let toggleCount = 0;

/* page language: the html lang, else the /fr/ path segment (French pages may keep lang="en") */
function pageLang() {
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  if (lang !== 'en') return lang;
  return /(^|\/)fr(\/|$)/.test(window.location.pathname) ? 'fr' : 'en';
}

/* light cards name their footnote links like the source ("legal disclaimer 2") */
const FOOTNOTE_LABELS = { en: 'legal disclaimer ', fr: 'avis de non-responsabilité ' };

function nameFootnotes(li) {
  const lang = pageLang();
  li.querySelectorAll('a:has(> sup)').forEach((a) => {
    const hidden = document.createElement('span');
    hidden.className = 'cards-plan-offscreen';
    hidden.textContent = FOOTNOTE_LABELS[lang] || FOOTNOTE_LABELS.en;
    a.prepend(hidden);
  });
}

function addToggle(target, labels) {
  const lang = pageLang();
  const [more, less] = labels[lang] || labels.en;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cards-plan-toggle';
  toggleCount += 1;
  target.id = target.id || `cards-plan-more-${toggleCount}`;
  button.setAttribute('aria-controls', target.id);
  button.setAttribute('aria-expanded', 'false');
  const moreLabel = document.createElement('span');
  moreLabel.className = 'cards-plan-toggle-more';
  moreLabel.textContent = more;
  const lessLabel = document.createElement('span');
  lessLabel.className = 'cards-plan-toggle-less';
  lessLabel.textContent = less;
  button.append(moreLabel, lessLabel);
  target.hidden = true;
  target.before(button);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    target.hidden = !open;
  });
}

function addListToggle(li) {
  const list = li.querySelector('.cards-plan-card-features');
  if (list) addToggle(list, TOGGLE_LABELS);
}

/* image-light-2: what follows the fee rows (rewards details, other fees) sits behind a
   "Détails" toggle, like the source's collapsed panel */
const DETAILS_OPTIONS = ['image-light-2'];
const DETAILS_LABELS = { en: ['Details', 'Details'], fr: ['Détails', 'Détails'] };

function addDetailsToggle(li) {
  const body = [...li.querySelectorAll('.cards-plan-card-body')].pop();
  const rows = body?.querySelector(':scope > .cards-plan-rows');
  if (!rows) return;
  const hidden = [];
  for (let el = rows.nextElementSibling; el && !el.classList.contains('cards-plan-card-action');
    el = el.nextElementSibling) hidden.push(el);
  if (!hidden.length) return;
  const details = wrap('cards-plan-card-details', ...hidden);
  rows.after(details);
  addToggle(details, DETAILS_LABELS);
}

export default function decorate(block) {
  keepAmountsTogether(block);
  const isSlider = SLIDER_OPTIONS.some((o) => block.classList.contains(o));
  const hasToggle = TOGGLE_OPTIONS.some((o) => block.classList.contains(o));
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    const li = document.createElement('li');
    // importer leftovers from unrendered source templates
    cells.forEach((c) => c.querySelectorAll(':scope > p').forEach((p) => {
      if (p.textContent.trim() === 'undefined') p.remove();
    }));
    // a fee label followed by more "Label:" lines is a plain label/value table, not a card grid
    const isTable = (c) => [...c.children].some((el) => isFeeLabel(el)
      && /:\s*$/.test(el.nextElementSibling?.nextElementSibling?.textContent || ''));
    const ccCell = cells.find((c) => !isMiniCard(c) && !isTable(c)
      && [...c.children].some(isFeeLabel));
    if (ccCell) {
      buildCreditCard(li, cells, ccCell);
      ul.append(li);
      return;
    }
    cells.forEach((cell, i) => {
      const div = document.createElement('div');
      div.className = classifyCell(cell, i, cells.length);
      div.append(...cell.childNodes);
      li.append(div);
    });
    splitHeader(li, isSlider);
    const body = [...li.querySelectorAll('.cards-plan-card-body')].pop();
    markActions(body);
    if (body && isMiniCard(body)) {
      buildMiniCard(li, body);
    } else {
      markPrice(body);
      markRates(body);
      markLabelRows(body);
      groupIconFeatures(body);
    }
    // image-2: the source sets everything after the first list in a second column
    if (block.classList.contains('image-2') && body) {
      const first = body.querySelector(':scope > ul');
      const rest = first ? [...body.children].slice([...body.children].indexOf(first) + 1) : [];
      if (rest.length) body.append(wrap('cards-plan-card-aside', ...rest));
    }
    nameGenericLinks(li);
    if (DETAILS_OPTIONS.some((o) => block.classList.contains(o))) addDetailsToggle(li);
    if (hasToggle) {
      addListToggle(li);
      nameFootnotes(li);
    }
    ul.append(li);
  });

  optimizeImages(ul);
  if (ul.children.length === 1) block.classList.add('cards-plan-single');

  if (isSlider && ul.children.length > 1) {
    block.classList.add('cards-plan-slider');
    buildSlider(block, ul);
  } else {
    block.replaceChildren(ul);
  }
}
