/*
 * Product Details
 * Each row is one panel of a product page body. Panel layout is inferred per row:
 *  - one cell                         -> full-width panel (intro box, benefits, promo)
 *  - image-only cell + content cell   -> media panel (product image beside details)
 *  - two or more content cells        -> side-by-side panels (e.g. pros / cons)
 * Inside a panel, lists whose items start with an icon/image become feature lists.
 * Links alone in a paragraph (bold/italic or the only content) become buttons.
 *
 * A media panel whose content holds a card's rates (annual fee, purchase rate...) is a card
 * overview: the card column (image with category chips, offer box, rates, notes, apply button,
 * legal link) beside the content column (intro box, highlights, earn rates).
 */

const RATE_LABEL = /^(frais annuels|annual fee|frais mensuels|monthly fee|carte supplémentaire|additional card|taux |purchase rate|cash advance rate|balance transfer)/i;
const RATE_VALUE = /^(?:\$\s?)?\d[\d\s.,]*(?:%|\$)?(?:\s?US)?[\s*^†‡]*$/;
const OFFER_CAPTION = /^(offre|special offer|limited[- ]time offer)/i;

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

function isImageOnly(cell) {
  return !!cell.querySelector('picture') && !cell.textContent.trim();
}

const isChip = (el) => {
  const t = text(el);
  return el.matches('p') && !el.children.length && t.length > 0 && t.length < 40
    && t === t.toUpperCase() && /\p{L}/u.test(t) && !OFFER_CAPTION.test(t);
};
const isOfferCaption = (el) => el.matches('p') && !el.children.length
  && text(el).length < 40 && OFFER_CAPTION.test(text(el));
const isRateLabel = (el) => el.matches('p') && RATE_LABEL.test(text(el));
const isRateValue = (el) => el.matches('p') && RATE_VALUE.test(text(el)) && /\d/.test(text(el));
const isLegalLink = (el) => {
  const a = el.matches('p') && el.querySelector(':scope > a[href^="#legal"]');
  return !!a && text(a) === text(el);
};

function decorateFeatureLists(scope) {
  scope.querySelectorAll('ul, ol').forEach((list) => {
    const items = [...list.children];
    if (!items.length) return;
    const withIcon = items.filter((li) => {
      const first = li.firstElementChild;
      return first && (first.matches('picture, .icon, img') || first.querySelector(':scope > picture, :scope > .icon'));
    });
    if (withIcon.length && withIcon.length >= items.length / 2) {
      list.classList.add('product-details-features');
      withIcon.forEach((li) => {
        const icon = li.querySelector('picture, .icon, img');
        const iconWrap = document.createElement('span');
        iconWrap.className = 'product-details-feature-icon';
        const holder = icon.parentElement;
        iconWrap.append(icon);
        if (holder !== li && !holder.textContent.trim() && !holder.children.length) holder.remove();
        const body = document.createElement('div');
        body.className = 'product-details-feature-body';
        body.append(...li.childNodes);
        li.replaceChildren(iconWrap, body);
      });
    }
  });
}

/* An icon paragraph (picture only) followed by a heading becomes an icon item. */
function decorateIconItems(scope) {
  scope.querySelectorAll(':scope > p').forEach((p) => {
    if (!isImageOnly(p)) return;
    const heading = p.nextElementSibling;
    if (!heading || !heading.matches('h3, h4, h5, h6')) return;
    const item = document.createElement('div');
    item.className = 'product-details-icon-item';
    const icon = document.createElement('span');
    icon.className = 'product-details-icon';
    icon.append(...p.childNodes);
    const body = document.createElement('div');
    body.className = 'product-details-icon-body';
    p.replaceWith(item);
    body.append(heading);
    while (item.nextElementSibling && item.nextElementSibling.matches('p') && !isImageOnly(item.nextElementSibling)
      && !item.nextElementSibling.querySelector('a.button, picture')) {
      body.append(item.nextElementSibling);
    }
    item.append(icon, body);
  });
}

/* Short paragraphs as labels: category chips and offer captions. */
function decorateCaptions(scope) {
  scope.querySelectorAll('p').forEach((p) => {
    if (isOfferCaption(p) || (p.matches(':first-child') && /:$/.test(text(p)) && text(p).length < 40
      && OFFER_CAPTION.test(text(p)))) p.classList.add('product-details-offer-caption');
  });
}

function decorateButtons(scope) {
  scope.querySelectorAll('p > a:only-child').forEach((a) => {
    const p = a.parentElement;
    if (p.textContent.trim() !== a.textContent.trim()) return;
    if (p.closest('.product-details-offer, .product-details-rates')) return;
    if (p.matches('p:only-child') || a.closest('strong, em') || p.querySelector('strong > a, em > a')) {
      a.classList.add('button');
      p.classList.add('button-container');
    }
  });
}

function buildRateRow(labelEl, valueEl) {
  const row = document.createElement('div');
  row.className = 'product-details-rate';
  const label = document.createElement('span');
  label.className = 'product-details-rate-label';
  const value = document.createElement('span');
  value.className = 'product-details-rate-value';
  if (valueEl) {
    label.append(...labelEl.childNodes);
    value.append(...valueEl.childNodes);
  } else {
    // "Label : value" or "Label value" in one paragraph
    const bare = labelEl.cloneNode(true);
    bare.querySelectorAll('a').forEach((a) => a.remove());
    const full = bare.textContent.replace(/\s+/g, ' ').trim();
    const m = /^(.*:)\s*(.+)$/.exec(full) || /^(.*?)\s+((?:\$\s?)?\d[\d\s.,]*(?:%|\$)?(?:\s?US)?)$/.exec(full);
    const links = [...labelEl.querySelectorAll('a')];
    if (m) {
      const [, labelText, valueText] = m;
      label.textContent = labelText;
      value.textContent = valueText.replace(/[\s*^†‡]+$/, (s) => (links.length ? '' : s));
      value.append(...links);
    } else {
      label.append(...labelEl.childNodes);
    }
  }
  row.append(label, value);
  return row;
}

function buildToggle(offer) {
  const toggleP = [...offer.querySelectorAll(':scope > p')].find((p) => {
    const a = p.querySelector(':scope > a[href^="#card-details"]');
    return a && text(a) === text(p);
  });
  if (!toggleP) return;
  const details = document.createElement('div');
  details.className = 'product-details-offer-details';
  details.id = `product-details-offer-${Math.random().toString(36).slice(2, 8)}`;
  details.hidden = true;
  while (toggleP.nextSibling) details.append(toggleP.nextSibling);
  const link = toggleP.querySelector('a');
  const [, show, hide] = /^(.*?[a-zà-ÿ])([A-ZÀ-Ý].*)$/u.exec(text(link)) || [null, text(link), text(link)];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'product-details-offer-toggle';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', details.id);
  const showLabel = document.createElement('span');
  showLabel.textContent = show;
  const hideLabel = document.createElement('span');
  hideLabel.textContent = hide;
  hideLabel.hidden = true;
  button.append(showLabel, hideLabel);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    showLabel.hidden = open;
    hideLabel.hidden = !open;
    details.hidden = !open;
  });
  toggleP.className = 'product-details-offer-toggle-wrapper';
  toggleP.replaceChildren(button);
  offer.append(details);
}

function buildContentSections(elements) {
  const sections = [];
  elements.forEach((el) => {
    if (el.matches('h2') || !sections.length) sections.push([]);
    sections[sections.length - 1].push(el);
  });
  return sections.map((els, i) => {
    const section = document.createElement('div');
    const hasH3 = els.some((el) => el.matches('h3'));
    const pairs = els.slice(1).filter((el) => el.matches('p'));
    const isEarn = !hasH3 && els[0].matches('h2') && pairs.length >= 2 && pairs.length % 2 === 0
      && pairs.every((p, j) => (j % 2 ? true : text(p).length <= 20));
    if (i === 0 && !hasH3) {
      section.className = 'product-details-intro';
      const pic = els.find((el) => el.matches('p') && isImageOnly(el));
      if (pic) {
        pic.classList.add('product-details-intro-image');
        section.classList.add('product-details-intro-has-image');
        const body = document.createElement('div');
        body.className = 'product-details-intro-body';
        body.append(...els.filter((el) => el !== pic));
        section.append(body, pic);
      } else section.append(...els);
    } else if (hasH3) {
      section.className = 'product-details-highlights';
      const list = document.createElement('ul');
      let li = null;
      const after = [];
      els.forEach((el) => {
        if (el.matches('h3')) {
          li = document.createElement('li');
          list.append(li);
          li.append(el);
        } else if (!li) section.append(el);
        else if (el.matches('p') && el.querySelector(':scope > a:only-child') && text(el) === text(el.querySelector('a'))) after.push(el);
        else if (after.length) after.push(el);
        else li.append(el);
      });
      section.append(list, ...after);
    } else if (isEarn) {
      section.className = 'product-details-earn';
      const [heading, ...rest] = els;
      section.append(heading);
      for (let j = 0; j < rest.length; j += 2) {
        const row = document.createElement('div');
        row.className = 'product-details-earn-row';
        rest[j].classList.add('product-details-earn-value');
        rest[j + 1].classList.add('product-details-earn-text');
        row.append(rest[j], rest[j + 1]);
        section.append(row);
      }
    } else {
      section.className = 'product-details-more';
      section.append(...els);
    }
    return section;
  });
}

function decorateOverview(group, imagePanel, info) {
  const kids = [...info.children];
  const firstCard = kids.findIndex((el) => isChip(el) || isOfferCaption(el) || isRateLabel(el));
  let lastCard = kids.findIndex(isLegalLink);
  if (lastCard < firstCard) lastCard = kids.findIndex((el) => el.querySelector('a.button'));
  if (firstCard < 0 || lastCard < firstCard) return false;

  const cardCol = document.createElement('div');
  cardCol.className = 'product-details-card-col';
  const card = imagePanel;
  card.className = 'product-details-card';
  cardCol.append(card);

  const chips = document.createElement('div');
  chips.className = 'product-details-chips';
  let offer = null;
  let rates = null;
  let state = 'start';
  const cardEls = kids.slice(firstCard, lastCard + 1);
  cardEls.forEach((el, idx) => {
    if (state === 'start' && isChip(el)) {
      el.className = 'product-details-chip';
      chips.append(el);
      return;
    }
    if (isOfferCaption(el) && !offer) {
      offer = document.createElement('div');
      offer.className = 'product-details-offer';
      el.className = 'product-details-offer-caption';
      offer.append(el);
      cardCol.append(offer);
      state = 'offer';
      return;
    }
    if (isRateLabel(el)) {
      if (!rates) {
        rates = document.createElement('div');
        rates.className = 'product-details-rates';
        cardCol.append(rates);
      }
      state = 'rates';
      const next = cardEls[idx + 1];
      const hasValue = /\d/.test(text(el).replace(RATE_LABEL, ''));
      if (!hasValue && next && isRateValue(next)) {
        next.dataset.used = 'true';
        rates.append(buildRateRow(el, next));
      } else rates.append(buildRateRow(el));
      return;
    }
    if (el.dataset.used) {
      el.remove();
      return;
    }
    if (state === 'offer') {
      offer.append(el);
      return;
    }
    state = 'after';
    if (isLegalLink(el)) el.classList.add('product-details-legal');
    else if (el.matches('p') && !el.querySelector('a.button') && !isImageOnly(el)) el.classList.add('product-details-note');
    cardCol.append(el);
  });
  if (chips.children.length) card.append(chips);
  if (offer) buildToggle(offer);

  const contentCol = document.createElement('div');
  contentCol.className = 'product-details-content-col';
  const before = kids.slice(0, firstCard);
  const afterEls = kids.slice(lastCard + 1);
  // a picture just before the card details is the content column's hero image
  const hero = before.length && isImageOnly(before[before.length - 1]) ? before.pop() : null;
  contentCol.append(...buildContentSections([...before, ...afterEls]));
  if (hero) {
    // authored as image cell + card picture: the cell image is the hero, the picture the card
    const cardPic = hero.querySelector('picture');
    const heroPic = card.querySelector('picture');
    if (cardPic && heroPic) {
      heroPic.replaceWith(cardPic);
      hero.replaceChildren(heroPic);
    }
    hero.classList.add('product-details-hero');
    contentCol.prepend(hero);
  }

  group.className = 'product-details-group product-details-overview';
  if (before.some((el) => el.matches('h2'))) {
    group.classList.add('product-details-overview-card-end');
    group.replaceChildren(contentCol, cardCol);
  } else group.replaceChildren(cardCol, contentCol);
  return true;
}

function buildPanel(cell, extraClass) {
  const panel = document.createElement('div');
  panel.className = `product-details-panel${extraClass ? ` ${extraClass}` : ''}`;
  panel.append(...cell.childNodes);
  decorateFeatureLists(panel);
  return panel;
}

export default function decorate(block) {
  const rows = [...block.children];
  const panels = rows.map((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img, .icon'));
    if (!cells.length) return null;

    if (cells.length === 1) return buildPanel(cells[0]);

    const group = document.createElement('div');
    const imageCell = cells.find(isImageOnly);
    if (imageCell) {
      group.className = 'product-details-group product-details-media';
      const built = cells.map((cell) => (cell === imageCell
        ? buildPanel(cell, 'product-details-image')
        : buildPanel(cell, 'product-details-info')));
      group.append(...built);
      const info = built.find((p) => p.classList.contains('product-details-info'));
      const image = built[cells.indexOf(imageCell)];
      if (cells.length === 2 && info) decorateOverview(group, image, info);
    } else {
      group.className = 'product-details-group product-details-split';
      group.style.setProperty('--product-details-cols', cells.length);
      cells.forEach((cell) => group.append(buildPanel(cell)));
    }
    return group;
  }).filter(Boolean);

  block.replaceChildren(...panels);
  block.querySelectorAll('.product-details-panel').forEach((panel) => {
    decorateIconItems(panel);
    decorateCaptions(panel);
  });
  decorateButtons(block);
}
