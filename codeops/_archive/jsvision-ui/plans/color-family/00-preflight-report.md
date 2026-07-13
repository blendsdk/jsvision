# Preflight Report: Color family (`ColorSwatch` + `ColorPicker`) plan

> **Status**: ✅ PASSED — all 6 findings resolved (0 critical, 0 major, 4 minor, 2 observation); fixes applied
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/color-family/`
> **Codebase Grounded**: 12 source files examined, ~30 references verified (incl. the `colorsel.cpp` TV decode)
> **Last Updated**: 2026-07-04

> ⚠️ **SAME-AGENT REVIEW (soft):** the plan was authored earlier today (2026-07-04), likely by the
> same model, though in a prior session (this session began fresh at `/preflight`). Same-agent bias
> risk is present but reduced. Mitigation applied: the TV-fidelity claims were verified against the
> **actual** `tvision/source/tvision/colorsel.cpp` + `tvtext1.cpp` source (exact lines cited), not
> from memory. Consider a human TV-fidelity spot-check at GATE-2 for maximum independence.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/core` foundation engine + `@jsvision/ui` Turbo-Vision-style widget framework
(retained view tree + Solid-style signals). RD-21 adds a new `packages/ui/src/color/` subsystem +
additive `@jsvision/core` surface. `ColorSwatch` is a faithful decode of TV `TColorSelector`; `ColorPicker`
is a documented extension mirroring `DatePicker`.
**Key Files Examined:** `tvision/source/tvision/colorsel.cpp` (TColorSelector draw/handleEvent, TColorDisplay,
TColorDialog), `tvtext1.cpp` (icon glyph), `packages/core/src/engine/color/{palette,color,theme,index}.ts`,
`packages/core/src/engine/index.ts`, `packages/core/src/engine/render/{types,width}.ts`,
`packages/ui/src/dropdown/popup.ts`, `packages/ui/src/event/{event-loop,types}.ts`,
`packages/ui/src/date/date-picker.ts`, `packages/ui/test/{tabs,feedback,date,table}-theme.spec.test.ts`.

**Reference Verification:** ~30 references mapped — all verified. Notably confirmed:
`colorsel.cpp` draw (`moveChar(j*3,icon,c,3)`, `putChar(j*3+1,8)`, `c==0`→`0x70`), handleEvent
(mouse `y*4+x/3`, `else color=oldColor`, the wrap-around nav), `icon='\xDB'`(█); `ANSI16_ORDER`
(palette.ts:43), `toRgb` (color.ts:42), `HEX_RE` (color.ts:32, private), `PALETTE` (palette.ts:100,
has `black`/`lightGray`), `Color` (render/types.ts:33), the color block at `engine/index.ts:146-159`,
the generalized `openAnchoredPopup`/`buildContent`/`contentSize`/`focusTarget`/`drawDropdownIcon`/
`absoluteRect` in `popup.ts`, and `ev.popupHost`/`focusView`/`setCapture` seams.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 2 (PF-001, PF-004) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-002) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 3 (PF-001, PF-003, PF-005) | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 4 | all resolved |
| OBSERVATION | 2 | all resolved (noted) |

---

### PF-001: GATE-1 decode omits TV's `0x70` full-line background pre-fill 🟡 MINOR

**Dimension:** Codebase Alignment (fidelity completeness) / Completeness Gaps
**Location:** `03-01-color-swatch.md` — the `draw()` decode table + the `draw(ctx)` steps; `00-ambiguity-register.md` PA-5
**Codebase Evidence:** `tvision/source/tvision/colorsel.cpp:122` — `b.moveChar(0, ' ', 0x70, size.x);` is the **first** instruction of `TColorSelector::draw()`, before the cell loop.
**The Problem:** The decode table in 03-01 records the cell glyph, width, color, marker, black-cell rule, and row count — but not the opening `moveChar(0, ' ', 0x70, size.x)` that pre-fills the entire view row with attr `0x70` (black-on-lightGray) before cells overwrite it. In the faithful 4×4 ANSI-16 case this is invisible (16 cells fully cover the 12-column grid, no gaps), so the omission is harmless there. But it (a) makes the GATE-1 decode incomplete, and (b) leaves undefined how the **generic-palette extension** renders the empty columns of a partial final row (e.g. 17 colors, columns 4 → the 4th row has 1 cell and 9 empty columns). TV would show `0x70` lightGray there; the plan's cells-only `draw()` would leave them at the parent/popup background.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Record the pre-fill in the 03-01 decode table + a one-line note: it is a no-op for full grids (cells cover every column) and RD-21 deliberately does **not** replicate the `0x70` fill for partial-row gaps (they fall through to the host background), an accepted extension deviation | Completes the GATE-1 decode; makes the partial-row rendering explicit; costs one doc note | None material |
| B | Also replicate the `0x70` line pre-fill in `draw()` so partial-row gaps render lightGray like TV | Maximally faithful | The swatch has no frame (PA-12) and lives in a host popup; a lightGray bleed into empty cells is arguably worse UX than the host bg, and TV never actually hits a partial row |

**Recommendation:** Option A — record the decoded instruction and explicitly document the partial-row gap behavior as an accepted extension. The pre-fill exists only to back the marker's forced-contrast in TV (already captured by the `colorMarker` role), and TV's fixed 4×4 grid never exposes it; replicating it (B) would bleed lightGray into a frameless, host-embedded widget.
**Confidence:** High. **Hardening:** in-context only (low stakes).

**User Decision:** Resolved — User accepted recommendation: Option A (record the pre-fill + document partial-row gaps as an accepted extension). Applied to `03-01`.

---

### PF-002: `hitCell` collapses "outside grid" and "partial-row overshoot" into one `null`, but AC-5 needs opposite behaviors 🟡 MINOR

**Dimension:** Edge Cases / Codebase Alignment (API design)
**Location:** `03-01-color-swatch.md` — `color-grid.ts` `hitCell` contract + the `onEvent` mouse `move` step
**Codebase Evidence:** Mirrors `calendar-grid.ts` (pure geometry split, verified present) — the pattern is sound; this is about the return-type discrimination.
**The Problem:** `hitCell(...)` returns `null` for **both** "point outside the grid rect" (caller must **revert** to the pre-drag cell, PA-10/faithful) **and** "point inside the grid rect but past the last cell of a partial row" (caller must **clamp** to `n-1`, PA-10/extension). AC-5 draws a sharp behavioral line between these two, yet the API makes them indistinguishable at the call site. The `color-swatch.ts` `move` handler is therefore forced to independently re-derive "is the point inside the grid rect?" (re-computing `gridDims` bounds that `hitCell` already computed internally) to pick revert-vs-clamp. This works but duplicates the bounds check and invites an implementation bug where an inside-overshoot is mistakenly treated as outside (revert) instead of clamp.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Give `hitCell` a discriminated result — e.g. return `number` (a real cell), or a sentinel distinguishing `'outside'` vs `'overshoot'` (or add a sibling `insideGrid(x,y,n,columns): boolean` predicate the swatch calls first) | The revert-vs-clamp branch reads directly off the pure function; no duplicated bounds logic; both PA-10 cases provably distinct + unit-testable | One extra exported helper or a slightly richer return type |
| B | Keep `hitCell: number | null` and document in 03-01 that the swatch re-checks `localX < cols*3 && localY < rows` before deciding revert vs clamp | No API change | Bounds logic lives in two places; the distinction the AC cares about isn't captured by the pure layer's tests |

**Recommendation:** Option A (the `insideGrid` predicate variant is the lightest) — PA-4's whole rationale for splitting `color-grid.ts` out is "the pure hit/nav math gets its own spec/impl tests." Encoding the revert-vs-clamp distinction *in* the pure layer honors that and closes the conflation risk before it reaches `color-swatch.ts`.
**Confidence:** High. **Hardening:** in-context only.

**User Decision:** Resolved — User accepted recommendation: Option A (`hitCell` → discriminated `number | 'overshoot' | 'outside'` + `insideGrid` predicate). Applied to `03-01` + `99`.

---

### PF-003: Theme-guard impact analysis names only 2 of the 3 closed-set guards that will break 🟡 MINOR

**Dimension:** Codebase Alignment (Impact Blindness)
**Location:** `03-03-theme-packaging.md` "Guard allowlists (PA-14)" + `02-current-state.md` §"Theme role pattern" PA-14 note
**Codebase Evidence:** Three closed-set "the X roles are the ONLY additive keys" guards exist and will each fail when `colorMarker` is added:
`packages/ui/test/tabs-theme.spec.test.ts:22,46` (`TAB_ROLES`, ST-30), `feedback-theme.spec.test.ts:23,47` (`FEEDBACK_ROLES`, ST-11), and **`date-theme.spec.test.ts:16-17,40`** (the six `calendar*` roles "are the ONLY new keys"). `table-theme.spec.test.ts` is **not** closed-set (ST-20 only asserts its own `tableHeader` byte + encode non-throw), so it needs no edit.
**The Problem:** Both the 03-03 and 02 prose say "date-family extended `tabs-theme.spec` + `feedback-theme.spec`" and name only those two. But the just-shipped **`date-theme.spec`** *also* carries a closed-set "ONLY new keys" assertion, and it is the most likely to be forgotten precisely because the prose omits it. An executor following the prose (rather than the grep) would land `colorMarker`, break `date-theme.spec`, and have to chase a red test. The task's own `grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY"` instruction (1.1.4) *will* surface all three, so this is a stale/under-counted enumeration, not a missing mechanism.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Update the 03-03 + 02 prose to name **three** closed-set guards to extend — `tabs-theme`, `feedback-theme`, **`date-theme`** — and explicitly note `table-theme` is *not* closed-set (no edit). Keep the grep as the authoritative safety net | Accurate impact list; executor can't miss `date-theme`; grep still backstops | One-line doc edit in two files |
| B | Leave the prose, rely solely on the grep instruction | No doc churn | Prose stays wrong; a grep typo or skipped step silently misses `date-theme` |

**Recommendation:** Option A — the grep is a good backstop but the impact analysis should be correct on its face. Naming `date-theme` explicitly (and excluding `table-theme`) removes the trap.
**Confidence:** High. **Hardening:** in-context (verified all four guard files directly).

**User Decision:** Resolved — User accepted recommendation: Option A (name all three closed-set guards; exclude `table-theme`). Applied to `03-03`, `02`, `99`.

---

### PF-004: How focus reaches the popup's hex `Input` (to type `#rrggbb`) is unspecified 🟡 MINOR

**Dimension:** Completeness Gaps
**Location:** `03-02-color-picker.md` §"Open / commit / cancel" — `buildContent` builds `[ ColorSwatch (fr) | hex Input (1) ]`, `focusTarget = the ColorSwatch`
**Codebase Evidence:** The RD-04 event loop supports Tab focus traversal within a group (`event/event-loop.ts` focus manager) — so a path plausibly exists, but the plan never states it.
**The Problem:** AC-8/ST-9 require the user to type a complete `#rrggbb` into the hex field and press Enter. But `focusTarget` hands focus to the `ColorSwatch` on open, and the swatch consumes arrow keys. The plan never says how focus moves from the swatch to the hex `Input` so the user can type — presumably Tab, or a click on the field, but it is unstated. Without a defined path, ST-9's "type a hex + Enter" scenario has no specified way to reach the input, and the spec-test author must invent one (risking a test that doesn't match the eventual UX).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add one line to 03-02: focus reaches the hex `Input` via **Tab** from the swatch (RD-04 focus traversal within the popup group); ST-9 dispatches a Tab before typing | Explicit, testable, uses the shipped focus mechanism; no new code | — |
| B | Make the hex `Input` the `focusTarget` when `allowCustom` is true (grid still reachable via Tab/Shift-Tab) | Typing works immediately on open | Changes the "grid-first" open UX; arrow-nav then needs a Tab — arguably worse for the common (pick-a-swatch) path |

**Recommendation:** Option A — grid-first is the right default (most picks are a swatch click/arrow, not a hex type), and Tab-to-field is the standard TV/RD-04 traversal. Just make it explicit so ST-9 can encode the Tab step.
**Confidence:** Med — the focus mechanism is verified to exist; the exact intended UX is a design choice for you to confirm.

**User Decision:** Resolved — User accepted recommendation: Option A (grid-first; Tab reaches the hex field; ST-9 dispatches Tab). Applied to `03-02`.

---

### PF-005: Both `█` and the new `◘` marker are East-Asian **Ambiguous** width 🔵 OBSERVATION

**Dimension:** Codebase Alignment (fidelity / convention)
**Location:** `02-current-state.md` §"Drawing" ("the swatch glyphs `█`/`◘` are BMP; no fallback required"); `03-01` marker draw
**Codebase Evidence:** `packages/core/src/engine/render/width.ts` classifies East-Asian **Ambiguous** as width 1 under the default `wcwidth` mode and width 2 only under `ambiguous-wide`. U+2588 (`█`) and U+25D8 (`◘`) are both Ambiguous (neither is in the `WIDE_RANGES` W∪F table, so both measure 1 under `wcwidth`).
**The Problem:** The TV-fidelity directive explicitly warns to "mind East-Asian ambiguous width — prefer unambiguous-narrow code points," and the plan asserts "no fallback required" citing only BMP-ness — it doesn't address ambiguity. Under the default `wcwidth` caps the 3-wide cell math and the centered `◘` at `cellX+1` are correct (both glyphs = width 1), and `█` is already used project-wide (buttons, progress, scrollbars) under the same regime, so this is a pre-existing accepted condition, not something RD-21 introduces. But under `ambiguous-wide` caps both become width 2 and the cell geometry corrupts — the same latent risk the rest of the codebase already carries.

**Recommendation:** No plan change required, but two cheap hardening steps: (1) in the GATE-2 fidelity spec assert `charWidth('◘') === 1` (and `'█'`) under the swatch's caps, so a stray continuation cell from a mis-measured marker can't silently corrupt the neighboring cell; (2) add a one-line note in 02/03-01 that the geometry assumes the default `wcwidth` width mode, consistent with existing `█` usage. Records the assumption the directive asks us to be explicit about.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation (assert `charWidth('◘')===1`/`'█'` at GATE-2; document the `wcwidth` assumption). Applied to `02`, `07`, `99`.

---

### PF-006: Hex `Input` row can be clipped when `columns*3 < 7` 🔵 OBSERVATION

**Dimension:** Edge Cases
**Location:** `03-02-color-picker.md` §`contentSize` = `{ width: columns*3, ... }`; the popup body stacks the hex `Input` under the grid
**The Problem:** The popup width is `columns*3`. A `#rrggbb` entry needs ~7 columns. At the default `columns: 4` the width is 12 (ample), but a small custom `columns` (e.g. 2 → width 6) with `allowCustom: true` would clip the hex field. This is a narrow, non-default configuration and no AC exercises it, so it's informational.
**Recommendation:** Optionally floor the popup width to `max(columns*3, HEX_FIELD_MIN)` when `allowCustom` is on, or document that `allowCustom` assumes a grid at least ~7 columns wide. Low priority.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation (floor popup width to `HEX_MIN` when `allowCustom`). Applied to `03-02`.

---

## Adversarial checklist (same-agent-bias safeguards)

- **"What assumption did I confirm unconsciously?"** — The fidelity decode: mitigated by reading the
  actual `colorsel.cpp` (exact lines cited), which *confirmed* the plan's decode is faithful.
- **"What external standard might this violate?"** — The TV source (the governing "standard" here) —
  verified directly. East-Asian width (PF-005) surfaced from re-checking `width.ts`.
- **"What would a domain expert who disagrees flag?"** — The `0x70` pre-fill omission (PF-001) and the
  `hitCell` return-type conflation (PF-002) — both surfaced.

## Outcome

**✅ PREFLIGHT PASSED — all 6 findings resolved** (0 critical, 0 major, 4 minor, 2 observation). The
user accepted every recommendation and the fixes were applied to the plan docs (`02`, `03-01`, `03-02`,
`03-03`, `07`, `99`) on 2026-07-04. No re-scan required — all fixes are documentation clarifications
grounded in verified code + the `colorsel.cpp` decode; none changed the plan's approach. This is a
strong, well-grounded plan, cleared for `exec_plan`.

### Fixes applied

| Finding | Fix | Docs touched |
|---------|-----|--------------|
| PF-001 | Recorded TV's `0x70` line pre-fill in the GATE-1 decode; documented partial-row gaps → host bg (accepted extension) | `03-01` |
| PF-002 | `hitCell` → discriminated `number \| 'overshoot' \| 'outside'` + `insideGrid` predicate; revert-vs-clamp now lives in the pure layer | `03-01`, `99` |
| PF-003 | Named all three closed-set theme guards (`tabs`/`feedback`/`date`); excluded `table-theme` | `02`, `03-03`, `99` |
| PF-004 | Specified Tab reaches the popup hex `Input` (grid-first, RD-04 traversal); ST-9 dispatches Tab | `03-02` |
| PF-005 | Documented the `wcwidth` width assumption; GATE-2 asserts `charWidth('◘')===1`/`'█'` | `02`, `07`, `99` |
| PF-006 | Floor popup width to `HEX_MIN` when `allowCustom` so a small `columns` can't clip the hex field | `03-02` |
