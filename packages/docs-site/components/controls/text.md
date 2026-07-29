---
title: Text
description: Text — a non-focusable JSVision text block with reactive content, display-cell-aware word wrapping, natural measurement, explicit line breaks, and semantic warning or error styling.
---

# Text

`Text` presents read-only information: captions, instructions, paragraphs, status summaries, empty
states, and validation feedback. It is deliberately non-focusable and does not handle keyboard or
mouse input, so it communicates without adding a stop to the Tab order.

Pass a string for fixed copy or a getter for reactive copy. Text wraps to its assigned width,
preserves explicit line breaks, clips rows beyond its assigned height, and measures terminal display
cells rather than JavaScript string length. The optional `severity` distinguishes normal body text
from warnings and errors through semantic theme roles.

## Usage

Use a literal for fixed copy and a getter when signals should repaint the content:

```ts
import { Text, at, signal } from '@jsvision/ui';

const pending = signal(3);

panel.add(at(new Text('Review the queued changes before publishing.'), 2, 1, 42, 2));
panel.add(at(new Text(() => `${pending()} changes pending`), 2, 4, 42, 1));
```

The getter runs inside the view's reactive scope after mount. Signals it reads become dependencies,
and changing any of them schedules a repaint.

## Live example

<PlayExample id="controls/text"
  title="Text Lab"
  blurb="Compare fixed and reactive copy, word and Unicode wrapping, explicit line breaks, and normal, warning, and error roles in a centered Classic-theme dialog."
/>

Use **Increment** to update a reactive getter and **Toggle copy** to replace and rewrap the paragraph.
Press **Tab** to confirm that every Text block is skipped while the buttons remain reachable. The
normal, warning, and error samples use real theme roles; compare them with other presets from the
**View** menu.

## Props

`new Text(content, options?)` accepts one required content source and one optional configuration
object.

| Prop / argument    | Type                       | Default | Purpose                                                                         |
| ------------------ | -------------------------- | ------- | ------------------------------------------------------------------------------- |
| `content`          | `string \| (() => string)` | —       | Literal copy or a reactive getter whose signal dependencies trigger repainting. |
| `options.severity` | `'error' \| 'warning'`     | —       | Selects a semantic text role instead of the normal `staticText` role.           |

Both content forms are display-only. Text exposes no value signal, selection, activation callback,
or editing API. Its inherited `focusable` property remains `false`.

Severity is construction-time configuration. Put changing words or values in the content getter;
when the semantic state itself changes, compose separate Text instances through the application's
normal conditional-view pattern.

## Sizing & layout

`Text.measure()` returns the content's natural terminal-cell size:

- `width` is the display width of the widest **explicit** line;
- `height` is the number of lines separated by `\n`, with a minimum of one;
- a reactive getter is evaluated to obtain the current measurement.

This natural size lets Text participate in auto-sized flow layouts. An absolute rectangle remains a
hard override: Text wraps inside that width and clips after that height.

```ts
const title = new Text('Deployment summary');

title.measure(); // { width: 18, height: 1 }
panel.add(at(title, 2, 1, 24, 1)); // explicit layout overrides the natural width
```

Natural measurement does **not** predict the height after constraining the width—it measures explicit
source lines before wrapping. Use the public `wrapText()` helper when a dialog or panel must reserve
the exact wrapped height:

```ts
import { Text, at, wrapText } from '@jsvision/ui';

const message = 'The export finished with warnings that require review.';
const width = 32;
const height = wrapText(message, width).length;

dialog.add(at(new Text(message), 2, 2, width, height));
```

A reactive getter automatically repaints and rewraps inside the Text's **current bounds**. It does
not request a parent relayout when its natural measurement changes, so give changing content stable
bounds large enough for its expected states or explicitly rebuild/reflow the surrounding layout.

## Wrapping and line breaks

Text uses the same public `wrapText(content, width)` algorithm it exposes to applications:

- the last whole word that fits stays on the current row;
- spaces at a wrap boundary are removed from the beginning of the next row;
- whitespace within a row and leading indentation are preserved;
- a word wider than the view is hard-broken so wrapping always makes progress;
- `\n` forces a new row, and an empty source line remains empty;
- content beyond the assigned height is clipped rather than scrolled.

```ts
import { wrapText } from '@jsvision/ui';

wrapText('the quick brown fox', 10);
// ['the quick', 'brown fox']

wrapText('one\n\ntwo', 10);
// ['one', '', 'two']

wrapText('supercalifragilistic', 6);
// ['superc', 'alifra', 'gilist', 'ic']
```

Widths are terminal display cells. Wide CJK characters and emoji normally occupy two cells, while
combining marks occupy zero, so wrapping agrees with the screen buffer:

```ts
wrapText('日本語', 4); // ['日本', '語']
wrapText('😀😀😀', 4); // ['😀😀', '😀']
```

The scan keeps Unicode code points intact and never splits a surrogate pair. A multi-code-point
grapheme—such as a family emoji joined with zero-width joiners, a skin-tone sequence, or a flag—may
still wrap between its code points. Allow extra width when those sequences must remain visually
indivisible.

## Reactive content

A content getter can combine any number of signals. Text subscribes when it mounts and disposes the
subscription when it unmounts, so the view follows application state without manual repaint calls:

```ts
import { Text, signal } from '@jsvision/ui';

const completed = signal(4);
const total = signal(12);

const progress = new Text(() => `Processed ${completed()} of ${total()} records`);

completed.set(5); // the mounted Text repaints as “Processed 5 of 12 records”
```

Keep getters cheap and side-effect free. They can run for painting and measurement, so use them to
derive presentation from state—not to mutate state, perform I/O, or launch work.

## Semantic severity

Use severity for the meaning of the message, not as an arbitrary color picker:

```ts
const hint = new Text('All required fields are complete.');
const warning = new Text('This action cannot be undone.', { severity: 'warning' });
const error = new Text('Project name is required.', { severity: 'error' });
```

`warning` selects `warningText`; `error` selects `dangerText`; an omitted severity selects
`staticText`. Severity changes presentation only—it does not add an icon, announce a message,
capture focus, or block an action. Include the meaning in the wording and place the message near the
control or action it explains.

For form validation, prefer one concise error adjacent to the relevant field or a clearly titled
summary. Do not rely on color alone: users and monochrome terminals must still understand words such
as “Warning” and “Error.”

## Focus and interaction

Text has no interaction states:

| Input               | Result                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| **Tab / Shift+Tab** | Skips Text and moves among focusable siblings.                           |
| **Click**           | No activation or focus change is handled by Text.                        |
| **Alt+letter**      | No accelerator; `~x~` has no special meaning and is rendered as content. |
| **Selection**       | Text does not provide an application selection or clipboard surface.     |

Use [`Label`](/components/controls/label) when a caption should focus another control by click or
Alt-hotkey. Use a [`Button`](/components/controls/button) or another focusable control when the copy
represents an action.

## Best practices

- **Use Text for information, not interaction.** Making actionable copy look like plain text hides
  it from keyboard navigation; use a Button, Label, or purpose-built control.
- **Use a getter only for changing copy.** A literal is simpler for fixed text, while a getter keeps
  reactive status readouts synchronized without manual invalidation.
- **Budget wrapped height.** A narrow width can add many rows, and Text clips rather than scrolls.
  Use `wrapText()` when the full message must remain visible.
- **Give reactive copy stable bounds.** Repainting does not automatically resize the parent layout;
  plan for the longest expected state or trigger a deliberate reflow.
- **Use semantic severity sparingly.** Too many warning and error lines flatten the hierarchy and
  make genuinely urgent messages harder to find.
- **Write the severity into the message.** Color can disappear in monochrome themes and is never a
  sufficient indication on its own.
- **Choose a multiline or scrollable control for large documents.** Text is excellent for bounded
  explanatory copy; Editor, Memo, or a Scroller is better when users need navigation or selection.

## Theming

Text paints its entire assigned rectangle—including unused cells—with one of three roles.

::: details Text theme roles

| Role          | Applies to                                | Classic default                 |
| ------------- | ----------------------------------------- | ------------------------------- |
| `staticText`  | Normal text and its full background field | black on light gray             |
| `warningText` | `severity: 'warning'` text and field      | amber (`#f59e0b`) on light gray |
| `dangerText`  | `severity: 'error'` text and field        | red (`#ef4444`) on light gray   |

:::

All three roles should share a background compatible with the surface hosting the Text. Preserve
readable contrast in every color mode, and keep warning and danger distinguishable without making
either depend on hue alone.

## Related

- [Label](/components/controls/label) — a caption that focuses a linked control.
- [Button](/components/controls/button) — focusable, actionable text.
- [Input](/components/controls/input) — editable single-line text.
- [Editor](/components/editor/editor) — selectable, editable multiline text.
- [Memo](/components/editor/memo) — a signal-bound multiline editor for dialogs.
- [Scroller](/components/containers/scroller) — a viewport for content larger than its visible area.
- [API reference](/api/ui/classes/Text) — complete `Text`, `TextOptions`, and `TextSeverity` signatures.
