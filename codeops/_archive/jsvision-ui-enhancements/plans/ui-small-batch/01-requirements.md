# Requirements: UI Small Batch

> **Parent**: [Index](00-index.md)
> **Source**: GitHub issues [#17](https://github.com/blendsdk/jsvision/issues/17), [#6](https://github.com/blendsdk/jsvision/issues/6), [#11](https://github.com/blendsdk/jsvision/issues/11)
> **CodeOps Skills Version**: 3.3.2

The three issues are the requirements source; each issue body carries the reference design, substrate
analysis, and acceptance criteria. This document restates the scope and the decisions that gate the
plan (see [AR](00-ambiguity-register.md)).

## R1 — Tree markers (GH #17)

**Goal.** Make a collapsed node visually unmistakable from an expanded one. Today the difference is one
glyph in the last column of the end graphic (`+` vs. `─`).

**IN scope**
- Add `markerStyle?: 'tv' | 'brackets' | 'triangle'` to `TreeOptions`, default `'tv'` (AR-2, AR-3).
- `'brackets'` → `[+]`/`[-]` (pure ASCII, widens the end graphic 3→5 cells, AR-4).
- `'triangle'` → `▸` collapsed / `▾` expanded (1 cell, no geometry change); falls back to `'brackets'`
  under a no-Unicode caps profile (AR-5).
- Leaf nodes draw a blank marker under `brackets`/`triangle`; `'tv'` is unchanged (AR-6).
- Mouse graph-zone toggle keeps working (auto-adapts via the style-aware `graphWidth()`).

**OUT of scope**
- Changing the default look for existing Tree users (default remains `'tv'`).
- Per-node marker overrides; animated disclosure.

## R2 — Duplicate-accelerator warning (GH #6)

**Goal.** Detect and dev-warn when two items under the **same scope** claim the same `~X~` accelerator
char (only the first is reachable today, silently).

**IN scope**
- A pure, view-free `findDuplicateAccelerators(chars) → DuplicateAccelerator[]`, case-insensitive (AR-9).
- An additive optional `View.accelerators(): readonly string[]` seam (default `[]`), overridden by the
  accelerator-bearing views (AR-10).
- Auto (dev-gated) checking at each scope root **and** the exported pure validator (AR-9).
- Scopes covered (AR-7): **each submenu** (build-time in `menu/builders.ts`) · **menu bar titles**
  (build-time in `menu/menubar.ts`, where `menuBar()` lives) · **each TabView strip** (data-level check
  over `tabs()` on `TabView`; strip tabs only, no descent into page contents) · **each Dialog focus
  scope** (checked by a subtree walk on `Dialog` mount).
- Emit via a promoted shared `devWarn(scope, message)` → `[jsvision/ui <scope>]` prefix; silent under
  `NODE_ENV=production`; no other `console.*` in `src` (AR-8, AR-11).
- A disabled `Cluster` item still counts (it still registers its hotkey); menu separators are skipped;
  menu items have no disabled flag (AR-12). Cross-scope reuse is never a conflict (AR-13).

**OUT of scope**
- **StatusLine** chord-collision (explicit `matchesChord` chords, a different mechanism) — fast-follow.
- A hard-throw strict mode (dev-warn only in v1).
- Auto-renumbering / auto-resolving a conflict (we only warn).

## R3 — Switch / Toggle (GH #11)

**Goal.** A modern on/off control (sliding knob) bound to a `Signal<boolean>`, as an alternative to the
checkbox for a single boolean setting.

**IN scope**
- `Switch extends View` (the `Slider` idiom, AR-14); `new Switch({ value, label?, onLabel?, offLabel?, disabled? })` (AR-15).
- `Space`/`Enter`/click toggles; optional `Alt`+hotkey when the label carries `~X~`.
- On = knob-right on a green track (`buttonFocused`/`button`); Off = knob-left on a dim track
  (`clusterDisabled`/`staticText`); focused = accented brackets. **No new core theme role** (AR-16).
- `●` knob with an ASCII `o` fallback via `ctx.caps`; optional trailing `On`/`Off` text (AR-17).
- Kitchen-sink `controls/switch` story + headless smoke test (AR-19).

**OUT of scope**
- A knob-slide animation (AR-18); a range/multi-state variant; a new theme role.

## Cross-cutting

- **Additive-only.** No `@jsvision/core` API change; no breaking `@jsvision/ui` change.
- **Docs.** Every new public/exported symbol carries JSDoc with an `@example` (enforced by
  `check-jsdoc.mjs`); no CodeOps IDs or TV/C++ provenance in shipped code.
- **Verify.** `yarn verify` per task — it already runs `yarn lint` then `turbo run typecheck build test
  check:docs`, so lint + `@example`/provenance checks run on every task (AR-20).
