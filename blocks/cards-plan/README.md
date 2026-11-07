# cards-plan

Custom **cards** block. Purpose: account, plan or loan pricing cards: header with plan name and tagline, feature checklist, fees/price, primary apply/open button and secondary link; also compact fee tiles and product sliders.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per plan card. Cells (all optional, any count): image (picture only) | header (heading plus optional short tagline) | body (feature list, price/fee text, badges, CTA button and link). When the whole card is in one cell, a leading heading and its short tagline are split into the header automatically. Trailing link-only paragraphs become the card actions, pinned to the bottom. A paragraph starting with an amount (e.g. `$3.00 USD /mo`) is the price, with its trailing `/mo` unit set smaller; a short paragraph right after it is the price note.

## Supported variations

| Variation | Option class |
| --- | --- |
| Horizontal | `horizontal` |
| Compact | `compact` |
| Slider | `slider` |
| Image Orange Light | `image-orange-light` |
| Compact 2 | `compact-2` |
| Compare | `compare` |
| Orange Light | `orange-light` |
| Compare Grey Blue Light | `compare-grey-blue-light` |
| Compare Grey Image | `compare-grey-image` |
| Slider 2 | `slider-2` |
| Slider 3 | `slider-3` |
| Image Orange | `image-orange` |
| Compact Rate | `compact-rate` |
| Light | `light` |
| Image Light | `image-light` |
| Image | `image` |
| Orange Light 2 | `orange-light-2` |

## Decoration (JS)

The block reads plain authored paragraphs and recognises these card shapes:

- **Mini card** (`compare`): caption, name, fee label/value, three rate pairs, compare link, card link.
- **Credit card grid** (`image-light-4`, `orange-light-3`, `slider-2`, `image-orange-light-*`, `orange-shadow-light`, `orange-light-2`): a fee label paragraph ("Annual Fee", "Frais annuels :", "年费", "Interest Rate:"…) marks the card; captions above the title go on the image panel, a short offer caption plus its text become the offer box, three trailing label/value pairs become the rates row, repeated feature copies are dropped.
- **Label rows**: "Label:" paragraphs (plain or bold) followed by a value paragraph, and "Label :<br>value" paragraphs, become label/value rows.
- **Icon features**: an image-only paragraph followed by a heading and text becomes one icon feature.
- A short line above the first heading is the eyebrow; generic "read more" links get the card title as hidden text.

Behaviour: `slider`/`slider-3` scroll with side chevrons and one dot per card; `light` collapses the feature list behind "View More"; `image-light-2` puts the details after the fee rows behind "Détails".

## Universal Editor fields

N/A (Document Authoring project)
