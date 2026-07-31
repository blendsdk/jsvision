---
title: List Box
description: Navigate and select reactive string collections with the focused, virtual-scrolling ListBox specialization.
---

# List Box

`ListBox` is the string-specialized form of [`ListView<T>`](/components/containers/list-view). Give
it a `Signal<string[]>` and it supplies the identity text renderer while retaining virtual rows,
keyboard and pointer navigation, separate focus and selection, optional sorting, type-ahead, and
multi-column layout.

Use it for choices whose display text is the complete model. Choose `ListView<T>` when activation
must return a richer domain object.

## Usage

```ts
import { ListBox, signal } from '@jsvision/ui';

const items = signal(['Draft', 'Review', 'Published']);
const selected = signal(-1);
const list = new ListBox({
  items,
  selected,
  onSelect: (_index, value) => openStatus(value),
});
```

## Live example

<PlayExample id="containers/list-box" title="Reactive string-list laboratory" blurb="Navigate five values, activate a row, then replace the source with two items and observe safe focus clamping." />

Move to the last row with End, then press Alt+R. The collection shrinks without leaving focus
outside the new range.

## Props and public state

`ListBoxOptions` is `ListViewOptions<string>` without `getText`:

| Prop            | Type                     | Default        | Purpose                                     |
| --------------- | ------------------------ | -------------- | ------------------------------------------- |
| `items`         | `Signal<string[]>`       | —              | Reactive string source.                     |
| `focused`       | `Signal<number>`         | internal `0`   | Highlighted display index.                  |
| `selected`      | `Signal<number>`         | internal `-1`  | Activated display index.                    |
| `onSelect`      | `(index, value) => void` | —              | Activation callback.                        |
| `command`       | `string`                 | —              | Optional activation command.                |
| `sorted`        | `boolean`                | `false`        | Stable ascending string order.              |
| `typeAhead`     | `boolean`                | `false`        | Prefix navigation.                          |
| `numCols`       | `number`                 | `1`            | Column-major display count.                 |
| `roles` / `bar` | inherited options        | standard/owned | Palette and external scrollbar composition. |

Public `rows`, `focused`, and `selected` come from `ListView`.

## Size and Layout

The list needs a bounded height to define its virtual window. The rows fill available width and the
owned vertical bar occupies the final column. Multi-column mode divides that width into equal bands
with `listDivider` separators; size the control for the longest expected value.

Focus `list.rows`, not the outer group. A label can target that rows view to provide a dialog-wide
accelerator.

## Reactive string lists

Writing a new array to `items` invalidates the rows, redraws the visible values, and clamps focus to
the last valid display index. An empty list renders an explicit empty marker and keeps indices in a
safe state.

```ts
import { ListBox, signal } from '@jsvision/ui';

const choices = signal(['One', 'Two', 'Three']);
const list = new ListBox({ items: choices });

choices.set(['Only choice']); // focus safely clamps to index 0
```

The control reads the full array but paints only the viewport. For remote or unbounded data, use a
component designed around a windowed source instead.

## Selection and activation

Arrow keys, Page Up/Down, Home/End, wheel input, and clicks move focus. Enter, Space, or a
double-click commits the current row to `selected`, fires `onSelect`, and emits `command` when
provided. A single click focuses and selects according to the list interaction model.

Keep focus and selection visually and semantically distinct: users may inspect several rows before
committing a choice.

## Best Practices

- Use `ListBox` only when a string is the complete value; avoid parallel arrays of labels and IDs.
- Own the signals when other controls need to observe or reset focus and selection.
- Preserve source order unless alphabetical order is genuinely the user’s model.
- Enable type-ahead for long, stable vocabularies and keep labels prefix-distinct where possible.
- Test empty and shrinking arrays, not only the populated happy path.

## Theming

`listNormal`, `listFocused`, and `listSelected` paint ordinary, navigated, and committed rows.
`listDivider` separates columns, while the owned bar uses `scrollBarControls` and `scrollBarPage`.
Maintain a clear distinction between focused and selected colors in Classic, monochrome, and custom
themes.

## Related

- [List View](/components/containers/list-view) — typed items and custom rendering.
- [Tree](/components/containers/tree) — hierarchical choices.
- [Combo Box](/components/dropdown/combo-box) — compact field plus popup list.
- [ListBox API](/api/ui/classes/ListBox) — generated constructor and inherited state.
