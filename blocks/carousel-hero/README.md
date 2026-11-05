# carousel-hero

Custom **carousel** block. Purpose: Full-width rotating hero slides with autoplay, prev/next arrows, dots and a pause button; thumbnail-tabs options replace the dots with a row of thumbnail tabs under the slides.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per slide. Cells: optional picture-only background cell, then the content cell (eyebrow text, heading, text, CTA links/buttons), then an optional picture-only foreground image cell. With thumbnail-tabs / thumbnail-tabs-2 a last cell gives the tab thumbnail picture and label (the label falls back to the slide heading). Slides with a foreground picture show the thumbnail small at the top of a gradient tab; other slides fill the tab with it. Choosing a tab pauses autoplay. CTAs: **bold link** = blue primary, ***bold italic link*** = white button, *italic link* = outline button, a plain link right after a CTA = chevron text link; plain text after the CTAs is small print. An *italic* run inside the heading is a yellow highlighted amount and switches the slide to the light-blue offer layout. Empty rows/cells are ignored; extra text cells merge into the content.

## Supported variations

| Variation | Option class |
| --- | --- |
| Thumbnail Tabs | `thumbnail-tabs` |
| Thumbnail Tabs 2 | `thumbnail-tabs-2` |

## Universal Editor fields

N/A (Document Authoring project)
