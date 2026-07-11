---
title: Text
description: Text — a static, non-focusable block of word-wrapped text; give it a getter to make it reactive.
---

# Text

`Text` is a static, non-focusable block of text — a caption, a paragraph, or a live read-out of some
piece of state. Its content is word-wrapped to the view's width and left-aligned, and **Tab** skips
over it. Give it a plain string, or a **getter** (`() => string`) to make it reactive: whenever a
signal the getter reads changes, the text repaints itself.

## Usage

```ts
import { Text, signal } from '@jsvision/ui';

// A fixed caption.
const caption = new Text('Press + to increment.');

// A live read-out — repaints whenever `count` changes.
const count = signal(0);
const readout = new Text(() => `Count: ${count()}`);
```

## Live example

<PlayComingSoon title="Text" />

## Props

`new Text(content)` — a single constructor argument.

| Prop                 | Type                       | Description                                                                                    |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `content` (ctor arg) | `string \| (() => string)` | The text. A **getter** makes it reactive — the view repaints when the signals it reads change. |

Wrapping is width-aware: lines break after the last whole word that fits, a word wider than the view
is hard-broken at the edge, and an explicit newline always forces a new line.

## Sizing

`Text` has **no intrinsic size** and provides no `measure()`, so a parent must give it a width and
height — placed with neither it collapses to `0×0` and shows nothing. Reserve enough **rows** for the
wrapped content: text taller than its box is clipped, not scrolled.

## Best practices

- **Use a getter for anything that changes.** A getter repaints itself as its signals update; a plain
  string never changes.
- **Size it for the wrapped height.** Estimate how many rows the content wraps to and give the view
  that many — a one-row box silently clips a paragraph.
- **It's display-only.** `Text` never takes focus or handles input; for a clickable, keyboard-reachable
  caption that focuses another control, use [`Label`](/components/controls/label).

## Theming

`Text` paints in the single `staticText` role (black on the light-gray dialog field, by default).

## Related

- [Label](/components/controls/label) — a caption wired to a control (clickable + Alt-hotkey).
- [Input](/components/controls/input) — the editable counterpart for user-entered text.
- [API reference](/api/ui/classes/Text) — the generated `Text` signature.
