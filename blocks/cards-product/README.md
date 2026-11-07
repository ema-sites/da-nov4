# cards-product

Custom **cards** block. Purpose: grid of product, service or offer teaser cards (title, short text, link or button, optional photo/illustration) linking to detail pages; also photo-overlay category tiles, cards with a coloured header strip, featured and single apply panels.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per card. Cells (all optional): image (picture only) | optional short label cell for the header strip (e.g. 'Loan', with optional icon) | body (optional eyebrow, heading, text, list, link or button). Cells may be in any order; picture-only cells become the card image, everything else body. Cards with exactly one link become fully clickable. With image, a small image (logo or award badge, 400px or less) is shown whole and centred instead of cropped.

Decoration details (block JS):
- A closing paragraph that holds only one link is the card's action row (`.cards-product-card-action`): in the default RBC callout it sits under a divider with a chevron.
- A bold link opening the card body (`**[Title](url)**`) is the card title, so it stays a link with bold text rather than becoming a primary button.
- With any `photo-overlay*` option the card photo becomes the card's background image, with the text on top.

Default look (no option): RBC callout, a bordered card with centred title, text, divider and chevron link. The grid reproduces the source row gutters (-7.5px on mobile, -15px from 900px) and uses one column per card up to five.

## Supported variations

| Variation | Option class |
| --- | --- |
| Image | `image` |
| Tinted | `tinted` |
| Alt | `alt` |
| Tinted 2 | `tinted-2` |
| Image 2 | `image-2` |
| Horizontal | `horizontal` |
| Blue Orange | `blue-orange` |
| Photo Overlay | `photo-overlay` |
| Light Image | `light-image` |
| Image 3 | `image-3` |
| Apply | `apply` |
| Light Image 2 | `light-image-2` |
| Tiers | `tiers` |
| Blue Light | `blue-light` |
| Featured | `featured` |
| Image Orange | `image-orange` |
| Light | `light` |
| Header Strip | `header-strip` |
| Cyan Red | `cyan-red` |
| Photo Overlay 2 | `photo-overlay-2` |
| Image Light | `image-light` |
| Alt 2 | `alt-2` |
| Shadow | `shadow` |
| Header Strip Blue Grey | `header-strip-blue-grey` |
| Photo Overlay Audience | `photo-overlay-audience` |
| Orange | `orange` |
| Grey | `grey` |
| Horizontal 2 | `horizontal-2` |
| Image Light 2 | `image-light-2` |
| Image Orange 2 | `image-orange-2` |
| Blue | `blue` |
| Red Light | `red-light` |
| Image Blue | `image-blue` |
| Photo Overlay Audience 2 | `photo-overlay-audience-2` |
| Orange Shadow | `orange-shadow` |

## Universal Editor fields

N/A (Document Authoring project)
