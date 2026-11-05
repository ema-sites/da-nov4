# columns-feature-row

Custom **columns** block. Purpose: Tinted panel row pairing a feature label with its description; explainer pairs heading + text with an illustration, award/awards show a label beside logo + caption items.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per feature. First text cell: the label (or heading + text for explainer). Following cells: description (text, links, info button), a picture-only illustration/logo, or a media item (logo picture plus bold title and caption, laid out side by side). A single-cell row spans the full width. A text cell ending in a picture-only paragraph (explainer: heading + text, then the illustration) is split so the illustration sits beside the text. Each default/alt/light block renders one tinted label | value table row, so consecutive blocks stack flush like the source table. Empty cells are dropped.

## Supported variations

| Variation | Option class |
| --- | --- |
| Explainer | `explainer` |
| Award | `award` |
| Awards | `awards` |
| Alt | `alt` |
| Light | `light` |

## Universal Editor fields

N/A (Document Authoring project)
