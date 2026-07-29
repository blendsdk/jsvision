---
title: Tabs
description: Organize persistent content pages with TabView signals, enabled cycling, accelerators, closeable tabs, and preserved mounted state.
---

# Tabs

`TabView` combines a folder-style tab strip with a framed page region. Every `Tab` pairs a title
with a content `Group`; all pages stay mounted while the active signal decides which one is visible.
That persistence preserves field text, scroll offsets, and other page state across switches.

## Usage

```ts
import { Group, TabView, signal } from '@jsvision/ui';
import type { Tab } from '@jsvision/ui';

const tabs = signal<Tab[]>([
  { title: '~G~eneral', content: new Group() },
  { title: '~O~utput', content: new Group(), closeable: true },
]);
const active = signal(0);
const view = new TabView({ tabs, active });
```

## Live example

<PlayExample id="containers/tabs" title="Persistent tab-page laboratory" blurb="Cycle past a disabled tab, jump by accelerator, close a live page, and observe that every remaining content view stays mounted." />

Ctrl+PageDown skips the disabled middle tab. Alt+O selects the closeable Output page; Alt+C removes
that real tab through `closeTab`.

## Props and public state

`TabView` accepts `TabViewOptions`:

| Prop       | Type                   | Default | Purpose                                     |
| ---------- | ---------------------- | ------- | ------------------------------------------- |
| `tabs`     | `Signal<Tab[]>`        | —       | Caller-owned descriptors.                   |
| `active`   | `Signal<number>`       | —       | Active index, clamped to an enabled tab.    |
| `onClose`  | `(tab, index) => void` | —       | Called after closeable removal.             |
| `onChange` | `(index) => void`      | —       | Called when effective active index changes. |

A `Tab` contains `title`, `content`, optional `disabled`, and optional `closeable`. Public `strip`,
`tabs`, and `active` expose the focus target and live state. `select`, `next`, `prev`, and
`closeTab` provide programmatic control.

## Size and Layout

The internal column keeps the strip above a framed content body. The active page fills the inset
body; inactive pages remain mounted but are omitted from layout. Give the control enough width for
useful labels or allow the strip’s navigation arrows to expose overflow.

Focus `view.strip` for Left/Right tab navigation. Ordinary Tab traversal enters and moves through
the active page rather than changing pages.

## Tab lifecycle and state

Writing `tabs` can add, reorder, disable, or remove pages. Content identity keys the mounted page,
so reordering does not rebuild it. The active index clamps into range and skips disabled entries;
empty or all-disabled sets show a safe empty body.

`closeable` controls whether the strip draws an interactive `×`. The programmatic
`closeTab(index)` method removes any in-range tab, chooses a neighboring active index, and calls
`onClose`, so application shortcuts must enforce their own close policy before calling it.

## Keyboard navigation

Ctrl+PageDown/Up cycles enabled tabs while focus is inside this TabView. Left/Right cycles when the
strip itself holds focus. `~X~` title markup creates an Alt+X accelerator scoped to the focus-owning
tab view, so nested or side-by-side instances do not steal each other’s keys.

```ts
import { TabView } from '@jsvision/ui';

view.select(2);
view.prev();
view.closeTab(view.active());
```

## Best Practices

- Keep page content objects stable to preserve mounted state.
- Own `tabs` and `active` signals when navigation or persistence lives outside the view.
- Mark unique accelerators and avoid relying only on tab position.
- Disable temporarily unavailable pages; remove pages only when their state should be discarded.
- Keep the number of top-level tabs small enough to remain scannable.

## Theming

`tabActive`, `tabInactive`, and `tabDisabled` paint the strip states. The surrounding body frame
uses `staticText`; page content keeps its own roles. Active and inactive faces need clear contrast,
while disabled labels should remain readable but visibly unavailable.

## Related

- [Split View](/components/containers/split-view) — simultaneous resizable panes.
- [Dialog](/components/containers/dialog) — common host for settings tabs.
- [Router](/components/application/router) — stack navigation for full screens.
- [TabView API](/api/ui/classes/TabView) — generated `Tab`, `TabViewOptions`, and methods.
