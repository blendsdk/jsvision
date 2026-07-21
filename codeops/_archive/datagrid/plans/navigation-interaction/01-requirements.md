# Requirements: Navigation & Interaction

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-10](../../requirements/RD-10-navigation-interaction.md)
> **CodeOps Skills Version**: 3.8.0

## Scope

RD-10 consolidates the datagrid's keyboard + mouse input into one remappable dispatch surface and
fills three interaction gaps. It is the input-layer capstone over the behaviors that already ship in
their own RDs (edit RD-02, sort RD-05, filter RD-06, layout RD-07, selection RD-08).

### IN scope (Must-Have)

1. **Consolidated remappable keymap** — a `GridAction` vocabulary, a frozen+exported `DEFAULT_KEYMAP`
   documented as one table, and a `keymap` grid option that merges over the default. Covers navigation
   (`↑↓←→`, `Home`/`End`, `Ctrl+Home`/`Ctrl+End`, `PgUp`/`PgDn`), editing (`F2`, `Enter`, printable),
   selection (`Space`, `Shift+↑↓`), value help (`F4`), and filter open (`Alt+Down`). The four hardcoded
   body handlers are refactored to resolve chord→action and route. (AR-1, AR-4, AR-15)
2. **`Tab`/`Shift-Tab` cell traversal + commit-then-advance** — received from RD-02, which ships
   `Enter`-advance only and defers `Tab` here because `route()` swallows an unbound `Tab`. Wired via a
   loop-keymap chord → command → the grid's `nextCell`/`prevCell`, opted in by the app through a
   `gridKeymap` fragment + `installGridNavigation(loop, grid)`. Wraps at row ends, exits the grid at
   its edge, and while editing commits before advancing. (AR-2, AR-5, AR-6, AR-7)
3. **Synthesized double-click-to-edit** — a body mouse-down with `ev.clickCount===2` over an editable
   cell begins the edit; a single click stays cursor-only; a read-only cell keeps the base row-activate.
   Reuses the framework `clickCount` stamp (500 ms window, injectable loop clock). (AR-3)
4. **Scroll-into-view guarantee** — activating (keyboard or click) a partially/next-page row or an
   off-screen column scrolls it into view; the cursor is never rendered off-screen. Asserted over the
   existing `updateTop`/`autoScrollToCol` machinery. (AR-11)
5. **Kitchen-sink story + showcase cluster** — a `navigation-interaction` story (keyboard + mouse +
   double-click + `Tab`) passing the smoke test, and a datagrid-showcase cluster replacing the RD-10
   placeholder. (AR-16)
6. **Security** — unknown keymap chords/actions are ignored (never thrown); actions route via a
   `switch`, never `eval`; echoed/rendered text keeps the inherited sanitize boundary. (AR-14)

### OUT of scope — Phase B (deferred, confirmed)

- Context menu (right-click / menu key → scoped `MenuPopup`).
- Cell tooltips (hover a truncated cell → overlay; sanitized).
- Global quick-search + match highlight; hotspot cells.
- A configurable `wheelStep` knob (the base ±3 stands). (AR-11)
- `Delete`/`Insert` row-mutation keybindings — not in the `GridAction` union; the imperative
  `insertRow`/`deleteRows`/`duplicateRow` API already exists (RD-08). (AR-13)
- Any core/ui change for a runtime keymap seam — the app-opt-in path needs none. (AR-2)

## Plan-local acceptance

Derived from the RD-10 acceptance criteria; each maps to ST cases in [07](07-testing-strategy.md).

| # | Criterion | RD AC | ST |
|---|-----------|-------|----|
| A1 | Each default binding performs its action (`Ctrl+End`→last cell, `PgDn`→page down, `F4`→value help, …) | AC-1 | ST-7…ST-11 |
| A2 | A `keymap` remap (e.g. `Ctrl+e`→`beginEdit`) takes effect; the original still works unless overridden; an unknown chord is ignored (no throw) | AC-2 | ST-2…ST-5, ST-12 |
| A3 | Two clicks within 500 ms on the same editable cell begin editing; >500 ms or a single click do not (fake clock) | AC-3 | ST-20…ST-22 |
| A4 | A click focuses that cell (**row _and_ column**) and applies the selection gesture; a frozen-panel click maps to the right column | AC-4 | ST-20 (+ inherited RD-07/08 row focus + selection) |
| A5 | The wheel scrolls the body by the (default) step; the scrollbar drags the view | AC-5 | (inherited) — see AR-11 |
| A6 | Activating an off-screen row/column scrolls it fully into view; the cursor is never off-screen | AC-6 | ST-23, ST-24 |
| A7 | A `navigation-interaction` story demonstrates keyboard + mouse + double-click-to-edit and passes smoke | AC-7 | ST-26, ST-27 |
| A8 | Security: unknown keymap chords ignored; rendered text sanitized | AC-8 | ST-4, ST-5, ST-25 |

## Non-goals / invariants

- **Zero RD-02…09 regression** for keyboard gestures and pre-existing frozen-panel mouse behavior. The
  dispatch refactor must keep every existing key gesture byte-identical when no `keymap` option is
  supplied (ST-13). The keymap is a *routing* layer over the same precedence (`beginEdit`-if-editable →
  selection/activate), not a behavior change. **One intended delta (PF-001):** a single click in a
  single-body grid now moves the **column** cursor to the clicked cell (AC-4) — a deliberate change,
  explicitly excluded from the "byte-identical" scope.
- **No new theme role, no new core/ui public surface.** (AR-2, AR-14)
- **grid.ts `< 1300`** (guard re-based from `< 1250`, PF-004). New logic in `keymap.ts` + `navigation.ts`. (AR-8)
