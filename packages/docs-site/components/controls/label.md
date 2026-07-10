---
title: Label
description: Label — a caption wired to a control; a click or its Alt-hotkey focuses the linked control.
---

# Label

`Label` is a single-line caption **wired to another control**. Clicking the label — or pressing its
**Alt**+hotkey — moves focus to the linked control, and the label highlights while that control is
focused. Mark the hotkey letter by wrapping it in tildes: `'~N~ame'` makes **N** the accelerator. A
`Label` is never focusable and never in the Tab order; it exists to give another control a clickable,
keyboard-reachable caption.

## Usage

```ts
import { Label, Input, signal } from '@jsvision/ui';

const name = signal('');
const input = new Input({ value: name });
const label = new Label('~N~ame', input); // Alt+N or a click focuses `input`
```

## Live example

<PlayComingSoon title="Label" />

## Props

`new Label(text, link)` — the caption and the control it focuses.

| Prop              | Type     | Description                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------------- |
| `text` (ctor arg) | `string` | The caption; wrap one letter in tildes (`~N~ame`) to mark its Alt-hotkey.   |
| `link` (ctor arg) | `View`   | The control focused when the label is clicked or its Alt-hotkey is pressed. |

## Keyboard & mouse

| Input          | Result                                                          |
| -------------- | --------------------------------------------------------------- |
| **Click**      | Moves focus to the linked control.                              |
| **Alt**+hotkey | Moves focus to the linked control, from anywhere in the dialog. |

The label repaints when the linked control gains or loses focus, swapping to its highlighted colour.

## Best practices

- **Always link a real control.** The label's whole job is to focus its `link`; point it at the
  `Input` / `CheckGroup` / etc. it captions.
- **Mark the hotkey.** `~N~ame` gives keyboard users a one-key jump to the field.
- **Keep it one line.** `Label` draws a single row; for multi-line static text use
  [`Text`](/components/controls/text).

## Theming

| Role            | Applies to                                      |
| --------------- | ----------------------------------------------- |
| `label`         | The caption's normal text                       |
| `labelSelected` | The caption while the linked control is focused |
| `labelShortcut` | The `~hotkey~` accent glyph                     |

## Related

- [Input](/components/controls/input) — the field a label most often captions.
- [Text](/components/controls/text) — static text with no control link.
