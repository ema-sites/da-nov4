import { createOptimizedPicture } from '../../scripts/aem.js';

const INPUT_TYPES = ['number', 'text', 'range', 'date', 'email', 'tel', 'checkbox', 'radio', 'select'];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function slug(text, index) {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `calculator-${base || 'field'}-${index}`;
}

/* A field row: label cell (plain text) + spec cell (type tokens or a list of choices). */
function isFieldRow(cells) {
  if (cells.length < 2) return false;
  const [label, spec] = cells;
  if (!label.textContent.trim()) return false;
  if (label.querySelector('h1, h2, h3, h4, h5, h6, picture, a')) return false;
  if (spec.querySelector('picture, h1, h2, h3, h4, h5, h6')) return false;
  if (spec.querySelector('ul, ol')) return true;
  const tokens = spec.textContent.trim().toLowerCase().split(/\s+/);
  return tokens.some((t) => INPUT_TYPES.includes(t));
}

/* A button row: one cell whose only meaningful content is a single link. */
function isButtonRow(cells) {
  const filled = cells.filter((c) => c.textContent.trim() || c.querySelector('picture'));
  if (filled.length !== 1) return false;
  const links = filled[0].querySelectorAll('a');
  return links.length === 1 && links[0].textContent.trim() === filled[0].textContent.trim();
}

function buildField(cells, index) {
  const [labelCell, specCell, helpCell] = cells;
  const labelText = labelCell.textContent.trim();
  const required = /\*$|^\*/.test(labelText);
  const cleanLabel = labelText.replace(/^\*\s*|\s*\*$/g, '');
  const id = slug(cleanLabel, index);
  const wrapper = document.createElement('div');
  wrapper.className = 'calculator-field';

  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = cleanLabel;
  if (required) label.classList.add('calculator-required');

  const specText = specCell.textContent.trim();
  const tokens = specText.toLowerCase().split(/\s+/);
  const list = specCell.querySelector('ul, ol');
  const choices = list ? [...list.querySelectorAll('li')].map((li) => li.textContent.trim()) : [];
  const control = document.createElement('div');
  control.className = 'calculator-control';

  if (list && (tokens.includes('checkbox') || tokens.includes('radio'))) {
    const type = tokens.includes('radio') ? 'radio' : 'checkbox';
    const group = document.createElement('fieldset');
    group.className = `calculator-choices calculator-${type}`;
    const legend = document.createElement('legend');
    legend.textContent = cleanLabel;
    group.append(legend);
    choices.forEach((choice, i) => {
      const optLabel = document.createElement('label');
      const input = document.createElement('input');
      input.type = type;
      input.name = id;
      input.value = choice;
      input.id = `${id}-${i}`;
      optLabel.append(input, document.createTextNode(choice));
      group.append(optLabel);
    });
    wrapper.append(group);
  } else {
    let input;
    let suffixEl = null;
    if (list) {
      input = document.createElement('select');
      choices.forEach((choice) => {
        const option = document.createElement('option');
        option.value = choice;
        option.textContent = choice;
        input.append(option);
      });
    } else {
      const typeIndex = tokens.findIndex((t) => INPUT_TYPES.includes(t));
      const type = tokens[typeIndex] === 'select' ? 'text' : tokens[typeIndex];
      input = document.createElement('input');
      input.type = type || 'text';
      if (input.type === 'number') input.step = 'any';
      const rawTokens = specText.split(/\s+/);
      const prefix = rawTokens.slice(0, typeIndex).join(' ');
      const suffix = rawTokens.slice(typeIndex + 1).join(' ');
      if (prefix) {
        const span = document.createElement('span');
        span.className = 'calculator-prefix';
        span.textContent = prefix;
        control.append(span);
      }
      if (suffix) {
        suffixEl = document.createElement('span');
        suffixEl.className = 'calculator-suffix';
        suffixEl.textContent = suffix;
      }
    }
    input.id = id;
    input.name = id;
    input.dataset.label = cleanLabel.toLowerCase();
    if (required) input.required = true;
    control.append(input);
    if (suffixEl) control.append(suffixEl);
    wrapper.append(label, control);
  }

  if (helpCell && helpCell.textContent.trim()) {
    const help = document.createElement('div');
    help.className = 'calculator-help';
    help.append(...helpCell.childNodes);
    wrapper.append(help);
  }
  return wrapper;
}

function findValue(form, pattern) {
  const input = [...form.querySelectorAll('input[type="number"], input[type="text"], input[type="range"]')]
    .find((el) => pattern.test(el.dataset.label || ''));
  if (!input) return null;
  const value = parseFloat(String(input.value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(value) ? null : value;
}

/* Amortized monthly payment when amount, rate and term fields are present. */
function computeLoan(form) {
  const amount = findValue(form, /amount|montant|principal|price|prix/);
  const rate = findValue(form, /rate|taux|interest|int[ée]r[êe]t/);
  const years = findValue(form, /period|term|year|dur[ée]e|ann[ée]e|p[ée]riode/);
  if (amount === null || rate === null || years === null || years <= 0) return null;
  const n = Math.round(years * 12);
  const r = rate / 100 / 12;
  const payment = r === 0 ? amount / n : (amount * r) / (1 - (1 + r) ** -n);
  return { payment, totalInterest: payment * n - amount };
}

export default function decorate(block) {
  const intro = document.createElement('div');
  intro.className = 'calculator-intro';
  const media = document.createElement('div');
  media.className = 'calculator-media';
  const form = document.createElement('form');
  form.className = 'calculator-form';
  const fields = document.createElement('div');
  fields.className = 'calculator-fields';
  const actions = document.createElement('div');
  actions.className = 'calculator-actions';
  const after = document.createElement('div');
  after.className = 'calculator-notes';

  let fieldIndex = 0;
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.length) return;
    if (isFieldRow(cells)) {
      fields.append(buildField(cells, fieldIndex));
      fieldIndex += 1;
      return;
    }
    if (isButtonRow(cells)) {
      const link = row.querySelector('a');
      const href = link.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('#calculate')) {
        const button = document.createElement('button');
        button.type = 'submit';
        button.className = 'button';
        button.textContent = link.textContent.trim();
        actions.append(button);
      } else {
        link.classList.add('button');
        actions.append(link);
      }
      return;
    }
    const pictureOnly = cells.every((c) => !c.textContent.trim());
    cells.forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture')) return;
      let target = fieldIndex ? after : intro;
      if (pictureOnly) target = media;
      target.append(...cell.childNodes);
    });
  });

  const result = document.createElement('output');
  result.className = 'calculator-result';
  result.setAttribute('aria-live', 'polite');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const loan = computeLoan(form);
    if (loan) {
      const fmt = new Intl.NumberFormat(document.documentElement.lang || 'en-CA', { style: 'currency', currency: 'CAD' });
      result.textContent = '';
      const pay = document.createElement('p');
      pay.className = 'calculator-result-payment';
      pay.textContent = fmt.format(loan.payment);
      const interest = document.createElement('p');
      interest.className = 'calculator-result-interest';
      interest.textContent = fmt.format(loan.totalInterest);
      result.append(pay, interest);
      result.hidden = false;
    }
    block.dispatchEvent(new CustomEvent('calculator:submit', { bubbles: true, detail: { values, loan } }));
  });

  block.textContent = '';
  if (intro.childNodes.length) block.append(intro);
  if (fields.children.length || actions.children.length) {
    if (fields.children.length) form.append(fields);
    if (actions.children.length) form.append(actions);
    if (fields.children.length) {
      result.hidden = true;
      form.append(result);
    }
    block.append(form);
  }
  if (after.childNodes.length) block.append(after);
  if (media.childNodes.length) block.append(media);
  if (!fields.children.length) block.classList.add('calculator-no-fields');
  if (media.childNodes.length && !block.classList.contains('image')) block.classList.add('calculator-has-media');

  optimizeImages(block);
}
