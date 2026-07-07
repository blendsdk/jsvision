# 01 — Requirements & Scope

> **Feature**: jsvision-ui / double-click-activation · Tracks GH [#39](https://github.com/blendsdk/jsvision/issues/39)

## Problem

Core's `MouseEvent` (`packages/core/src/engine/input/events.ts:28-34`) carries **no click-count** —
no `eventFlags`/`meDoubleClick`, no timestamp — so Turbo Vision's double-click-to-activate was
dropped in the port. Consequences:

- **Lists / Grid**: a mouse-down only focuses + selects; **double-click does nothing** (`list-rows.ts:284`, `grid-rows.ts:258`). In the File dialog you must single-click then press Enter / Open.
- **Tree**: *inconsistent* — a single **text** click activates (`tree-rows.ts:261`), which is **not** TV (`toutline.cpp:465` activates only on double-click).

Meanwhile the framework already has **two** ad-hoc local detectors (`editor-mouse.ts:48-62`,
`input.ts:449`) reinventing the same "same cell within 500 ms" logic. #39 proposed a third
(per-widget helper). This plan instead makes click-count a **first-class framework capability**.

## Functional requirements

- **FR-1** — The UI event loop computes a **consecutive click-count** and exposes it on the dispatch
  envelope as `DispatchEvent.clickCount` (a `number`, present only on a mouse-`down`). *(AR-1/AR-3/AR-13)*
- **FR-2** — Detection: a `down` on the **same screen cell** as the previous `down`, within
  **500 ms** (over an injectable loop clock), increments the count; otherwise it resets to 1. *(AR-2/AR-4)*
- **FR-3** — `ListRows` activates the clicked row when `clickCount === 2` (fires `onSelect` + emits
  `command`), cascading to `ListView`/`ListBox`/`FileList`/`DirList`/`ComboBox`/`History`. *(AR-6/AR-7)*
- **FR-4** — `GridRows` (DataGrid) activates the clicked row on `clickCount === 2`. *(AR-6/AR-7)*
- **FR-5** — `TreeRows`: **drop** the single-click text emit (single text click = focus only;
  graph-zone click = toggle expand); **add** text double-click (`clickCount === 2`) → activate. A
  graph-zone double-click toggles (not activates) — the accepted AR-15 deviation. *(AR-5/AR-15)*
- **FR-6** — File dialog: via the existing `openEntry` wiring, double-click a folder enters it and
  double-click a file resolves + closes like OK — **no new dialog code**. *(AR-9)*
- **FR-7** — Single-click behavior is unchanged everywhere (focus + select); Enter/Space activation
  is unchanged; `ComboBox`/`History` single-click-pick is unchanged. *(AR-7/AR-10)*

## Non-functional requirements

- **NFR-1** — **Zero `@jsvision/core` change**; no new theme role. Additive UI surface only:
  `DispatchEvent.clickCount` + `EventLoopOptions.now`. *(AR-1)*
- **NFR-2** — TV fidelity: row activation is TV-derived ⇒ GATE-1 BEFORE decode + GATE-2 AFTER diff,
  citing `tlstview.cpp:271-277` + `toutline.cpp:465-480`. *(NFR-2 carried from CLAUDE.md)*
- **NFR-3** — Every file stays ≤ 500 lines; public/exported symbols carry JSDoc.

## In scope

- The loop-owned click-count + `DispatchEvent.clickCount` + `EventLoopOptions.now` (03-01).
- `ListRows`, `GridRows`, `TreeRows` consumer changes + the tree emit removal (03-02).
- Spec + impl tests at the loop and widget tiers; kitchen-sink blurb/smoke touch-ups.

## Out of scope (explicit)

- **Editor & Input** local multi-click detectors — they keep working; convergence onto
  `ev.clickCount` is a **later** cleanup. *(AR-6)*
- Any `@jsvision/core` change (a core `MouseEvent.clickCount` was rejected — AR-1).
- An `activateOnClick` single-click-activates flag. *(AR-8)*
- Triple-click semantics for the row family (only `=== 2` matters here; the field still carries 3+). *(AR-7)*

## Success criteria (definition of done)

- Double-clicking a `ListRows`/`GridRows` row (same cell, within window) fires `onSelect` + emits
  `command` exactly once; two slow clicks or different cells do **not** activate.
- File dialog: double-click folder → enter; double-click file → resolve + close.
- Tree: double-click **text** → activate; single **text** click → focus only (no emit); single
  **graph-zone** click → still toggles (a graph-zone *double*-click toggles, not activates — accepted
  AR-15 deviation).
- `ComboBox`/`History`: single-click still picks + closes (no regression).
- GATE-2 AFTER-diff recorded for both TV viewers.
- `yarn verify` + `yarn lint` clean; kitchen-sink smoke green.
