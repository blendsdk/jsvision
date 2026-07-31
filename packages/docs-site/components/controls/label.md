---
title: Label
description: Connect a concise caption to another JSVision control so clicks and Alt-hotkeys move focus predictably.
---

# Label

`Label` is a one-line caption with an explicit focus relationship. It stays out of the Tab order,
but clicking it or pressing its marked Alt-hotkey focuses the linked control. While that control is
focused, the caption changes style so the relationship remains visible.

Use a label when a field needs both a readable name and a fast keyboard route. For explanatory copy
that should not move focus, use [`Text`](/components/controls/text) instead.

## Usage

```ts
import { Input, Label, signal } from '@jsvision/ui';

const name = signal('');
const input = new Input({ value: name });
const label = new Label('~N~ame', input);
```

## Live example

<PlayExample id="controls/label" title="Linked-label laboratory" blurb="Use Alt+N/Alt+E or click either caption, then type to prove which Input received focus." />

The example includes two linked fields, a plain non-interactive caption, live bound-value feedback,
and reset controls. Watch a linked label highlight when its field owns focus.

## Props

`Label` has two constructor arguments rather than an options object:

| Argument | Type     | Purpose                                                                    |
| -------- | -------- | -------------------------------------------------------------------------- |
| `text`   | `string` | Caption text; wrap one letter in tildes, as in `~N~ame`, to mark a hotkey. |
| `link`   | `View`   | The exact focusable view that receives focus on click or Alt-hotkey.       |

The linked `View` is retained for the label's lifetime. `Label` itself is not focusable and exposes
its parsed accelerator to the containing dialog for duplicate-hotkey checks.

## Size and Layout

A label paints a single row. Give it enough width for the display text after the `~` markers are
removed; extra cells are filled with the current base role (`label` or `labelSelected`), while text
beyond the assigned width is clipped. Position the label beside or immediately above its linked
control so the visual and focus relationship agree.

The control does not reserve a gap or place its link automatically. Parent layout remains
responsible for both views, which makes the same `Label` work in fixed forms, rows, and dialog grids.

## Linking and focus

The relationship is direct: the constructor receives the control instance, not an ID or lookup
string. On mount, the label observes that view's focus signal. A focus change therefore repaints the
caption even when focus arrived through Tab, a mouse click, application code, or another accelerator.

Because the label never enters the focus chain, adding captions does not double the number of Tab
stops. The linked control keeps all editing and validation behavior.

## Keyboard & mouse

| Input                     | Result                                                         |
| ------------------------- | -------------------------------------------------------------- |
| **Alt** + marked hotkey   | Focus the linked control from anywhere in the active dialog.   |
| **Click** on the label    | Focus the linked control without activating a separate action. |
| **Tab / Shift+Tab**       | Skip the label and visit focusable controls normally.          |
| Programmatic focus change | Repaint the label in its selected or normal role.              |

Accelerators are case-insensitive. A label without a tilde-marked character remains clickable but
has no Alt-hotkey.

## Best Practices

- Choose a unique accelerator within the dialog. Duplicate letters make the winning route depend on
  traversal order and are harder for users to predict.
- Link the field the caption visually describes. Avoid remote focus jumps across unrelated panels.
- Keep captions short and single-line; use `Text` for instructions, validation summaries, or wrapped
  prose.
- Construct the target first, then pass that same instance to `Label`. Replacing only the rendered
  field later leaves the old focus relationship intact.

## Theming

| Theme role      | Region                                                              |
| --------------- | ------------------------------------------------------------------- |
| `label`         | Caption text while the linked control is not focused.               |
| `labelSelected` | Caption base while the linked control owns focus.                   |
| `labelShortcut` | Marked accelerator glyph; terminal capability may add an underline. |

Keep all three roles legible on the dialog surface. The selected role should communicate focus
without relying only on hue, and the shortcut role needs contrast in both selected and normal states.

## Related

- [Input](/components/controls/input) — the most common linked editing control.
- [Text](/components/controls/text) — static or reactive copy with no focus relationship.
- [Button](/components/controls/button) — a focusable command with its own accelerator.
- [Label API](/api/ui/classes/Label) — generated constructor and inherited `View` surface.
