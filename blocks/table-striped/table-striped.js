// yes/no marks imported as characters; rendered as the source check/close icons
const MARKS = {
  '✓': ['check', 'Yes'],
  '✔': ['check', 'Yes'],
  '✗': ['close', 'No'],
  '✘': ['close', 'No'],
};

function decorateMark(el) {
  if (el.querySelector('img, picture, a')) return;
  const mark = MARKS[el.textContent.trim()];
  if (!mark) return;
  const [type, label] = mark;
  const icon = document.createElement('span');
  icon.className = `table-striped-mark table-striped-mark-${type}`;
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', label);
  el.replaceChildren(icon);
  el.classList.add('table-striped-mark-cell');
}

/**
 * Striped data table. First row is the header row; in body rows the first cell is the
 * row label. Rows with fewer cells are padded so columns line up.
 * Option `collapsible`: the table sits behind an expander; if the first row has a single
 * cell and the table has more rows, that cell is used as the expander label.
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  const collapsible = block.classList.contains('collapsible');

  let summaryLabel = '';
  if (collapsible && rows.length > 1 && rows[0].children.length === 1) {
    summaryLabel = rows.shift().textContent.trim();
  }

  const columns = rows.reduce((max, row) => Math.max(max, row.children.length), 0);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    const cells = [...row.children];
    for (let c = 0; c < columns; c += 1) {
      const cell = cells[c];
      const isHeader = i === 0;
      const isRowLabel = !isHeader && c === 0 && columns > 1;
      const el = document.createElement(isHeader || isRowLabel ? 'th' : 'td');
      if (isHeader) el.setAttribute('scope', 'col');
      if (isRowLabel) el.setAttribute('scope', 'row');
      // a single cell spanning a whole row (e.g. a group heading)
      if (cell && cells.length === 1 && columns > 1) {
        el.colSpan = columns;
        c = columns;
      }
      if (cell) el.append(...cell.childNodes);
      if (!isRowLabel) decorateMark(el);
      tr.append(el);
    }
    if (i === 0) thead.append(tr);
    else tbody.append(tr);
  });

  table.append(thead, tbody);
  const scroller = document.createElement('div');
  scroller.className = 'table-striped-scroll';
  scroller.append(table);

  if (collapsible) {
    const details = document.createElement('details');
    details.className = 'table-striped-details';
    const summary = document.createElement('summary');
    summary.className = 'table-striped-summary';
    summary.textContent = summaryLabel || 'Show details';
    details.append(summary, scroller);
    block.replaceChildren(details);
  } else {
    block.replaceChildren(scroller);
  }
}
