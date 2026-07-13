# Tabs (`TabView`) Implementation Plan

> **Feature**: A self-contained tabbed layout container (`TabView`) for `@jsvision/ui` — folder-tab strip + bordered content region, one page visible at a time.
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: jsvision-ui/RD-17
> **CodeOps Skills Version**: 3.2.0

## Overview

`TabView` packs several titled pages into one framed region, one visible at a time, with a
clickable / keyboard-navigable folder-tab strip across the top. It is the idiomatic way to organise
multi-panel content (a parameters dialog with sections, a multi-page form, grouped settings) inside a
single `Window`/`Dialog` — without opening several desktop windows.

**No TV counterpart (GATE-1, AR-172).** A whole-tree search of `magiblot/tvision` proved Turbo Vision
has no tab/notebook/tabstrip class; it organised multi-panel content as separate `TWindow`s on the
desktop. RD-17 is therefore a **documented new component** under the extension latitude of the
NON-NEGOTIABLE TV-fidelity directive. Every *piece* that does have a TV precedent is still grounded in
an already-decoded, already-shipped facility: box-drawing chrome (the frame glyph set's shapes +
freshly-decoded tab-junction tees), `~X~` tilde hotkeys (`parseTilde`/`tildeSegments`), disabled
greying (the Button/Cluster convention), and active/inactive colour (the `cpAppColor` chain, pinned at
plan GATE-1). The *shapes and colours* stay TV-faithful even though the *component* is new.

Architecturally `TabView extends Group` (the shipped container idiom, AR-169: `ListView`/`Tree`/
`DataGrid` all `extends Group`), composing a focusable strip renderer (`tab-strip.ts`, a `View`) and a
bordered content region that shows the active page via RD-01 `Show`. `tabs: Signal<Tab[]>` and
`active: Signal<number>` are caller-owned reactive state; the strip and content react to both.

## Document Index

| #   | Document                                          | Description                                     |
| --- | ------------------------------------------------- | ----------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Zero-Ambiguity Gate decisions (audit trail)     |
| 00  | [Index](00-index.md)                              | This document — overview and navigation         |
| 01  | [Requirements](01-requirements.md)                | Feature requirements and scope                  |
| 02  | [Current State](02-current-state.md)              | Analysis of the code RD-17 builds on            |
| 03-01 | [TabView container](03-01-tab-view.md)          | `TabView` `Group` — data model, nav, clamp      |
| 03-02 | [Tab-strip renderer](03-02-tab-strip.md)        | Folder-tab draw, glyphs, hit-test, overflow     |
| 03-03 | [Theme roles & packaging](03-03-theme-packaging.md) | Additive `tab*` roles, subsystem, story/demo |
| 07  | [Testing Strategy](07-testing-strategy.md)        | ST-cases and verification                       |
| 99  | [Execution Plan](99-execution-plan.md)            | Phases, sessions, and task checklist            |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { TabView, type Tab } from '@jsvision/ui';

const tabs = signal<Tab[]>([
  { title: '~G~eneral', content: generalPage },
  { title: '~D~isplay', content: displayPage, closeable: true },
  { title: '~A~dvanced', content: advancedPage, disabled: true },
]);
const active = signal(0);

const view = new TabView({
  tabs,
  active,
  onClose: (tab) => log(`closed ${tab.title}`),
  onChange: (i) => log(`now on tab ${i}`),
});

// Programmatic drive (Should-Have, PA-1):
view.next();       // → next enabled tab (wrap)
view.select(2);    // clamp-checked; skips if disabled per snap rules
```

Ctrl+PageUp/PageDown cycle enabled tabs from anywhere inside the view; `←`/`→` cycle when the strip
holds focus; Alt+letter jumps to a `~X~` hotkey; a click activates / closes (`×`) / scrolls
(`◄`/`►`). Plain Tab/Shift+Tab traverse the *active page's* content, never switching tabs.

### Key Decisions

| Decision | Outcome | AR/PA Ref |
| -------- | ------- | --------- |
| Component basis | `TabView extends Group` (self-contained; owns strip + frame) | AR-172/174 |
| Content model | Eager pages, one visible via a reactive `state.visible` binding keyed on `active` (not `Show` — PF-001) | AR-175 |
| Data / active binding | `tabs: Signal<Tab[]>` + `active: Signal<number>` (clamped) | AR-177/178 |
| Global switch chord | **Ctrl+PageUp/PageDown** (reliable); Ctrl+Tab best-effort | AR-179/183 |
| Glyphs | Local `src/tabs/` glyph set (line/corner + added tees `┬┴├┤`) | AR-184 / PA-2 |
| Theme roles | 3: `tabActive`/`tabInactive`/`tabDisabled` (`cpAppColor`, GATE-1) | AR-180 / PA-3 |
| File split | `tab-view.ts` + `tab-strip.ts` + `index.ts` | AR-181 / PA-4 |
| Should-Haves | `select/next/prev` + snap-first-enabled + `onChange` — **all included** | PA-1 |

## Related Files

**New (`packages/ui/src/tabs/`):** `tab-view.ts`, `tab-strip.ts`, `index.ts`.
**Edited (additive):** `packages/core/src/engine/color/theme.ts` (+3 `tab*` roles), `packages/ui/src/index.ts` (re-exports).
**New tests (`packages/ui/test/`):** `tabs.spec.test.ts`, `tabs.impl.test.ts`, `tab-strip.spec.test.ts`, `tab-strip.impl.test.ts`, `tabs.packaging.spec.test.ts`, `tabs-theme.spec.test.ts`.
**New examples:** `packages/examples/tabs-demo/main.ts` (`demo:tabs`), `packages/examples/kitchen-sink/stories/tabs.story.ts` (+ `stories/index.ts` line), `packages/examples/test/tabs-demo.e2e.test.ts`.
