const DEFAULT_PLACEHOLDER = 'Search';
const DEFAULT_BUTTON = 'Search';
const DEFAULT_ACTION = '/search';
// query parameter read by the RBC results page (source form #intellResponse_form)
const QUERY_PARAM = 'question';

/**
 * Read authored content defensively. Any cell may be missing:
 * - plain text (first one found) -> input placeholder
 * - a link -> its href is the results page, its text the button label
 * - a list of links -> rendered as a "jump to" select instead of a keyword field
 */
function readConfig(block) {
  const config = {
    label: '', placeholder: '', button: '', action: '', options: [],
  };
  const list = block.querySelector('ul, ol');
  if (list) {
    config.options = [...list.querySelectorAll('a[href]')].map((a) => ({
      label: a.textContent.trim(), href: a.href,
    }));
  }
  [...block.querySelectorAll(':scope > div > div')].forEach((cell) => {
    if (cell.closest('ul, ol') || cell.querySelector('ul, ol')) return;
    const link = cell.querySelector('a[href]');
    if (link && !config.action) {
      config.action = link.href;
      config.button = link.textContent.trim();
      return;
    }
    let text = cell.textContent.trim();
    if (!text) return;
    // a text cell with several paragraphs: first is the field label, the rest the placeholder
    const parts = [...cell.children].map((el) => el.textContent.trim()).filter(Boolean);
    if (parts.length > 1 && !config.label && !config.placeholder) {
      [config.label] = parts;
      text = parts.slice(1).join(' ');
    }
    if (!config.placeholder) config.placeholder = text;
    else if (!config.button) config.button = text;
  });
  return config;
}

function buildSelect(config) {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-site-box search-site-select';
  const select = document.createElement('select');
  select.className = 'search-site-input';
  select.setAttribute('aria-label', config.placeholder || DEFAULT_PLACEHOLDER);
  if (config.placeholder) {
    const first = document.createElement('option');
    first.value = '';
    first.textContent = config.placeholder;
    select.append(first);
  }
  config.options.forEach(({ label, href }) => {
    const option = document.createElement('option');
    option.value = href;
    option.textContent = label;
    select.append(option);
  });
  select.addEventListener('change', () => {
    if (select.value) window.location.href = select.value;
  });
  wrapper.append(select);
  return wrapper;
}

function buildForm(config) {
  const form = document.createElement('form');
  form.className = 'search-site-box';
  form.setAttribute('role', 'search');
  form.method = 'get';
  form.action = config.action || DEFAULT_ACTION;

  const placeholder = config.placeholder || DEFAULT_PLACEHOLDER;
  const input = document.createElement('input');
  input.type = 'search';
  input.name = QUERY_PARAM;
  input.className = 'search-site-input';
  input.placeholder = placeholder;
  let label;
  if (config.label) {
    input.id = `search-site-input-${document.querySelectorAll('.search-site-input[id]').length + 1}`;
    label = document.createElement('label');
    label.className = 'search-site-label';
    label.htmlFor = input.id;
    label.textContent = config.label;
  } else {
    input.setAttribute('aria-label', placeholder);
  }
  const { search: query } = window.location;
  const current = new URLSearchParams(query).get(QUERY_PARAM);
  if (current) input.value = current;

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'search-site-button';
  button.textContent = config.button || DEFAULT_BUTTON;

  if (config.requireQuery) {
    // keep the submit button disabled until a question is typed
    const sync = () => { button.disabled = !input.value.trim(); };
    input.addEventListener('input', sync);
    sync();
  }

  if (label) form.append(label);
  form.append(input, button);
  return form;
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const config = readConfig(block);
  config.requireQuery = block.classList.contains('boxed');
  const box = config.options.length ? buildSelect(config) : buildForm(config);
  block.replaceChildren(box);
}
