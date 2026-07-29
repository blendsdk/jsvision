---
title: List View
description: Render and navigate large typed collections with ListView virtual rows, selection signals, sorting, and type-ahead.
---

# List View

`ListView<T>` is the general typed list container. It accepts a reactive collection and a display
function, paints only the visible row window, and exposes separate focus and selection signals.
Use it when each item carries domain data that should survive independently of its displayed text.

The outer view is a layout group. Its public `rows` child owns focus and keyboard input, while an
owned [`ScrollBar`](/components/containers/scroll-bar) tracks the focused display index.

## Usage

```ts
import { ListView, signal } from '@jsvision/ui';

const people = signal([
  { name: 'Ada', age: 36 },
  { name: 'Alan', age: 41 },
]);
const selected = signal(-1);
const list = new ListView({
  items: people,
  getText: (person) => `${person.name} · ${person.age}`,
  selected,
  onSelect: (_index, person) => openProfile(person),
});
```

## Live example

<PlayExample id="containers/list-view" title="Typed virtual-list laboratory" blurb="Navigate a sorted typed collection, activate a row, and use prefix type-ahead while focus and selection remain independently visible." />

Try Down then Enter to select a person, or type a name prefix to move focus without selecting.

## Props and public state

`ListView<T>` accepts `ListViewOptions<T>`:

| Prop        | Type                    | Default             | Purpose                                   |
| ----------- | ----------------------- | ------------------- | ----------------------------------------- |
| `items`     | `Signal<T[]>`           | —                   | Reactive source collection.               |
| `getText`   | `(item: T) => string`   | —                   | Row label and sort/type-ahead text.       |
| `focused`   | `Signal<number>`        | internal `0`        | Highlighted display index.                |
| `selected`  | `Signal<number>`        | internal `-1`       | Activated display index; `-1` means none. |
| `onSelect`  | `(index, item) => void` | —                   | Activation callback.                      |
| `command`   | `string`                | —                   | Command emitted on activation.            |
| `sorted`    | `boolean`               | `false`             | Stable ascending order by `getText`.      |
| `typeAhead` | `boolean`               | `false`             | Case-insensitive prefix navigation.       |
| `numCols`   | `number`                | `1`                 | Column-major display columns.             |
| `roles`     | `ListRoles`             | standard list roles | Palette override for composed viewers.    |
| `bar`       | `ScrollBar`             | owned vertical bar  | Externally placed bar sharing `focused`.  |

The public `rows`, `focused`, and `selected` members make focus ownership and two-way state explicit.

## Size and Layout

Give the list a bounded flex slot or rectangle. Internally, rows consume the remaining width and the
default vertical bar reserves the rightmost column. Height determines the virtual window; the full
item collection is never painted at once.

With `numCols > 1`, items flow column-major and divider cells consume horizontal space. Ensure each
column is wide enough for useful labels. To place a custom horizontal bar, pass a `bar` sharing the
same `focused` signal and own that bar as a sibling.

## Virtual rows and selection

Focus is navigation state; selection is an explicit choice. Arrow keys, paging, Home/End, wheel
input, and single clicks move `focused`. Enter, Space, or a double-click activates the focused item,
writes `selected`, calls `onSelect`, and emits the optional command.

Reactive item changes clamp both indices safely. Virtual rendering keeps large sources responsive,
but the `items` signal still owns the full in-memory array; use a specialist data source when the
collection itself must be windowed.

## Sorting and type-ahead

`sorted` creates a stable display order from `getText`; indices then refer to that display order,
while callbacks still receive the original typed item. `typeAhead` performs a linear,
case-insensitive prefix search and moves only focus.

```ts
import { ListView, signal } from '@jsvision/ui';

const commands = new ListView({
  items: signal(commandDefinitions),
  getText: (command) => command.label,
  sorted: true,
  typeAhead: true,
});
```

Sorting and type-ahead are opt-in so data order and ordinary control keys remain untouched by
default.

## Best Practices

- Focus `list.rows`, not the outer `ListView` group.
- Treat `focused` as transient navigation and `selected` as the committed choice.
- Keep `getText` deterministic because sorting, searching, and rendering all use it.
- Use stable item objects when callbacks need durable identity beyond a display index.
- Prefer [`ListBox`](/components/containers/list-box) when the model is already `string[]`.

## Theming

`listNormal`, `listFocused`, and `listSelected` distinguish the three row states.
`listDivider` paints multi-column separators. The owned bar uses `scrollBarControls` and
`scrollBarPage`. Keep focused and selected states distinguishable in both color and monochrome
themes, because they communicate different state.

## Related

- [List Box](/components/containers/list-box) — string-specialized ListView.
- [Tree](/components/containers/tree) — hierarchical virtual rows.
- [Scroll Bar](/components/containers/scroll-bar) — passive position control.
- [ListView API](/api/ui/classes/ListView) — generated `ListViewOptions` and public state.
