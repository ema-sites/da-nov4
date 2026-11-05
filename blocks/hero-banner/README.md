# hero-banner

Custom **hero** block. Purpose: Page-top photo or video banner with a heading panel, optional text and CTA, and optional aside card (contact box, offer card, overlap card).

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: Row 1 (media): background picture, and/or a link to an .mp4/.webm video (picture becomes the poster). Row 2 (content): heading, optional text and CTA links (a link alone in a paragraph becomes a button). Optional further rows: aside cards (contact box, offer card with image, overlap card). A picture alone in the first cell of the content row is also treated as the background.

## Supported variations

| Variation | Option class |
| --- | --- |
| Split Strip | `split-strip` |
| Split | `split` |
| Contact Box | `contact-box` |
| Offer Card | `offer-card` |
| Video | `video` |
| Orange | `orange` |
| Video 2 | `video-2` |
| Split Overlap Card | `split-overlap-card` |
| Energy Lines | `energy-lines` |

Without a layout option (`split`, `split-strip`, `split-overlap-card`, `video`, `video-2`, `energy-lines`) the layout follows the background picture:

- wide photo (width / height of 2.4 or more, e.g. 1440x524): full-bleed background with the text in the left half (mobile: text above the photo);
- narrower photo (e.g. 1200x579): `energy-lines` layout, i.e. photo on the left, light grey panel with the RBC energy lines and the text on the right (mobile: photo above the panel);
- no photo: light grey text panel.

## Universal Editor fields

N/A (Document Authoring project)
