/*
 * Product Selector
 * Choose-one product finder.
 *  - Intro row (optional, first): a single cell with a heading and text.
 *  - Option rows: cell 1 = option label (optional image/icon, short text, link to the
 *    result page); cell 2 (optional) = detail panel shown when the option is selected.
 *  - CTA row (optional, last): a single cell holding only a link; its href follows
 *    the selected option's link.
 */

let instance = 0;

function isIntroRow(row) {
  const cells = [...row.children];
  return cells.length === 1 && !!row.querySelector('h1, h2, h3, h4, h5, h6');
}

function isCtaRow(row) {
  const cells = [...row.children];
  const links = row.querySelectorAll('a[href]');
  return cells.length === 1 && links.length === 1
    && row.textContent.trim() === links[0].textContent.trim();
}

export default function decorate(block) {
  instance += 1;
  const name = `product-selector-${instance}`;
  let rows = [...block.children].filter((r) => r.textContent.trim() || r.querySelector('picture, .icon'));

  let intro = null;
  if (rows.length > 1 && isIntroRow(rows[0])) {
    intro = document.createElement('div');
    intro.className = 'product-selector-intro';
    intro.append(...rows[0].firstElementChild.childNodes);
    rows = rows.slice(1);
  }

  let cta = null;
  if (rows.length > 1 && isCtaRow(rows[rows.length - 1])) {
    cta = rows[rows.length - 1].querySelector('a');
    cta.classList.add('button', 'product-selector-cta');
    rows = rows.slice(0, -1);
  }

  const form = document.createElement('div');
  form.className = 'product-selector-form';
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'product-selector-options';
  const details = document.createElement('div');
  details.className = 'product-selector-details';

  // a heading-less first cell paragraph acting as the question becomes the legend
  const optionEntries = [];
  rows.forEach((row) => {
    const cells = [...row.children];
    const labelCell = cells[0];
    if (!labelCell) return;
    const detailCell = cells[1];
    const link = labelCell.querySelector('a[href]');
    // a single-cell text row with no link/image before any option is the question
    if (!optionEntries.length && cells.length === 1 && !link
      && !labelCell.querySelector('picture, .icon') && !fieldset.querySelector('legend')) {
      const legend = document.createElement('legend');
      legend.textContent = labelCell.textContent.trim();
      fieldset.prepend(legend);
      return;
    }
    optionEntries.push({
      labelCell, detailCell, link,
    });
  });

  optionEntries.forEach(({ labelCell, detailCell, link }, i) => {
    const id = `${name}-${i}`;
    const option = document.createElement('div');
    option.className = 'product-selector-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.id = id;
    input.value = link ? link.href : String(i);
    const label = document.createElement('label');
    label.htmlFor = id;
    if (link) {
      // keep link text but not navigation inside the label
      const span = document.createElement('span');
      span.append(...link.childNodes);
      link.replaceWith(span);
    }
    label.append(...labelCell.childNodes);
    option.append(input, label);
    fieldset.append(option);

    let panel = null;
    if (detailCell && (detailCell.textContent.trim() || detailCell.querySelector('picture'))) {
      panel = document.createElement('div');
      panel.className = 'product-selector-detail';
      panel.id = `${id}-detail`;
      panel.hidden = true;
      panel.append(...detailCell.childNodes);
      details.append(panel);
      input.setAttribute('aria-controls', panel.id);
    }

    input.addEventListener('change', () => {
      if (!input.checked) return;
      fieldset.querySelectorAll('.product-selector-option').forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      details.querySelectorAll('.product-selector-detail').forEach((d) => { d.hidden = d !== panel; });
      if (cta) {
        if (link) cta.href = link.href;
        cta.removeAttribute('aria-disabled');
        cta.classList.remove('disabled');
      }
    });
  });

  form.append(fieldset);
  if (cta) {
    const ctaWrap = document.createElement('p');
    ctaWrap.className = 'button-container';
    ctaWrap.append(cta);
    form.append(ctaWrap);
  }

  block.replaceChildren(...[intro, form, details.children.length ? details : null].filter(Boolean));

  // preselect the first option when there are detail panels to show
  const first = fieldset.querySelector('input');
  if (first && details.children.length) {
    first.checked = true;
    first.dispatchEvent(new Event('change'));
  } else if (cta && optionEntries.some((o) => o.link)) {
    cta.setAttribute('aria-disabled', 'true');
    cta.classList.add('disabled');
    cta.addEventListener('click', (e) => {
      if (cta.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
  }
}
