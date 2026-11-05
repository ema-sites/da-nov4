# search-site

Custom **search** block. Purpose: Site keyword search field with a submit button that sends the query to the site search results page.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row; first cell holds the input placeholder text (e.g. I am looking for...); second cell holds a link whose text is the button label and whose href is the search results page (query sent as ?question=). Either cell may be omitted (defaults: Search, /search). A bulleted list of links instead renders a jump-to dropdown. If the placeholder cell holds several paragraphs, the first becomes a visible field label and the rest the placeholder (e.g. Still need help? / Type your question here).

## Supported variations

| Variation | Option class |
| --- | --- |
| Rounded | `rounded` |
| Boxed | `boxed` |
| Boxed Light | `boxed-light` |

## Universal Editor fields

N/A (Document Authoring project)
