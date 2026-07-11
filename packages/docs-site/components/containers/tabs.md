---
title: Tabs
description: TabView — a self-contained folder-tab container whose pages stay mounted; keyboard chords are scoped to the focus-owning view.
---

# Tabs

`TabView` is a self-contained folder-tab container: a folder-tab strip over a bordered,
one-page-at-a-time content region. Each `Tab` pairs a title with a content `Group`. Dropping one into
any `Group` / [`Window`](/apps/desktop) / [`Dialog`](/components/containers/dialog) is complete — it
draws both the tab strip and the surrounding content frame.

Two behaviours a caller should know:

- **Pages stay mounted.** Every page is built up-front and kept mounted; switching tabs only flips
  which one is visible. A widget's text, scroll position, and focus on an inactive page survive being
  switched away from and back to.
- **`active` is clamped for you.** The `active` signal is caller-owned, so the view self-corrects it
  at render time — it clamps into range and snaps forward off a disabled tab from any writer.

## Usage

```ts
import { TabView, Group, Text, signal } from '@jsvision/ui';
import type { Tab } from '@jsvision/ui';

const page = (line: string): Group => {
  const g = new Group();
  g.add(new Text(line));
  return g;
};

const tabs = signal<Tab[]>([
  { title: '~G~eneral', content: page('General settings') },
  { title: '~D~isplay', content: page('Display options'), closeable: true },
  { title: '~A~dvanced', content: page('Advanced'), disabled: true },
]);
const active = signal(0);

const view = new TabView({ tabs, active, onChange: (i) => console.log('switched to', i) });
view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 10 } };
// loop.focusView(view.strip) — focus the strip, not the group.
```

## Props

`new TabView(options)`.

| Prop       | Type                   | Description                                        |
| ---------- | ---------------------- | -------------------------------------------------- |
| `tabs`     | `Signal<Tab[]>`        | Caller-owned reactive tab list.                    |
| `active`   | `Signal<number>`       | Caller-owned active index; clamped at render time. |
| `onClose`  | `(tab, index) => void` | Fired after a tab is removed via its `×`.          |
| `onChange` | `(index) => void`      | Fired when the effective active index changes.     |

Each **`Tab`** is `{ title, content, disabled?, closeable? }` — `title` carries optional `~X~` hotkey
markup (`'~G~eneral'` marks `Alt+G`), `content` is the page `Group`, `disabled` greys and skips it, and
`closeable` draws a `×` that removes it on click.

## Keyboard & mouse

| Input                      | Result                                                |
| -------------------------- | ----------------------------------------------------- |
| **Ctrl+PageUp / PageDown** | Cycle enabled tabs (scoped to the focus-owning view). |
| **Alt**+letter             | Jump to the `~X~`-marked enabled tab.                 |
| **← / →** (strip focused)  | Cycle tabs.                                           |
| **Click** a tab            | Activate it.                                          |
| **Click** a `×`            | Close that closeable tab (fires `onClose`).           |
| **Click** `◄` / `►`        | Scroll an overflowing strip.                          |

The switch chords and Alt-hotkeys act only on the `TabView` that currently owns focus, so nested or
side-by-side tab views never steal each other's chords.

## Sizing & layout

Place the `TabView` with an absolute `rect` or a flex slot; an inner column keeps the strip stacked
above the content region regardless of how the parent places it. The strip is the focus target — **focus
the exposed `view.strip`**, not the view (a plain `Group` is not itself focusable). Plain Tab /
Shift-Tab move focus into and through the active page's content as usual.

## Best practices

- **Lean on mounted pages.** Because pages persist, you can build each once and let per-page state
  (a half-typed field, a scroll offset) survive tab switches — no save/restore dance.
- **Own the signals.** `tabs` and `active` are yours to read and drive from outside; add, remove,
  reorder, or jump tabs by writing them.
- **Mark hotkeys.** Wrap a letter in `~…~` per tab title for an `Alt`-hotkey; keep them unique (a
  dev-time check warns on a collision).
- **Focus `view.strip`.** Focusing the view itself does nothing.

## Theming

| Role          | Applies to                           |
| ------------- | ------------------------------------ |
| `tabActive`   | The active tab face: white on green  |
| `tabInactive` | An inactive tab face: black on green |
| `tabDisabled` | A disabled tab: darkGray on green    |

The `~hotkey~` letter draws in each role's accent; the surrounding `│ └─┘` frame chrome uses
`staticText`.

## Related

- [List box](/components/containers/list-box) — a single-column list for one page's content.
- [Data grid](/components/table/data-grid) — a table to host inside a tab.
- [Dialog](/components/containers/dialog) — a common host for a tabbed settings panel.
- [API reference](/api/ui/classes/TabView) — the generated `TabView` signature.
