# carousel-hero

Custom **carousel** block. Purpose: Full-width rotating hero slides with autoplay, prev/next arrows, dots and a pause button; thumbnail-tabs options replace the dots with a row of thumbnail tabs under the slides.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per slide. Cells: optional picture-only background cell, then the content cell (eyebrow text, heading, text, CTA links/buttons), then an optional picture-only foreground image cell. With thumbnail-tabs / thumbnail-tabs-2 an optional last cell gives the tab label (and an optional thumbnail picture); without it the tab uses the slide heading and image. Empty rows/cells are ignored; extra text cells merge into the content. With thumbnail-tabs the tab label overlays the bottom of its thumbnail.

## Supported variations

| Variation | Option class |
| --- | --- |
| Thumbnail Tabs | `thumbnail-tabs` |
| Thumbnail Tabs 2 | `thumbnail-tabs-2` |

## Universal Editor fields

N/A (Document Authoring project)
