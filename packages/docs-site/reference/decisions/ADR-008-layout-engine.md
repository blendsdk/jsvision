# ADR-008: Layout engine for the UI layer — build cell-native vs adopt Yoga/Taffy

> **Date**: 2026-06-28
> **Status**: ✅ Accepted — 2026-06-28
> **Source**: Design discussion, settled when the `@jsvision/ui` scaffold landed

## Context

The foundation (`@jsvision/core`) does **no layout** — widgets/apps address cells
by `(x, y)` and hand-draw into a `ScreenBuffer` (see the keyboard/mouse playground
demo). The upcoming UI/widget layer needs _some_ layout system: nesting, resizing,
and dynamic content make absolute coordinates untenable.

The question on the table: **do we adopt a layout library (Yoga, or something else)
for a flexbox-ish / flex-grid-ish engine, or build our own?** This was explicitly
discussed _setting aside_ the native-compilation concern — i.e., on technical merit,
not packaging.

## The decisive technical factor: cells are integers, layout engines think in floats

Yoga and essentially every web layout engine compute in **floating-point pixels**.
On a screen a sub-pixel error is invisible; in a terminal **every box must land on an
integer column/row**. Rounding each flex child independently makes the children's
widths not sum to the container width → **1-cell gaps or overlaps at flex
boundaries**. Ink (which uses Yoga) exhibits exactly this class of off-by-one quirk.

The correct fix is **integer apportionment**: distribute leftover cells one at a time
to the children with the largest fractional remainders (largest-remainder / Hamilton
method) so a row/column fills _exactly_ to the edge, every time. A cell-native engine
does this by construction. Yoga can be coerced toward integers (`pointScaleFactor=1`),
but that rounds a float result after the fact rather than apportioning — papering over
a model mismatch. **This argument holds even if Yoga shipped as one clean binary.**

## Options Considered

| Option                          | Model                           | Runtime                    | Grid?           | Cell-integer fit                | Notes                                                                      |
| ------------------------------- | ------------------------------- | -------------------------- | --------------- | ------------------------------- | -------------------------------------------------------------------------- |
| **Build cell-native (pure TS)** | flex subset (+ grid/dock later) | zero dep                   | yes, if added   | **native — apportion in cells** | ~few hundred LOC; tunable; paradigm-fit; we maintain it                    |
| **Yoga** (`yoga-layout`)        | flexbox only                    | WASM (no node-gyp anymore) | ❌ no grid      | float→round (gaps)              | Battle-tested (React Native, Ink); black box; can't tune rounding          |
| **Taffy**                       | flexbox **+ CSS grid**          | Rust→WASM                  | ✅ yes          | float→round                     | Modern, maintained (Bevy/Dioxus); strongest "buy" option if grid is needed |
| **kiwi.js** (Cassowary)         | linear constraints              | pure JS                    | via constraints | float→round                     | Very expressive (Ratatui-style); different mental model; heavier API       |

### What reference TUI frameworks actually chose (no consensus on flexbox)

- **Ink** (JS) → Yoga / flexbox. Proves it is _viable_, cell-rounding warts and all.
- **Textual** (Python) → **its own engine**, CSS-like with grid + dock + fractional
  `fr` units. Widely loved; deliberately not flexbox-via-a-C-lib.
- **Ratatui** (Rust) → a **constraint solver** (Cassowary), not flexbox.
- **Turbo Vision** (the SDK's namesake) → **rect + edge-anchoring** (`growMode`); no
  flow layout at all.

The field splits into _borrow-Yoga_ (Ink) vs _build-for-the-medium_ (Textual,
Ratatui) — and the most-praised modern TUIs are in the build camp.

### flexbox-ish vs flexgrid-ish are different decisions

- **Flexbox** (1-D row/column, grow/shrink/basis, justify/align) covers toolbars,
  lists, side-by-side panels, responsive stacking — ~80% of TUI layout.
- **Grid / flexgrid** (2-D tracks: fixed / `fr` / auto) is what dashboards, tables,
  and form layouts want. **Yoga does not do grid; Taffy does.** Grid is actually
  _easier_ to make integer-correct than flexbox (same largest-remainder trick). If
  grid is a real requirement, that alone rules Yoga out.
- A strong toolkit usually offers **flex + grid + dock/anchor** (Textual's model),
  because different screens want different tools — "a layout library" ≠ "just flexbox".

## Decision (Accepted)

**Build a small cell-native layout engine in pure TypeScript** — not Yoga/Taffy.
Confirmed 2026-06-28. The build-vs-buy call rests on two independent arguments that both
point the same way: integer-cell correctness _by construction_ (apportionment, not
float-rounding), and keeping the zero-dep, pure-JS, auditable identity that `check:deps`
enforces (Yoga is WASM, Taffy is Rust→WASM).

Confirmed scope and shape:

1. **Flex first, grid later.** Phase 1 is 1-D flex — `row`/`col` with grow/shrink/basis,
   justify/align, gap/pad. That covers the app shell (menubar/desktop/statusline as a
   flex column) and ~80% of widgets (scrollbars, dialog forms). 2-D **grid**
   (fixed/`fr`/auto tracks, for tables + dashboards) is **Tier 2**, added behind the same
   interface. Edge-docking (TV `growMode`) is expressible via flex justify/align — no
   separate dock primitive until a real need appears.
2. **Lives as a module inside `@jsvision/ui`** (`src/layout/`), not a separate package,
   behind the pure-function seam below. Extract to a standalone `@jsvision/layout`
   package later only if independent reuse/versioning is ever actually needed.

Two guardrails keep "build" low-risk:

1. **Clean seam** — layout is a pure function `(box tree, {cols, rows}) → integer rects`;
   the renderer just paints into those rects. Small, golden-testable surface (the
   project's sweet spot), zero new deps.
2. **Low lock-in** — start flex-only; if a future need outgrows it, swap in **Taffy**
   (flex + grid) behind the same interface without touching widgets.

**Flip to "buy" (Taffy) only if** full CSS-spec fidelity is ever needed _fast_ and we
don't want to own/maintain the engine.

## Consequences

### Positive

- Integer-cell correctness by construction (no Yoga-style boundary gaps).
- Keeps the zero-dep, auditable, pure-TS identity; blends flex + grid + TV anchoring.
- A small, testable module behind a stable rect interface.

### Negative / Risks

- We build and maintain it; not full CSS-flexbox spec fidelity (wrap, min/max,
  aspect-ratio, baseline align take real effort).
- Risk of scope creep toward "reimplement CSS" — mitigated by shipping a deliberate
  _subset_ and a clean swap-to-Taffy escape hatch.

## Resolved questions & implementation notes

- **Model** — flex subset first (`row`/`col`, grow/shrink/basis, justify/align, gap/pad);
  grid is Tier 2; no standalone dock primitive initially. _(Resolved 2026-06-28.)_
- **Location** — a module inside `@jsvision/ui` (`src/layout/`), consuming `@jsvision/core`
  geometry; extractable to `@jsvision/layout` later. _(Resolved 2026-06-28.)_
- **Full flexbox spec fidelity** (wrap, min/max, aspect-ratio, baseline) is **not** a
  goal; ship a deliberate subset. Revisit Taffy only if that ever changes.
- **First build step (de-risking spike)** — the integer flex-distribution (apportionment)
  core: ~40 LOC + a golden test asserting a row of `fr` children fills _exactly_ to the
  container edge with no gap/overlap. Validates the cell-native premise before building
  out the full module.
- **API flavour** (CSS-flexbox-subset vs Textual-style `fr`/`auto` sizing) is an
  implementation detail for `make_requirements`/`make_plan`, not this ADR.
