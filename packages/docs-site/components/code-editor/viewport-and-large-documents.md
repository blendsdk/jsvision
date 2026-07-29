---
title: Code Editor viewport and large documents
description: Keep Code Editor resizing, mouse selection, scrolling, line numbers, long lines, document-size tiers, and degradation behavior bounded and observable.
---

# Viewport and large documents

The viewport projects only visible rows and clamps horizontal and vertical scroll state after every
resize. Document-size classification separately decides which expensive capabilities remain
enabled, degraded, suspended, or confirmation-gated.

## Focused usage

```ts
import { classifyDocumentSize } from '@jsvision/code-editor';

const tier = classifyDocumentSize({ bytes: sourceBytes, lines: lineCount });
```

## Responsive viewport and mouse

Mouse coordinates are translated through frame, gutter, scroll, visual-column, and folded-row
geometry before they become document positions. Resize the containing `Template1Dialog` to test
that projection under both compact and maximized layouts.

<PlayExample id="code-editor/viewport-mouse"
  title="Responsive viewport laboratory"
  blurb="Resize or maximize the dialog, then run a real selection check with line numbers and viewport status visible."
/>

## Large-document tiers

Classification distinguishes normal operation from large and confirmation-gated documents.
Degradation must be visible and reversible; it should not silently pretend syntax, folding, or
language intelligence is current when work was suspended.

<PlayExample id="code-editor/large-document-tiers"
  title="Bounded size-tier comparison"
  blurb="Switch from a full document to a bounded large fixture and inspect its explicit degradation notice."
/>

## Limits and practices

- Build synthetic docs fixtures under a strict byte and line ceiling.
- Measure viewport work independently from full-document analysis.
- Preserve editing, navigation, selection, save, and close as essential capabilities.
- Reclassify after content size changes and clear stale degraded results when returning to full mode.

## Related

- [Folding](/components/code-editor/folding) — understand visible-row projection.
- [Themes & fallbacks](/components/code-editor/themes-and-fallbacks) — keep degraded state legible.
- [`classifyDocumentSize` API](/api/code-editor/functions/classifyDocumentSize) — generated limits.
