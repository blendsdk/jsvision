# Requirements & Scope — Flexible Chrome Bars

> **Feature**: jsvision-ui / flexible-chrome-bars · **Implements**: — (enhancement, no RD)

## Problem

The app-shell `StatusLine` and `MenuBar` each hand-roll a left-packed column layout
(`itemBoxes()` and `layoutTitles()` respectively). Two consequences:

1. There is **no way to right-align** content or insert flexible gaps on either bar — a common
   need (an `Alt-X Exit` on the left, a clock or progress readout pinned to the right).
2. The status line can host **only static command spans** — no embedded widget (a `ProgressBar`,
   a live `Spinner`), and no dynamic text.

The user wants a status bar like `‹Exit› ———fill——— ‹progress› ‹clock›`, and the same right-align +
spacer capability on the menu bar.

## In scope

- **F-1** A **shared bar-layout foundation**: both bars pack their segments via the RD-02 layout
  engine's 1-D flex solve instead of the two hand-rolled loops (AR-6).
- **F-2** **StatusLine as a general child-view container** (AR-2, AR-4): items are views laid out in
  a row — interactive command items (`StatusItemView`) **and** passive segments (`spacer()`,
  `ProgressBar`, `Spinner`, `Text`, any 1-row view). The caller places fitting widgets (AR-12).
- **F-3** **Right-alignment + flexible gaps** on the status line via the existing `spacer()` (AR-5).
- **F-4** **Dynamic status text** (AR-3): `statusItem` accepts accessor text `string | (() => string)`,
  and reactive views embed directly; both repaint on signal change with no manual redraw.
- **F-5** **Command-less passive status items** (AR-9): `statusItem(text, command?, key?)`.
- **F-6** **MenuBar flexible titles** (AR-1, AR-8): right-align + `menuSpacer()` for menu titles;
  submenu popups anchor under the moved title (controller reads the flex-computed x).
- **F-7** **Backward compatibility** (AR-10): every existing call site and every immutable oracle
  (status + menu + packaging) keeps compiling and passing **unmodified**.
- **F-8** **Demo + tooling** (AR-14): a live clock + `ProgressBar` in a new
  `examples/chrome-bars-demo/main.ts` (preflight PF-001 decision B — the plan's original
  `playground/main.ts` exists only in Ink and `demo:playground` is taken), a `demo:chrome-bars`
  script, and `"chrome-bars-demo"` added to `packages/examples/tsconfig.json` `include`.
- **F-9** **Kitchen-sink** (AR-15): a "rich status bar" story + smoke test.

## Out of scope

- **Embedded passive widgets in the *menu* bar** (clock/indicator) — deferred to a follow-up (AR-1).
- **A `ToolBar` component** (interactive controls at the top) — a possible separate follow-up (AR-18).
- **Interactive widget embedding in the status line** (Button/Input) — unsupported (AR-12).
- **Any change to the popup/menu-navigation state machine** beyond threading the bar width for
  anchoring (AR-1). Popup geometry/drawing is untouched.

## Constraints

- **Spec-first / immutable oracles** — the existing status oracles (`app-shell.status.spec`:
  ST-19, RD-10 ST-01/02/03), menu oracles (`app-shell.menu.spec/impl`: ST-16/17/18 +
  `layoutTitles`/`titleIndexAt`/popup impl oracles), and the packaging oracle
  (`app-shell.packaging.spec`) must all stay green **without modification** (see 02 + 07).
- **TV fidelity + shipped docs** (AR-13) — faithful command-item/menu-title rendering; no TV/C++
  provenance and no CodeOps IDs in shipped JSDoc/comments (`check-jsdoc.mjs` gates).
- **File size** — target 200–500 lines/file; split before ~700 (the CLAUDE.md convention).
- **Zero runtime deps; ESM NodeNext** — `.js` specifiers on `.ts` sources.

## Success criteria (definition of done)

1. All new spec oracles ST-01…ST-10 (07-testing-strategy) pass.
2. All preserved oracles pass unmodified (status, menu, packaging, app-shell suites).
3. `statusLine`/`statusItem`/`menuBar`/`menuSpacer` public surface documented with `@example`;
   `check-jsdoc.mjs` green.
4. The kitchen-sink "rich status bar" story renders in the smoke test.
5. `packages/examples/chrome-bars-demo/main.ts` shows `<Exit><spacer fill><progress><clock>` and is now
   in the examples typecheck scope (via `"chrome-bars-demo"` in the tsconfig `include`).
6. `yarn verify` is green.
