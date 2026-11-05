/*
 * Accordion Legal
 * Single collapsible legal-disclaimer toggle.
 *  - Row 1, cell 1: toggle label (e.g. "Things our lawyers want you to know")
 *  - Row 1, cell 2 (optional): with more rows, a summary that stays visible under
 *    the toggle; as the only row, the disclaimer body
 *  - Rows 2+: disclaimer body (hidden until opened)
 */

let idCounter = 0;

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const [first, ...rest] = rows;
  const [labelCell, secondCell, ...extraCells] = [...first.children];

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'accordion-legal-toggle';
  button.setAttribute('aria-expanded', 'false');
  const labelText = labelCell ? labelCell.textContent.trim() : '';
  button.textContent = labelText || 'Legal disclaimers';

  const summary = document.createElement('div');
  summary.className = 'accordion-legal-summary';

  const body = document.createElement('div');
  body.className = 'accordion-legal-body';
  idCounter += 1;
  body.id = `accordion-legal-body-${idCounter}`;
  body.hidden = true;
  button.setAttribute('aria-controls', body.id);

  if (secondCell) {
    if (rest.length) summary.append(...secondCell.childNodes);
    else body.append(...secondCell.childNodes);
  }
  extraCells.forEach((cell) => body.append(...cell.childNodes));
  rest.forEach((row) => [...row.children].forEach((cell) => body.append(...cell.childNodes)));

  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    body.hidden = open;
    block.classList.toggle('accordion-legal-open', !open);
  });

  block.replaceChildren(button);
  if (summary.childNodes.length) block.append(summary);
  block.append(body);
}
