---
title: Tree
description: Tree — a focusable, virtual-scrolling, expandable outline over a forest of nodes, with connector guides and a choice of expand markers.
---

# Tree

`Tree<T>` is a focusable, virtual-scrolling outline: it takes a forest of `TreeNode` roots, flattens
the currently-visible (expanded) nodes into an ordered row list, and paints only its visible window —
so it stays fast over large trees. Nodes carry `│├└─` connector guides and a `+` / `─` expand marker,
and it owns a vertical [`ScrollBar`](/components/containers/scroll-bar).

Expand state is **owned by the view**, keyed on node object identity — the node data stays plain and
immutable, and the same node can live in more than one tree with independent expand state.

## Usage

```ts
import { Tree, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';

// A leaf is `children: []`.
const n = (value: string, children: TreeNode<string>[] = []): TreeNode<string> => ({ value, children });
const roots = signal<TreeNode<string>[]>([n('src', [n('index.ts'), n('engine', [n('buffer.ts')])]), n('README.md')]);

const tree = new Tree({
  roots,
  getText: (name) => name,
  command: 'open',
  markerStyle: 'brackets', // `[+]`/`[-]` markers instead of the default `+`/`─`
});
tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 28, height: 10 } };
// loop.focusView(tree.rows) — focus the rows renderer, not the group. tree.expandAll() to open all.
```

## Live example

<PlayComingSoon title="Tree" />

## Props

`new Tree(options)`.

| Prop                | Type                               | Default     | Description                                                                   |
| ------------------- | ---------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `roots`             | `Signal<TreeNode<T>[]>`            | —           | The reactive forest of root nodes (a single-root tree is the 1-element case). |
| `getText`           | `(value: T) => string`             | —           | Render a node's value to its row text.                                        |
| `focused`           | `Signal<number>`                   | internal 0  | The highlighted flattened-visible index.                                      |
| `selected`          | `Signal<number>`                   | internal −1 | The chosen flattened-visible index (`-1` = none).                             |
| `onSelect`          | `(index, node) => void`            | —           | Activation callback (Enter / text double-click).                              |
| `command`           | `string`                           | —           | Command emitted on activation, handled elsewhere.                             |
| `expandedByDefault` | `boolean`                          | `false`     | Seed every node with children as expanded at construction.                    |
| `guides`            | `boolean`                          | `true`      | Draw the `│├└─` connectors; `false` = flat indent.                            |
| `markerStyle`       | `'tv' \| 'brackets' \| 'triangle'` | `'tv'`      | Expand-marker style (see below).                                              |

## Keyboard & mouse

| Input                 | Result                                         |
| --------------------- | ---------------------------------------------- |
| **↑ / ↓**             | Move the highlight.                            |
| **PgUp / PgDn**       | Page the highlight.                            |
| **Home / End**        | Jump to the first / last visible row.          |
| **Ctrl+PgUp / PgDn**  | Jump to the ends.                              |
| **+ / −**             | Expand / collapse the focused node.            |
| **\***                | Expand the focused node's whole subtree.       |
| **← / →**             | Collapse-or-parent / expand-or-child.          |
| **Enter**             | Activate (fires `onSelect` / emits `command`). |
| **Click** a guide     | Toggle that node.                              |
| **Double-click** text | Activate that node.                            |

## Sizing & layout

Give the `Tree` its own bounds (an absolute `rect` or a flex slot); internally it lays out as a row —
the rows renderer fills the width, the owned scroll bar takes the rightmost column. Because a plain
`Group` is not itself a focus target, **focus the exposed `tree.rows`**, not the tree.

The marker style adapts to the terminal: `'tv'` is a faithful single `+`/`─`, `'brackets'` draws
`[+]`/`[-]` (pure ASCII, the most legible), and `'triangle'` draws `▸`/`▾` but falls back to
`'brackets'` where Unicode is unavailable. Only the marker column changes — indentation and connectors
are identical across styles.

## Best practices

- **Keep node data plain.** Expand state lives in the view, keyed on identity — never mutate the
  `TreeNode` objects to track open/closed. Drive expansion with `expand` / `collapse` / `toggle` /
  `expandAll` / `collapseAll` / `expandSubtree`.
- **Focus `tree.rows`.** The group is not focusable; focusing it does nothing.
- **Pick a marker for your audience.** `'brackets'` is the safest for legibility and ASCII terminals;
  keep the default `'tv'` for a classic look.

## Theming

| Role                 | Applies to                                           |
| -------------------- | ---------------------------------------------------- |
| `outlineNormal`      | A normal row (expanded node or leaf): yellow on blue |
| `outlineFocused`     | The focused row — an inverted bar: blue on lightGray |
| `outlineSelected`    | A selected row: brightGreen on blue                  |
| `outlineNotExpanded` | A collapsed node's text (a hint it has children)     |

The owned scroll bar uses the `scrollBar*` roles.

## Related

- [List box](/components/containers/list-box) — a flat single-column list.
- [Data grid](/components/table/data-grid) — a multi-column table.
