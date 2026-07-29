---
title: Data Grid theming, accessibility, and performance
description: Preserve Data Grid contrast, focus, keyboard discoverability, bounded rendering, and honest performance guidance.
---

# Theming, accessibility and performance

The grid succeeds only when state remains perceivable and interaction remains responsive. Theme
roles must distinguish focus, selection, dirty values, and errors; keyboard help must make the
navigation model discoverable; performance work must preserve those semantics.

## Focused usage

```ts
import { classicTheme } from '@jsvision/core';

app.setTheme(classicTheme);
// Custom themes must keep gridFocusedCell, gridSelectedRow, and gridInvalid distinct.
```

## Theme roles and keyboard access

Check normal, focused, selected, dirty, disabled, and error combinations rather than viewing roles
in isolation. Pair color with text, glyph, border, or status feedback, and expose the active keymap
inside the lab.

<PlayExample id="data-grid/theming-accessibility"
  title="Theme and keyboard audit"
  blurb="Compare critical grid states under Classic roles and inspect focus, contrast cues, and keyboard help."
/>

## Performance boundaries

Render visible rows, bound source reads, and keep cell formatting pure. Surface what the lab
actually proves—read counts, loaded range, and source mode—instead of claiming a universal
frame-rate or row limit.

<PlayExample id="data-grid/performance-boundaries"
  title="Performance boundaries"
  blurb="Inspect lazy window reads, bounded rendering, and honest source guidance without benchmark theater."
/>

## Limits and practices

- Do not remove focus or error cues to save paint work.
- Test keyboard-only traversal, narrow viewports, and high-contrast themes.
- Cache only values whose invalidation rules are explicit.
- Cancel timers, source reads, editors, and popups when the example resets or disposes.

## Related

- [Data at scale](/components/data-grid/data-at-scale) — choose a bounded source.
- [Layout & rendering](/components/data-grid/layout-and-rendering) — keep renderers pure.
- [EditableDataGrid API](/api/datagrid/classes/EditableDataGrid) — generated rendering and
  interaction options.
