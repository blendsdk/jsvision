---
title: Memo
description: Memo — a dialog-embeddable multiline editor bound two-way to a Signal<string>; typing writes the signal, writing the signal replaces the buffer.
---

# Memo

`Memo` is an [`Editor`](/components/editor/editor) styled for the gray dialog palette and safe to
place among other controls: it lets **Tab pass through**, so dialog focus traversal still works. Its
content is bound two-way to a `Signal<string>` — typing writes the signal the same tick, and writing
the signal from outside replaces the buffer — so you read and write the memo's text through that
signal rather than through the editor. It inherits every `Editor` capability (undo/redo, clipboard,
find/replace); only the styling, Tab behavior, and the signal binding differ.

## Usage

```ts
import { Dialog, Memo, signal } from '@jsvision/ui';

const notes = signal('initial text');
const memo = new Memo({ value: notes });
memo.setLayout({ position: 'absolute', rect: { x: 2, y: 2, width: 40, height: 8 } });

const dialog = new Dialog({ title: 'Notes', width: 46, height: 14 });
dialog.add(memo);

// Read the bound signal (e.g. inside an effect) to observe edits; write it to replace the buffer.
notes.set('replaced from outside'); // updates the memo's buffer
console.log('memo text is', notes());
```

## Live example

<PlayExample id="editor/memo"
  title="Memo Lab"
  blurb="Edit a signal-bound multiline field, replace it externally, and let Tab continue through the dialog."
/>

## Props

`new Memo(options)` — extends [`EditorOptions`](/components/editor/editor#props) with one required
field.

The public surface is `Memo`, `MemoOptions`, inherited `EditorOptions`, and its required
`Signal<string>`.

| Prop    | Type             | Default | Description                                                                         |
| ------- | ---------------- | ------- | ----------------------------------------------------------------------------------- |
| `value` | `Signal<string>` | —       | Two-way bound content: edits write it; writing it from outside replaces the buffer. |

All other `Editor` options (`clipboard`, `keyBindings`, `undoDepth`, `autoIndent`, `overwrite`,
`editorDialog`, `commands`) apply unchanged.

## Signal synchronization

Typing mirrors the complete buffer into `value` in the same update. External signal writes replace
the buffer without feedback loops, making the signal the durable source of truth.

## Dialog focus behavior

Identical to [`Editor`](/components/editor/editor#keyboard-mouse), with one difference: **Tab is not
captured** — it moves focus to the next control so a memo sits naturally in a dialog's focus order.

## Sizing & layout

Give it an absolute rect within the dialog. It behaves like any leaf control in the dialog's layout
and traversal.

## Best practices

- **Read and write through the signal.** The `value` signal is the source of truth — observe edits by
  reading it in an `effect`, and replace the content by setting it; don't reach into the editor buffer.
- **Use it for bounded, form-like text.** A `Memo` is the multiline field of a dialog (notes, a
  description); for a full document window use [`EditWindow`](/components/editor/edit-window).

## Theming

Text uses the `memoNormal` / `memoSelected` gray-dialog roles (rather than the blue editor roles).

## Related

- [Editor](/components/editor/editor) — the base multiline editor.
- [Edit window](/components/editor/edit-window) — a full document window with scroll bars.
- [Dialog](/components/containers/dialog) — the modal frame a memo typically sits in.
- [API reference](/api/ui/classes/Memo) — the generated `Memo` signature.
