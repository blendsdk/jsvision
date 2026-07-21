# Navigation & Interaction — Implementation Plan

> **Feature**: The consolidated input surface for `@jsvision/datagrid` — one remappable
> keyboard **keymap → `GridAction`** dispatch (replacing four hardcoded chord-handlers), `Tab`/
> `Shift-Tab` cell traversal with commit-then-advance, synthesized double-click-to-edit, and the
> scroll-into-view guarantee. Mouse (click/header/funnel/wheel/scrollbar/drag) already shipped
> across RD-05/07/08 — this RD adds only double-click and unifies dispatch.
> **Status**: Planning Complete
> **Created**: 2026-07-17
> **Implements**: datagrid/RD-10
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-10 turns the grid's **scattered, hardcoded input handling into one consolidated, remappable
surface**. Today every key gesture is a hardcoded chord check spread across four private methods in
`editable-grid-rows.ts` (`handleColKey`, `tryBeginEdit`, `handleSelectionKey`, `handleOpenFilter`),
nothing is remappable, and three genuine gaps remain: `Tab`/`Shift-Tab` cell traversal, double-click-
to-edit, and an asserted scroll-into-view guarantee.

The headline finding of the code recon: **the framework already ships the machinery the RD assumed we
would build.** `@jsvision/ui` has a per-widget keymap→action pattern (`ui/src/editor/keymap.ts`) that
is the exact analogue of RD-10's keymap→`GridAction`; the event loop already synthesizes `ev.clickCount`
(500 ms window, injectable clock); and `route()` swallows an unbound `Tab` for focus-traversal before
any view sees it, with the loop keymap as the only documented escape hatch. So the plan **wires the grid
into existing framework seams** rather than reinventing them:

- A new pure `keymap.ts` (mirroring `editor/keymap.ts`): the `GridAction` union, a frozen+exported
  `DEFAULT_KEYMAP`, and `resolveGridAction(ev, merged)` (AR-1). The body's `onEvent` resolves a chord to
  a `GridAction` and routes it — including the base-owned `↑`/`↓`/`PgUp`/`PgDn`, which delegate to the
  base's own `protected` helpers so the whole nav table is remappable with zero re-implementation (AR-4).
- `Tab`/`Shift-Tab` become a bound loop-keymap chord → command → the grid's `nextCell`/`prevCell`,
  wired by an app-side `installGridNavigation(loop, grid)` helper + an exported `gridKeymap` fragment;
  no core/ui change, and `Tab` still exits the grid to the next widget at its edge (AR-2, AR-5, AR-6).
  While editing, `Tab` commits then advances by cell (AR-7).
- Double-click-to-edit reuses `ev.clickCount===2` — no bespoke timer (AR-3).

The plan is phased **model-first** (mirroring RD-05/06/07/08/09): the pure keymap model, then the body-
dispatch refactor (the highest-risk change — it must preserve every RD-02…09 gesture), then `Tab`
traversal + the helper, then double-click + scroll-into-view, then the story/showcase/security/barrel.
Because grid.ts sits near its hard line-count guard (re-based `< 1250` → `< 1300` for this RD's new public
delegators — PF-004), all new logic lands in **two new modules** (`keymap.ts`, `navigation.ts`); grid.ts
gets only thin delegators (AR-8).

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| 00  | [Index](00-index.md) | This document — overview and navigation |
| 01  | [Requirements](01-requirements.md) | Scope over RD-10 + plan-local acceptance |
| 02  | [Current State](02-current-state.md) | The exact seams RD-10 refactors (grounded, file:line) |
| 03-01 | [Keymap Model](03-01-keymap-model.md) | Pure `keymap.ts` — `GridAction`, `DEFAULT_KEYMAP`, resolver, merge/validate |
| 03-02 | [Body Dispatch](03-02-body-dispatch.md) | Refactor `EditableGridRows.onEvent` to chord→action routing + nav delegation |
| 03-03 | [Tab Traversal](03-03-tab-traversal.md) | `nextCell`/`prevCell` + `navigation.ts` + `gridKeymap` + `installGridNavigation` + commit-advance |
| 03-04 | [Mouse & Double-click](03-04-mouse-doubleclick.md) | `ev.clickCount===2` → edit + the scroll-into-view guarantee |
| 07  | [Testing Strategy](07-testing-strategy.md) | ST-cases (spec-first) + verification |
| 99  | [Execution Plan](99-execution-plan.md) | Phases, tasks, checklist |

## Quick Reference

### Usage Examples

```ts
import { createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import {
  column, fromRows, EditableDataGrid,
  DEFAULT_KEYMAP, gridKeymap, installGridNavigation,
} from '@jsvision/datagrid';

interface Row { id: number; name: string; qty: number; }
const rows = signal<Row[]>([ /* … */ ]);

// A grid with a remapped chord: Ctrl+E also begins editing (F2 still works — AC-2).
const grid = new EditableDataGrid<Row>({
  columns: [ /* … */ ],
  source: fromRows(rows, { rowKey: (r) => r.id }),
  keymap: { 'ctrl+e': 'beginEdit' },   // merges over DEFAULT_KEYMAP; unknown chords/actions ignored
});

// --- Tab cell-traversal: the app opts in at loop construction, then registers the handlers ---
const caps = resolveCapabilities().profile;
const loop = createEventLoop({ width: 80, height: 24 }, { caps, keymap: gridKeymap });
loop.mount(root);
loop.focusView(grid.rows);
const uninstall = installGridNavigation(loop, grid);   // Tab → next cell; Shift-Tab → prev cell
//   at the grid's last/first cell Tab exits to the next/previous widget (loop.focusNext/Prev)
//   while editing, Tab commits then advances by cell

grid.nextCell();   // programmatic cell advance (wraps at row ends; 'exit' at the grid edge)
grid.prevCell();
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Keymap architecture | full per-grid `GridAction` dispatch, mirror `ui/src/editor/keymap.ts` | AR-1 |
| Tab wiring | app opt-in — `gridKeymap` fragment + `installGridNavigation`; **no framework change** | AR-2 |
| Double-click | reuse `ev.clickCount===2` (framework 500 ms, injectable clock); no bespoke timer | AR-3 |
| Nav coverage | full — `↑`/`↓`/`PgUp`/`PgDn` in the keymap, delegating to base `protected` helpers | AR-4 |
| Tab order / edge | wrap at row ends; **exit** the grid at its final/first cell via `focusNext/Prev` | AR-5, AR-6 |
| Tab while editing | commit-then-advance by cell (`EditController.commitEdit()` seam) | AR-7 |
| Module layout | new `keymap.ts` + `navigation.ts`; grid.ts thin delegators, guard re-based `< 1300` (PF-004) | AR-8 |
| `GridAction` union | RD's union + `openFilter` (Alt+Down); `commit`/`cancel` stay editor-scoped | AR-15 |
| Showcase | `navigation-interaction` kitchen-sink story + showcase cluster (replaces the RD-10 placeholder) | AR-16 |

## Related Files

**New:** `packages/datagrid/src/keymap.ts`, `packages/datagrid/src/navigation.ts`; tests
`keymap.spec/impl.test.ts`, `navigation.spec.test.ts`, `body-dispatch.spec.test.ts`,
`double-click.spec.test.ts`; a kitchen-sink `navigation-interaction.story.ts`; a datagrid-showcase
`navigation-interaction/` cluster.

**Modified:** `editable-grid-rows.ts` (the chord→action dispatch refactor + single-click column focus +
double-click intercept + `commitEdit` wiring), `editing.ts` (the public `commitEdit()` seam on
`EditController`), `grid.ts` (the `keymap` option pass-through + thin `nextCell`/`prevCell`/`isBodyFocused`
delegators), `grid-panels.ts` (thread the merged keymap + `mouseColumns: true` for the single/center body),
`navigation.ts`'s `installGridNavigation` (focus-restore on `'moved'`), `index.ts` (barrel), the two
line-count guard tests `grid-footer.impl.test.ts` + `grid-selection.impl.test.ts` (re-base `< 1250` →
`< 1300`, PF-004), and the datagrid-showcase `placeholders.ts` + count oracles.
