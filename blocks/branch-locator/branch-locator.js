/*
 * Branch Locator
 * Search card over a map (or photo) background.
 * Rows (all optional, any order):
 *  - picture only            -> background image
 *  - form row                -> a row whose LAST cell holds only a link: the link href is the
 *                               locator URL and its text the button label. Cell before it is the
 *                               search field label. An earlier cell may hold a choice group:
 *                               a legend line plus a list (or comma-separated text) of choices,
 *                               rendered as radio buttons (e.g. "What are you looking for?" -
 *                               Branches, ATM).
 *  - any other row           -> card content (heading, subtitle, links such as
 *                               "Advanced Search Options"), kept in authored order.
 * The form POSTs to the locator URL with the same fields as the rbcroyalbank.com forms:
 *  - search only (homepage): q, lang=English, searchBranch=1, searchATM=1
 *  - with a choice group:    location_type (BRANCH | ABM), postal
 */

let formCounter = 0;

function isPictureOnly(cell) {
  return !!cell.querySelector('picture, img') && cell.textContent.trim() === '';
}

function isLinkOnly(cell) {
  const links = cell.querySelectorAll('a[href]');
  return links.length === 1 && cell.textContent.trim() === links[0].textContent.trim();
}

function parseChoices(cell) {
  const items = [...cell.querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean);
  const blocks = [...cell.querySelectorAll('p, h1, h2, h3, h4, h5, h6, strong')];
  let legend = '';
  let choices = items;
  if (items.length) {
    legend = blocks.find((el) => !el.closest('li'))?.textContent.trim() || '';
  } else {
    const lines = [...cell.querySelectorAll('p')].map((p) => p.textContent.trim()).filter(Boolean);
    const source = lines.length ? lines : [cell.textContent.trim()];
    if (source.length > 1) {
      [legend] = source;
      choices = source.slice(1).flatMap((l) => l.split(',')).map((s) => s.trim()).filter(Boolean);
    } else {
      choices = source[0].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return { legend, choices };
}

// rbcroyalbank.com locator values for the choice radios (label -> location_type)
function choiceValue(choice) {
  if (/branch/i.test(choice)) return 'BRANCH';
  if (/\b(atm|abm)s?\b/i.test(choice)) return 'ABM';
  return choice.toUpperCase();
}

function hiddenInput(name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  return input;
}

function buildForm(cells) {
  formCounter += 1;
  const id = `branch-locator-${formCounter}`;
  const actionLink = cells[cells.length - 1].querySelector('a[href]');
  const before = cells.slice(0, -1);
  const labelCell = before.length ? before[before.length - 1] : null;
  const choiceCells = before.slice(0, -1);

  const form = document.createElement('form');
  form.className = 'branch-locator-form';
  form.setAttribute('role', 'search');
  form.action = actionLink.href;
  form.method = 'post';

  let hasChoices = false;
  choiceCells.forEach((cell, i) => {
    const { legend, choices } = parseChoices(cell);
    if (!choices.length) return;
    hasChoices = true;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'branch-locator-choices';
    if (legend) {
      const lg = document.createElement('legend');
      lg.textContent = legend;
      fieldset.append(lg);
    }
    choices.forEach((choice, j) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = i === 0 ? 'location_type' : `location_type${i}`;
      input.value = choiceValue(choice);
      input.id = `${id}-choice-${i}-${j}`;
      label.htmlFor = input.id;
      label.textContent = choice;
      fieldset.append(input, label);
    });
    form.append(fieldset);
  });

  // search-only form (homepage) carries the locator defaults as hidden fields
  if (!hasChoices) {
    form.append(
      hiddenInput('lang', 'English'),
      hiddenInput('searchBranch', '1'),
      hiddenInput('searchATM', '1'),
    );
  }

  const field = document.createElement('div');
  field.className = 'branch-locator-field';
  const label = document.createElement('label');
  label.htmlFor = `${id}-q`;
  label.textContent = labelCell ? labelCell.textContent.trim() : '';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = hasChoices ? 'postal' : 'q';
  input.id = `${id}-q`;
  if (!label.textContent) input.setAttribute('aria-label', actionLink.textContent.trim());
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = actionLink.textContent.trim() || 'Search';
  if (label.textContent) field.append(label);
  const controls = document.createElement('div');
  controls.className = 'branch-locator-controls';
  controls.append(input, button);
  field.append(controls);
  form.append(field);
  return { form, hasChoices };
}

export default function decorate(block) {
  const background = document.createElement('div');
  background.className = 'branch-locator-background';
  const card = document.createElement('div');
  card.className = 'branch-locator-card';
  let hasForm = false;

  [...block.children].forEach((row) => {
    const cells = [...row.children].filter((c) => c.textContent.trim() || c.querySelector('picture, img'));
    if (!cells.length) return;
    if (cells.length === 1 && isPictureOnly(cells[0])) {
      background.append(...cells[0].childNodes);
      return;
    }
    if (!hasForm && cells.length >= 2 && isLinkOnly(cells[cells.length - 1])) {
      const { form, hasChoices } = buildForm(cells);
      if (hasChoices) block.classList.add('branch-locator-has-choices');
      card.append(form);
      hasForm = true;
      return;
    }
    // other content: pictures inside a mixed row also become the background
    cells.forEach((cell) => {
      if (isPictureOnly(cell)) {
        background.append(...cell.childNodes);
        return;
      }
      const part = document.createElement('div');
      part.className = 'branch-locator-text';
      part.append(...cell.childNodes);
      card.append(part);
    });
  });

  block.replaceChildren();
  if (background.childNodes.length) {
    block.classList.add('branch-locator-has-background');
    block.append(background);
  }
  if (!hasForm) block.classList.add('branch-locator-no-form');
  block.append(card);
}
