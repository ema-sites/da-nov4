/*
 * Product Details
 * Each row is one panel of a product page body. Panel layout is inferred per row:
 *  - one cell                         -> full-width panel (intro box, benefits, promo)
 *  - image-only cell + content cell   -> media panel (product image beside details)
 *  - two or more content cells        -> side-by-side panels (e.g. pros / cons)
 * Inside a panel, lists whose items start with an icon/image become feature lists.
 * Links alone in a paragraph (bold/italic or the only content) become buttons.
 */

function isImageOnly(cell) {
  return !!cell.querySelector('picture') && !cell.textContent.trim();
}

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

function decorateButtons(scope) {
  scope.querySelectorAll('p > a:only-child').forEach((a) => {
    const p = a.parentElement;
    if (p.textContent.trim() !== a.textContent.trim()) return;
    if (p.matches('p:only-child') || a.closest('strong, em') || p.querySelector('strong > a, em > a')) {
      a.classList.add('button');
      p.classList.add('button-container');
    }
  });
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
      cells.forEach((cell) => {
        group.append(cell === imageCell
          ? buildPanel(cell, 'product-details-image')
          : buildPanel(cell, 'product-details-info'));
      });
    } else {
      group.className = 'product-details-group product-details-split';
      group.style.setProperty('--product-details-cols', cells.length);
      cells.forEach((cell) => group.append(buildPanel(cell)));
    }
    return group;
  }).filter(Boolean);

  block.replaceChildren(...panels);
  decorateButtons(block);
}
