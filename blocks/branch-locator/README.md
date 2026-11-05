# branch-locator

Custom **custom** block. Purpose: Find a Branch or ATM search card over a map image; the shadow option is a text-only teaser card overlapping a photo.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: Optional picture-only row: background map/photo. Text rows: heading, subtitle and extra links (e.g. Advanced Search Options) shown in the card in authored order. Form row: last cell is a single link (href = locator URL, text = button label), the cell before it is the search field label, and an optional earlier cell holds a choice group (legend line plus list or comma-separated choices such as Branches, ATM) rendered as radio buttons. Submitting goes to the locator URL with ?q= and &type=.

## Supported variations

| Variation | Option class |
| --- | --- |
| Compact | `compact` |
| Alt | `alt` |
| Alt 2 | `alt-2` |
| Shadow | `shadow` |

## Universal Editor fields

N/A (Document Authoring project)
