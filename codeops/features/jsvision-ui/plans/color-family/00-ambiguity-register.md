# Ambiguity Register: Color family (`ColorSwatch` + `ColorPicker`)

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Gate status**: ✅ GATE PASSED
> **Created**: 2026-07-04
> **CodeOps Skills Version**: 3.2.0

The Zero-Ambiguity Gate for the RD-21 plan. RD-21 was authored (`add_requirement`, 2026-07-03) and
**preflighted PASSED** (`00-preflight-report-RD-21.md`, 2026-07-04 — 6 findings, all resolved Option A):
PF-001 the cursor-vs-`value` state model (→ AC-15), PF-002 the additive core re-exports, PF-003
commit-on-release, PF-004 the drag out-of-bounds split, PF-005 the `nameFor?` accessor, PF-006 the
framing deviation. Those requirement-level ambiguities are **already resolved in the RD** and are
recorded below (PA-9…PA-13) for traceability.

This register resolves the residual **plan-time GATE-1 decisions the RD explicitly deferred**: the
`0-or-1` `colorMarker` role (AR-217 "pinned at plan GATE-1"), the additive re-export set (PF-002
"pinned at plan GATE-1"), the near-black marker predicate (the generic extension of TV's exact `c==0`
rule), and the `src/color/` file split ("exact file split confirmed at plan time"). All four were put
to the user via a single decision prompt on 2026-07-04 and **accepted as recommended**.

## Gate summary

| # | Status | Category | Decision | Source |
|---|--------|----------|----------|--------|
| PA-1 | ✅ Resolved | Design / theme | **One** additive `colorMarker` core role = `0x70` (black-on-lightGray) | User (accepted rec) |
| PA-2 | ✅ Resolved | Behavior / fidelity extension | Forced-contrast marker fires on **near-black** cells (via `toRgb` luminance) | User (accepted rec) |
| PA-3 | ✅ Resolved | Dependency / API surface | Additive core re-exports = **`ANSI16_ORDER` + `toRgb`** only (`HEX_RE` stays private) | User (accepted rec) |
| PA-4 | ✅ Resolved | Structure | **4 files**: `color-grid.ts` (pure) + `color-swatch.ts` + `color-picker.ts` + `index.ts` | User (accepted rec) |
| PA-5 | ✅ Resolved | Fidelity (GATE-1) | Cell block glyph = **`█`** (U+2588 full block), `fg = cellColor` / `bg = black` | Source (`tvtext1.cpp:88`, `colorsel.cpp:131`) |
| PA-6 | ✅ Resolved | Fidelity (GATE-1) | Selection marker glyph = **`◘`** (U+25D8, the CP437 `8` decode) at cell centre | Source (`colorsel.cpp:132`) |
| PA-7 | ✅ Resolved | Fidelity (GATE-1) | Cell width = **3 columns**; grid width = `columns * 3` | Source (`colorsel.cpp:131`) |
| PA-8 | ✅ Resolved | Fidelity (GATE-1) | Wrap-around nav: `←→` ±1 with wrap; `↑↓` ±`columns` with the edge-wrap math | Source (`colorsel.cpp:179-217`) |
| PA-9 | ✅ Resolved | State model | Internal **cursor index** is nav+marker SoT; `value: Signal<Color>` a derived two-way bind; init `indexOf(value)` else `0` | RD PF-001 / AC-15 |
| PA-10 | ✅ Resolved | Edge / fidelity | Drag **outside grid** ⇒ revert to pre-drag cell (faithful); **inside, past last cell of a partial row** ⇒ clamp to `len-1` (extension) | RD PF-004 / AC-5 |
| PA-11 | ✅ Resolved | Behavior | `ColorPicker` commits **on mouse release** over a cell (drag previews; down alone does not close) | RD PF-003 / AC-7 |
| PA-12 | ✅ Resolved | Fidelity deviation | `ColorSwatch` **omits** TV's `ofFramed`; framing delegated to the host popup/`Window` | RD PF-006 |
| PA-13 | ✅ Resolved | Scope (Should-Have) | Optional **`nameFor?: (c: Color) => string`** accessor (no richer cell type; `colors: Color[]` intact) | RD PF-005 |
| PA-14 | ✅ Resolved | Showcase | Kitchen-sink ids `color/color-swatch` + `color/color-picker` (category **`Color`**); `demo:color` | Dominant (house pattern) |
| PA-15 | ✅ Resolved | Verify command | `yarn verify` (= `turbo run typecheck build test`) | Confirmed (CLAUDE.md) |

---

## PA-1 — The `colorMarker` theme role (0 or 1) 🟠

**Question:** TV forces the `◘` marker on a black cell to attribute `0x70` (black-on-lightGray) so it
stays visible (`colorsel.cpp:132-137`). AR-217 assigns the plan a `0-or-1` role choice at GATE-1. Add a
dedicated core role, or hardcode the forced-contrast style?

**Decision:** **Option A — add one additive `@jsvision/core` role `colorMarker` = `0x70`** (`fg =
PALETTE.black`, `bg = PALETTE.lightGray`). Used **only** for the forced-contrast (near-black) marker;
a normal cell's marker uses the cell's own `Color`. This is the house pattern (every TV-decoded byte
becomes a themeable role — `calendarCursor 0xF0`, `tableHeader 0x3F`, …) and is exactly the "one role
if the decode needs it" AR-217 anticipated. Additive/non-breaking; `check:deps` unaffected.

**Rejected:** hardcoding the byte inline (0 roles) — smaller surface, but the decoded byte would not be
themeable and it breaks the convention every prior subsystem follows.

---

## PA-2 — Near-black predicate for the forced-contrast marker 🟠

**Question:** TV's rule fires on the exact black palette index (`c == 0`). For a **generic `Color[]`**
(including truecolor) the widget needs a predicate to decide when the `◘`'s knocked-out circle (which
shows the black cell background) would be invisible.

**Decision:** **Force-contrast when the cell resolves near-black** — `toRgb(color)` is `null`
(`'default'`) **or** its luminance is below a small threshold (e.g. `0.2126 r + 0.7152 g + 0.0722 b`
under ~24/255). Subsumes the exact TV `c == 0` case and safely covers any very-dark truecolor cell. A
documented **generic extension** of the `c == 0` decode (recorded in the code JSDoc, GATE-2). The
predicate lives in the pure `color-grid.ts` so it is unit-testable.

**Rejected:** exact `#000000`/`black` only — strictly faithful to the index-0 case but a `#010101`
truecolor cell would render an invisible marker (a generic-palette hole TV never hits).

---

## PA-3 — Additive core re-export set 🟠

**Question:** PF-002 established that `ANSI16_ORDER`, `toRgb`, and `HEX_RE` are **not** on the public
`@jsvision/core` entry today, and `@jsvision/ui` imports core by name only. Which additive re-exports
does the plan add? (Pinned at GATE-1.)

**Decision:** Re-export **`ANSI16_ORDER`** (`palette.ts:43`, the default swatch palette) and
**`toRgb`** (`color.ts:42`, the single validation boundary) through `color/index.ts` →
`engine/index.ts`. **`HEX_RE` stays private.** The hex field validates live via the RD-06 `filter`
charset (`#` + hex digits) and finalizes by calling `toRgb()` (catching `InvalidColorError`) — the raw
regex is never needed publicly, keeping a single validation channel and a minimal surface. Additive
only; **no existing core export changes** (AC-11).

**Rejected:** also exporting `HEX_RE` — lets the widget test a complete hex without a `try/catch`, but
duplicates the validation channel `toRgb` already provides and widens the core surface.

---

## PA-4 — `src/color/` file split 🟡

**Question:** RD §Technical says `color-swatch.ts` + `color-picker.ts` + `index.ts`, "exact file split
confirmed at plan time." Add a pure-geometry file?

**Decision:** **4 files** — `color-grid.ts` (pure: grid dims, the `row*columns + floor(localX/3)` hit
math, the wrap-around nav functions, the near-black predicate) + `color-swatch.ts` (`ColorSwatch`
`View`) + `color-picker.ts` (`ColorPicker` `Group`) + `index.ts` (barrel). Mirrors date-family's
`calendar-grid.ts` split so the pure math gets its own spec/impl tests and `color-swatch.ts` stays
lean (well under the 500-line budget).

**Rejected:** 3 files (geometry inlined in the `View`) — fewer files, but the pure hit/nav math is
harder to unit-test in isolation and `color-swatch.ts` grows.

---

## PA-5…PA-8 — Source-determined fidelity facts (GATE-1) ✅

Decoded from `TColorSelector::draw()`/`handleEvent()` (`colorsel.cpp:120-237`) + the glyph table
(`tvtext1.cpp:88`), re-verified at the RD-21 preflight, and re-affirmed cell-by-cell at plan GATE-1 /
GATE-2. Recorded for traceability, not a user choice:

- **PA-5** — each cell is drawn `█` (U+2588 full block, TV `icon = '\xDB'`, `tvtext1.cpp:88`) via
  `moveChar(j*3, icon, c, 3)` → `fg = cellColor`, `bg = black` (TV attr `0x0c`: bg nibble 0).
- **PA-6** — the selected cell's centre column gets `◘` (U+25D8, TV `putChar(j*3+1, 8)` — CP437 `8`).
- **PA-7** — cell width = **3 columns** (`moveChar(…, 3)`); grid width = `columns * 3`.
- **PA-8** — wrap-around nav (`colorsel.cpp:179-217`): `←` `c>0 ? c-1 : maxCol`; `→` `c<maxCol ? c+1 :
  0`; `↑`/`↓` ±`columns` with the edge-wrap branches. Generalized `maxCol = colors.length - 1`,
  `width = columns`.

---

## PA-9…PA-13 — Resolved in the RD preflight (recorded) ✅

Requirement-level decisions already fixed in `RD-21-color-family.md` (preflight PASSED, 2026-07-04) —
carried here so every plan item traces to a decision:

- **PA-9** (RD PF-001 / AC-15) — internal **cursor index** is the single source of truth for nav +
  marker; `value: Signal<Color>` is a **derived two-way bind** (commit ⇒ `value = colors[cursor]`;
  external `value ∈ colors` ⇒ `cursor = indexOf(value)`, else unchanged). Initial `cursor =
  indexOf(value)` if present else **`0`**. `value ∉ colors` ⇒ **no marker**, yet Enter/Space commits
  `colors[cursor]`.
- **PA-10** (RD PF-004 / AC-5) — drag **outside the grid** ⇒ cursor reverts to its pre-drag cell
  (TV-faithful, `colorsel.cpp:167-173`); pointer **inside the grid but past the last cell of a partial
  final row** ⇒ clamp to `colors.length - 1` (generic-palette extension). Re-affirmed at GATE-2.
- **PA-11** (RD PF-003 / AC-7) — inside a `ColorPicker` popup the swatch commits **on mouse release**
  over a cell: a drag previews the cell under the pointer; mouse-**down** alone does not close;
  releasing over a cell commits `value` **and closes**. The standalone `ColorSwatch` keeps TV's
  down+drag select.
- **PA-12** (RD PF-006) — `ColorSwatch` **deliberately omits** TV's `ofFramed` (`colorsel.cpp:114`)
  and draws only cells + marker; the host popup/`Window`/`Dialog` supplies the frame. A recorded
  deviation, re-affirmed at GATE-2.
- **PA-13** (RD PF-005) — the Should-Have "named swatches" is an optional pure **`nameFor?: (c: Color)
  => string`** accessor surfaced in the `ColorPicker` chip caption; the palette stays `Color[]`
  (AR-211/212 intact). No per-cell label baked into the palette.

---

## PA-14 — Kitchen-sink ids + demo ✅

Two stories `color/color-swatch` + `color/color-picker`, category **`Color`**, plus a headless
`demo:color`, mirroring `demo:date`/`demo:tabs`/`demo:feedback`. Dominant house pattern (AR-219). Not
a user choice.

## PA-15 — Verify command ✅

`yarn verify` (= `turbo run typecheck build test` across packages) — from the project CLAUDE.md
Commands section. Confirmed, not invented. Fills every plan Verify line.

---

## PA-16 — (runtime) In-popup hex field vs `openAnchoredPopup`'s focus-loss dismiss 🟠

**Discovered:** Phase 4 execution (2026-07-05). **Status:** ✅ Resolved (user decision).

**Problem:** AC-8 / PF-004 place the hex `Input` **inside** the anchored popup and reach it via **Tab**
(grid-first). But `openAnchoredPopup`'s focus-loss effect (`dropdown/popup.ts`) dismissed the popup the
instant its single `focusTarget` (the `ColorSwatch`) lost focus — so **any** intra-popup focus change
(Tab to the hex, or a mouse-click on it) blurred the swatch → the popup dismissed and refocused the
picker. Verified empirically (`{open1:true, foc1:ColorSwatch, open2:false, foc2:ColorPicker}` after a
Tab). This makes AC-8's in-popup hex field **unreachable** with `dropdown/` unchanged — a direct
conflict with AC-9 ("RD-21 does not edit `dropdown/`"), which the RD-preflight PF-004 (Confidence Med)
did not catch. The hex field is unreachable by **either** Tab or click, so the whole `allowCustom`
feature is blocked, not just the Tab path.

**Decision (user, 2026-07-05):** **Generalize the focus-loss dismiss to popup-subtree membership** —
dismiss only when focus leaves the whole popup `frame` (not when the single `focusTarget` blurs). The
effect now **follows** focus while it stays inside the popup and dismisses once it moves out. This is a
minimal, **backward-compatible** change: for a single-focusable popup (History/ComboBox/Calendar) the
sole focusable IS the subtree, so any blur still dismisses — their suites (60 tests) stay green and
**guard** the change. It **supersedes AC-9's** "no `dropdown/` edit" for this one focus-loss
generalization; the guarantee AC-9 actually protects (History/ComboBox/DatePicker behaviour unchanged)
is preserved and asserted. **Rejected:** hex in the main field row (respects AC-9 but moves the hex out
of the popup, deviating from AC-8's design); a single composite popup panel (more custom code, can't
reuse the `Input`); defer `allowCustom` (loses the truecolor-hex feature). Recorded as the correct fix
for a real latent limitation of the shared primitive that RD-21 legitimately surfaced.

---

> **✅ GATE PASSED** — every semantically-weighted decision is resolved with an explicit user decision
> (PA-1…PA-4), a source-determined fidelity fact (PA-5…PA-8), an RD-preflight resolution (PA-9…PA-13),
> a confirmed dominant/house pattern (PA-14/PA-15), or a user-decided runtime resolution (PA-16). Zero
> items deferred.
