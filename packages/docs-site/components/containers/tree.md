---
title: Tree
description: Navigate typed hierarchical data with a virtual-scrolling Tree, caller-owned selection, independent expansion state, and adaptive markers.
---

# Tree

`Tree<T>` renders a reactive forest of `TreeNode<T>` values as a focusable outline. It flattens only
currently expanded nodes, paints only the visible row window, and keeps expansion state inside the
view rather than mutating domain nodes.

Use it for project explorers, navigation outlines, and other hierarchies where parent/child
structure and expansion are meaningful.

## Usage

```ts
import { Tree, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';

const roots = signal<TreeNode<string>[]>([
  { value: 'src', children: [{ value: 'index.ts', children: [] }] },
  { value: 'README.md', children: [] },
]);
const tree = new Tree({ roots, getText: (name) => name, markerStyle: 'brackets' });
```

## Live example

<PlayExample id="containers/tree" title="Outline navigation laboratory" blurb="Expand a project node, descend to its first child, activate it, and compare bracket markers with focused and selected row states." />

Press Right twice then Enter: the first Right expands, the second descends, and Enter commits the
child without conflating navigation with selection.

## Props and public state

`Tree<T>` accepts `TreeOptions<T>`:

| Prop                   | Type                    | Default       | Purpose                                |
| ---------------------- | ----------------------- | ------------- | -------------------------------------- |
| `roots`                | `Signal<TreeNode<T>[]>` | —             | Reactive forest.                       |
| `getText`              | `(value: T) => string`  | —             | Row label.                             |
| `focused`              | `Signal<number>`        | internal `0`  | Highlighted flattened index.           |
| `selected`             | `Signal<number>`        | internal `-1` | Activated flattened index.             |
| `onSelect` / `command` | callback / string       | —             | Activation outputs.                    |
| `expandedByDefault`    | `boolean`               | `false`       | Seed every branch expanded.            |
| `guides`               | `boolean`               | `true`        | Draw connector guides.                 |
| `markerStyle`          | `MarkerStyle`           | `'tv'`        | `'tv'`, `'brackets'`, or `'triangle'`. |

Public `rows`, `focused`, and `selected` expose navigation state. `isExpanded`, `expand`,
`collapse`, `toggle`, `expandAll`, `collapseAll`, and `expandSubtree` control view-owned expansion.

## Size and Layout

The outer group lays out virtual rows beside an owned one-cell vertical bar. Give it a bounded
height to define the visible window and enough width for guides, marker, indentation, and useful
text. Focus `tree.rows`, not the outer group.

Deep levels consume horizontal cells. Labels clip safely, but a very narrow tree can leave only
connectors visible; choose a width appropriate to expected depth.

## Expansion and navigation

Plus expands and minus collapses the focused branch; `*` expands its subtree. Right expands a
collapsed branch or descends to its first child. Left collapses an expanded branch or moves to its
parent. Arrow, page, Home/End, and Ctrl+Page keys navigate the flattened visible rows.

The same node objects may appear in multiple trees with independent expansion state because
`TreeNode` remains plain immutable data.

## Selection and markers

Enter and text double-click activate the focused row, update `selected`, and invoke the optional
callback/command. A guide-zone click toggles expansion without selecting.

`'tv'` uses compact `+`/`─` markers, `'brackets'` uses ASCII `[+]`/`[-]`, and `'triangle'` uses
`▸`/`▾` with an automatic bracket fallback when Unicode is unavailable. Marker choice changes only
the marker column.

```ts
import { Tree } from '@jsvision/ui';

tree.expandAll();
tree.collapse(roots()[0]);
if (tree.isExpanded(roots()[0])) openInspector();
```

## Best Practices

- Keep `TreeNode` data immutable and let each Tree own expansion.
- Focus `tree.rows`; use a linked Label for a dialog accelerator.
- Preserve object identity when updating roots if expansion continuity matters.
- Keep `getText` deterministic and concise enough for expected depth.
- Treat focus as navigation and selection as activation.

## Theming

`outlineNormal`, `outlineFocused`, and `outlineSelected` paint row states.
`outlineNotExpanded` distinguishes collapsed branch text. Connector guides use `outlineNormal`, and
the owned bar uses the scroll-bar roles. Ensure collapsed hints remain legible without overpowering
focused and selected rows.

## Related

- [List View](/components/containers/list-view) — flat typed rows.
- [Scroller](/components/containers/scroller) — generic oversized content.
- [File List](/components/files/file-list) — filesystem-specific composition.
- [Tree API](/api/ui/classes/Tree) — generated `TreeOptions`, `TreeNode`, and methods.
