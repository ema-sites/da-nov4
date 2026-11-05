# calculator

Custom **custom** block. Purpose: interactive financial calculator (loan payment, GIC return, rewards, rebate, RRSP) with an optional intro panel, labelled inputs, a submit/CTA button and an optional illustration.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: Rows in any order. Intro rows: heading, text and links in one or more cells. Field rows: two or three cells - label (plain text, leading or trailing * marks required) | field spec (an input type word such as number, text, range, optionally with a prefix and suffix, e.g. '$ number' or 'number %' or 'number Year'; or a list of choices for a dropdown, with 'checkbox' or 'radio' to render choice tiles) | optional help text. Button row: one cell containing a single link - '#' (or #calculate) becomes the submit button, any other URL stays a CTA link. Picture-only rows become the illustration. Content after the fields becomes notes. When amount, rate and period/term fields exist, submit shows the amortized monthly payment and total interest; every submit dispatches a calculator:submit event.

## Supported variations

| Variation | Option class |
| --- | --- |
| Alt | `alt` |
| Alt 2 | `alt-2` |
| Grey | `grey` |
| Banner | `banner` |
| Shadow | `shadow` |
| Blue Grey Shadow | `blue-grey-shadow` |
| Blue | `blue` |
| Banner 2 | `banner-2` |
| Grey 2 | `grey-2` |
| Blue Grey | `blue-grey` |
| Intro | `intro` |
| Image | `image` |
| Light | `light` |

## Universal Editor fields

N/A (Document Authoring project)
