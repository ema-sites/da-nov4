# branch-locator

Custom **custom** block. Purpose: Find a Branch or ATM search card over a map image; the shadow option is a text-only teaser card overlapping a photo.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: Optional picture-only row: background map/photo. Text rows: heading, subtitle and extra links (e.g. Advanced Search Options) shown in the card in authored order. Form row: last cell is a single link (href = locator URL, text = button label), the cell before it is the search field label, and an optional earlier cell holds a choice group (legend line plus list or comma-separated choices such as Branches, ATM) rendered as radio buttons. The form POSTs to the locator URL with the same fields as rbcroyalbank.com: a search-only form sends `q` plus `lang=English`, `searchBranch=1`, `searchATM=1`; a form with a choice group sends `location_type` (Branches = `BRANCH`, ATM = `ABM`) and `postal`. Search-only cards are centred over the map; cards with a choice group sit to the right on desktop.

## Supported variations

| Variation | Option class |
| --- | --- |
| Compact | `compact` |
| Alt | `alt` |
| Alt 2 | `alt-2` |
| Shadow | `shadow` |

## Universal Editor fields

N/A (Document Authoring project)
