---
title: Indicator
description: Indicator — the passive line, column, modified, and window-drag status strip used by EditWindow.
---

# Indicator

`Indicator` is a passive editor status strip. It displays a 1-based caret position, marks modified
content with `*`, and changes its border line while an ancestor window is being dragged.
[`EditWindow`](/components/editor/edit-window) wires one automatically.

## Usage

```ts
import { Indicator } from '@jsvision/ui';

const indicator = new Indicator();
indicator.setValue({ line: 12, col: 34 }, true);
```

## Live example

<PlayExample id="editor/indicator"
  title="Indicator Lab"
  blurb="Drive the passive line/column strip through its public IndicatorTarget update seam."
/>

## Props and public state

`Indicator` implements `IndicatorTarget`. Its public `setValue({ line, col }, modified)` method
updates the projected caret and dirty state; construction has no options.

## Caret and modified state

The colon is aligned to a stable column while the surrounding numbers grow. A leading `*` means the
document has unsaved changes. Both values repaint reactively after `setValue`.

## Window drag presentation

Inside a Window, the indicator discovers the ancestor drag signal: `═` represents rest and `─`
represents dragging. Standalone indicators use the resting presentation.

## Sizing and layout

Allocate one row and enough width for the marker plus position. EditWindow places a 14-cell strip in
its bottom frame. Indicator never takes focus or handles input.

## Best practices

- Let Editor push updates through `IndicatorTarget`; do not poll caret state.
- Treat it as presentation, not an editor command surface.

## Theming

`indicatorNormal` styles rest; `indicatorDragging` styles an active window drag.

## Related

- [Edit window](/components/editor/edit-window) — owns the standard indicator.
- [Editor](/components/editor/editor) — produces caret and modified state.
- [API reference](/api/ui/classes/Indicator) — generated signatures.
