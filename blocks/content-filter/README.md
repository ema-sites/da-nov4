# content-filter

Custom **custom** block. Purpose: Filter or audience toggle that switches which content is shown: toggle buttons, category pills, dropdown selector with Go, or a results/sort toolbar.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: One row per filter control. Plain row: cell 1 = label (optional icon), cell 2 = optional filter key matching a section metadata `filter` value. Row with a link = a navigating chip. Row with a list in a cell = a dropdown (cell 1 = label, list items = options; linked items add a Go button, bold text sets its label). Toolbar: plain-text rows (e.g. result count) render as info.

## Supported variations

| Variation | Option class |
| --- | --- |
| Pills | `pills` |
| Dropdowns | `dropdowns` |
| Toolbar | `toolbar` |
| Pills 2 | `pills-2` |
| Pills Alt | `pills-alt` |

## Universal Editor fields

N/A (Document Authoring project)
