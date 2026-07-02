# Preflight Report: Input Dropdowns (RD-14)

> **Status**: ✅ PASSED — all 6 findings resolved (accepted recommendations, applied) and re-scanned clean (iteration 2)
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/input-dropdowns/`
> **Codebase Grounded**: 9 source files examined, ~20 references verified
> **Last Updated**: 2026-07-02

## Iteration 2 — fix verification (2026-07-02)

All six fixes applied and re-scanned; no regressions or new findings surfaced.

| Finding | Fix applied | Verified in |
|---|---|---|
| PF-001 | Effect-derive → imperative `syncOverlayVisible` helper (`children.length > 0` + `invalidate()`); menu controller **replaces** `:229/:247` with helper calls | `03-04` §2, `02-current-state` Gap 2, `99-plan` 0.2.3/0.2.4 + checklist |
| PF-002 | Additive `DispatchEvent` `getFocused()` + `PopupHost` accessor sourced in `routeContext`; leaf opens via `ev`; inventory now counts a 3rd intra-`ui` seam | `03-02` "Host acquisition", `02-current-state` Gap 4 + table, `00-index`, `01-req`, `03-04`, `99-plan` 0.2.5 |
| PF-003 | Placement fixed to `height = maxRows + 2` (content-shrink removed); host-intersect is the only row reducer | `03-02` Placement, `99-plan` 1.2.2, ST-2 |
| PF-004 | Focus-loss dismissal guarded on `list.rows.state.focused === false` (ignores open-time gain + initial run) | `03-02` Dismissal item 3, `99-plan` 1.2.3 |
| PF-005 | `00-index` reworded — now names three genuine intra-`ui` seams + five core roles | `00-index` Overview + modified-files list |
| PF-006 | ST-2 → AC-8 (geometry), ST-31 → AC-2/AR-135 (open keys) cross-refs corrected | `07-testing-strategy` |

**Re-scan note:** while resolving PF-002 the Phase-0 seams spec file
(`dropdown.seams.spec.test.ts`, referenced by `99-plan` 0.1.2) was found missing from the `07`
test-file table — added during the fix so the envelope seam has a documented spec home.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/ui` retained widget tree (`View`/`Group`) + fine-grained signals over
`@jsvision/core`. Popups mount into a single app-shell `overlay` Group; the RD-05 menu controller is
the pattern this RD generalizes.
**Key Files Examined:** `packages/ui/src/app/application.ts`, `menu/controller.ts`, `view/view.ts`,
`view/group.ts`, `view/types.ts`, `controls/input.ts`, `list/list-view.ts`, `event/*`,
`packages/core/src/engine/color/theme.ts`; parent `requirements/RD-14-input-dropdowns.md`.

**What holds up:** the TV GATE-1 decode, the AR traceability, the Input-seam cites (`:67/69/433`),
the ListView/focusSignal/overlay/theme-role cites — all verified accurate. This is a strong plan.

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | ✅ all resolved |
| 🟡 MINOR | 2 | ✅ all resolved |
| 🔵 OBSERVATION | 1 | ✅ resolved |

---

## 🟠 PF-001: PA-5 derived-visibility uses a reactive `effect` over non-reactive state

**Dimension:** 13 (Stale Assumption / Architecture Mismatch), 6 (Feasibility)
**Location:** `03-04-seams-and-theme.md` §2; `02-current-state.md` Gap 2; `99-execution-plan.md` 0.2.3; AR PA-5
**Codebase Evidence:** `view/view.ts:47` (`readonly state: ViewState = {...}` — plain mutated booleans),
`view/group.ts:33` (`readonly children: View[]` — a plain array, not an accessor).

**The Problem:** The plan's mechanism is
`effect(() => { overlay.state.visible = overlay.children().some((c) => c.state.visible !== false); })`.
Two independent breakages:
1. **Phantom API** — `overlay.children` is a plain array field (`group.ts:33`), not a callable
   accessor. `overlay.children()` is a TypeError.
2. **No reactive substrate** — neither `children` (array) nor `state.visible` (`view.ts:47`, a plain
   boolean mutated in place, per its own doc "the reference is fixed; fields mutate") is a signal.
   An `effect` wrapping them subscribes to nothing, runs **once** at creation, and never re-fires on
   add/remove or a visible-flip. The "derived" overlay would never update.

The menu controller today drives repaint imperatively (`overlay.add` → `invalidateLayout`,
`group.ts:67`), not reactively. The plan's own fallback ("a small `Group` helper
`syncVisibleFromChildren`") is the right shape but is described as an effect and contradicts the
"the menu controller merely **removes** its two assignments" framing (Gap 2 fix, §2): an imperative
derive must be **called** at each structural change, so the menu controller replaces `:229/:247`
with helper calls (same edit sites, same regression surface) rather than deleting them.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A (rec) | Imperative derive: a helper `syncOverlayVisible(overlay)` that sets `overlay.state.visible = overlay.children.length > 0` then `overlay.invalidate()`, called by the menu controller (at its open/close sites) and by the popup after every `overlay.add`/`remove`. Drop the `effect`/`some(visible)` wording. | Additive, no engine change; `children.length > 0` correctly handles menu+dropdown coexistence without a refcount; matches the existing imperative invalidation model | The menu controller edits `:229/:247` to *call the helper*, not just delete — correct the §2/Gap-2 framing |
| B | Overlay subclass overriding `add`/`remove` to auto-sync visibility | Callers unchanged | New type; still imperative; more surface than a one-line helper |
| C | Make `Group.children` reactive (signal-backed) so an `effect` works as written | Matches the plan's prose | Engine change to a core RD-03 primitive; violates the plan's "additive-only, no engine changes"; broad blast radius |

**Recommendation:** Option **A** — the minimal additive change that actually works with the
non-reactive `state`/`children`, and `children.length > 0` is a cleaner coexistence rule than the
`some(child.visible)` predicate. Correct §2 and Gap 2 to say the menu controller **replaces** its two
assignments with helper calls (the regression check stays as planned). Reject C (engine change,
scope), B (unneeded type).

**Confidence:** High — grounded in `view.ts:47` + `group.ts:33/67`. **Hardening:** self-challenged the
"could `state`/`children` be reactive elsewhere?" path — no; `state` is a literal object, `children` a
literal array, and `application.ts:142/201` mutate `state.visible`/`layout` imperatively.

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## 🟠 PF-002: How a leaf `History`/`ComboBox` obtains its `PopupHost` (overlay + `getFocused`) is unspecified

**Dimension:** 4 (Completeness), 5 (Dependency), 13 (Integration)
**Location:** `03-02-anchored-popup.md` `PopupHost` interface + Integration; AR PA-9; `00-index.md` "three intra-ui seams"
**Codebase Evidence:** `DispatchEvent` (`view/types.ts:100-143`) exposes `emit`/`focusView`/`setCapture`/
`releaseCapture`/`hasCapture`/`setClipboard` — **no `getFocused` and no overlay access**. The overlay
reaches only the `MenuBar`, via the explicit `menuBar.attach(overlay, seam)` wired in
`application.ts:176-183`. A `View` has `host: ViewHost` (`view.ts:102`) = `{markRepaint, markRelayout,
healFocus}` only — no path to the overlay or focus manager.

**The Problem:** `openAnchoredPopup` requires `host: PopupHost = { overlay, focusView, getFocused }`,
but nothing wires that host to a `History`/`ComboBox`. Unlike the `MenuBar` (special-cased in
`application.ts`), these controls are app-created leaves placed inside a `Window`/`Dialog`;
`application.ts` has no knowledge of them to call `.attach()`. `HistoryOptions`/`ComboBoxOptions`
carry no `host`, and the usage examples (`00-index.md`) construct them with none. At open time (inside
`onEvent`) the control has `ev.focusView` but **no `ev.getFocused` and no `ev.overlay`** — so it cannot
save the prior focus or find the overlay to mount into. PA-9's "same attach-seam the MenuBar uses"
covers the *bare-Dialog* case but not the *default app-shell* path the MVP demos/stories rely on.

Consequently the "additive surface" inventory is **incomplete**: a fourth additive seam (a way for a
control to reach the overlay host + `getFocused`) is required and unaccounted-for.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A (rec) | Add an additive RD-04 envelope seam: extend `DispatchEvent` with `getFocused()` + an overlay-host accessor (e.g. `ev.popupHost?: PopupHost` or `ev.overlay`), sourced in the loop's `routeContext` beside `emit`/`focusView`/`setCapture` (`event-loop.ts:302-306`). The control opens the popup from `onEvent` via `ev`. | Consistent with the existing envelope-seam pattern; leaf controls need no explicit wiring; one place to source it | A real new intra-`ui` seam (touches `view/types.ts` + `event/`); update the additive-surface inventory + a Phase-0 task |
| B | Add `host: PopupHost` to `HistoryOptions`/`ComboBoxOptions`; the app passes it explicitly (as it passes `menuBar`) | No envelope change | Every call site must thread the host; contradicts the host-less usage examples; app must expose its overlay |
| C | A control walks `parent` up to an app-context node exposing the overlay | No options/envelope change | No such context node exists today; fragile tree-walking; new convention |

**Recommendation:** Option **A** — it matches how `emit`/`focusView`/`setCapture` already reach leaf
controls and keeps the usage examples host-free. Update `03-02` (the `PopupHost` acquisition), the
additive-surface inventory (`00-index.md`, `01-requirements.md` Compatibility), and add a Phase-0 task
for the envelope seam. Reject B (breaks the host-less API), C (no context node).

**Confidence:** High — `view/types.ts:100-143` + `application.ts:176-183` are unambiguous.
**Hardening:** checked whether `setCapture`/`hasCapture` could substitute for overlay access — they
capture the pointer, not mount targets; they don't help find the overlay or the prior focus.

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## 🟠 PF-003: Popup height contradiction — content-shrink (`min(maxRows, entryCount)`) vs. the fixed TV `+7`

**Dimension:** 3 (Logical Contradiction) + TV-fidelity directive
**Location:** `03-02-anchored-popup.md` "Placement" vs. `03-01-history.md` decode §3, `01-requirements.md`
AC-8-corrected, AR PA-4/PA-7, and `07-testing-strategy.md` ST-2/ST-20
**Codebase Evidence:** N/A (intra-plan contradiction; TV oracle is `thistory.cpp:90-98`).

**The Problem:** `03-02` computes the popup **`height = min(maxRows, entryCount) + 2`** — shrinking the
window to the number of entries. Every other doc fixes it independent of entry count:
- decode §3 / PA-7: window = field-height **+ 7 = 8 rows** (TV `r.b.y += 7` unconditionally), visible
  interior = window − 2 = **6**;
- PA-4: window height = **`maxRows + 2`** (default 6 → 8);
- ST-2: "height = field+7 (**8 rows** for a 1-row field)".

TV's `THistoryWindow` is always field+7 tall regardless of count (few entries → blank interior rows).
For a 1-row field with 3 entries: ST-2/decode expect an **8-row** window; `03-02` yields
`min(6,3)+2 = 5`. An implementation following `03-02` would **fail the ST-2 oracle** (and diverge from
the non-negotiable TV geometry); one following ST-2 contradicts `03-02`.

**Options:**

Only one resolution is viable under the fidelity directive:

| Option | Description | Pros | Cons |
|---|---|---|---|
| A (rec) | Change `03-02` to `height = maxRows + 2` (fixed), then `intersect`-clamp to the overlay (which is the *only* thing that reduces rows — near the bottom edge, never flip up). Drop the `min(…, entryCount)` shrink. | Restores agreement with ST-2 / decode §3 / PA-4/PA-7; faithful to `thistory.cpp:90-98` | none |

**Considered and dropped:** "embrace content-shrink, correct ST-2 + decode to match" — rejected: it
violates the NON-NEGOTIABLE TV-fidelity directive (window geometry must match TV), and TV does not
shrink to content.

**Recommendation:** Option **A** — align `03-02` to the fixed `maxRows + 2` window used everywhere
else; entry count never sizes the window (only host-intersect clamps it down near the bottom edge).

**Confidence:** High. **Hardening:** re-read `thistory.cpp` decode in §3 — `r.b.y += 7` is
unconditional; `THistoryViewer` (a `TListViewer`) renders blanks below the entries. Content-shrink has
no TV basis.

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## 🟡 PF-004: List-focus-loss dismissal effect can self-dismiss on open (gain vs. loss not distinguished)

**Dimension:** 9 (Edge Cases)
**Location:** `03-02-anchored-popup.md` Dismissal item 3; `02-current-state.md` Code Analysis (focusSignal)
**Codebase Evidence:** `view/view.ts:88-90` — `focusSignal()` is a `void` tick with `equals: () => false`
that fires on **both** gain and loss (poked by `event/focus.ts` on losing *and* gaining views); `bind`
effects run **once immediately** on creation (`view.ts:162-174`).

**The Problem:** The popup gives the list focus on open (`host.focusView(list.rows)`), which **fires
`list.rows.focusSignal()` on the gain**, and the dismissal effect's first run happens at creation. If
the effect dismisses on any tick (as `Label` merely repaints on any tick, `label.ts:43-45`), it would
dismiss the popup the instant it opens. The effect must guard on the actual state
(`list.rows.state.focused === false`) and ignore the initial run + the open-time gain — a detail the
plan leaves unspecified.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A (rec) | Specify the effect reads `focusSignal()` for reactivity but only calls `dismiss()` when `list.rows.state.focused === false` (and skips the first, open-time run) | Correct; minimal | one extra sentence in `03-02` + an impl-test assertion |
| B | Defer wiring the focus-loss effect until after the open frame settles | Avoids the gain tick | More moving parts; still needs the loss guard |

**Recommendation:** Option **A** — add the `state.focused === false` guard to the `03-02` dismissal
spec and to the ST-21 / `popup.impl` coverage (open does not self-dismiss).

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## 🟡 PF-005: `00-index.md` "three intra-ui seams" miscounts / mislabels the additive surface

**Dimension:** 12 (Consistency)
**Location:** `00-index.md` Overview ("three intra-`ui` seams (a public Input linkage seam, a derived overlay-visibility seam)")
**Codebase Evidence:** N/A (cross-doc consistency).

**The Problem:** The Overview says "**three** intra-`ui` seams" but names **two** (Input linkage,
derived overlay), and the five History theme roles it groups with them are a **core** (cross-package)
change, not intra-`ui`. `03-04` correctly frames it as "three additive surfaces" = Input seam +
overlay seam + core roles. Independently, PF-002 shows a genuine **third** intra-`ui` seam (overlay-host
access) is actually required — so the count should be reconciled once PF-002 is resolved.

**Recommendation:** Reword `00-index.md` to "two intra-`ui` seams + five additive core theme roles",
then fold in the PF-002 seam if Option A is taken (→ three intra-`ui` seams, this time accurately).

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## 🔵 PF-006: Minor ST → AC traceability slips

**Dimension:** 12 (Consistency)
**Location:** `07-testing-strategy.md` ST-2, ST-31
**The Problem:** ST-2 attributes the **popup geometry** to *AC-2* (AC-2 covers open + list order;
geometry is **AC-8**). ST-31 attributes **open-via-button** to *AC-8* (geometry) when open keys are
**AC-2 / AR-135**. Cosmetic; the test content is right, only the cross-refs are swapped.

**Recommendation:** Swap the two source cites (ST-2 → AC-8 for the geometry clause; ST-31 → AC-2/AR-135).

**User Decision:** Resolved — user accepted recommendation (Option A). Applied 2026-07-02.

---

## Adversarial checklist (same-agent bias)

- **External standard:** the sole external oracle is Turbo Vision C++ (`thistory.cpp` et al.), decoded
  with `file:line` cites; PF-003 is exactly a fidelity-vs-plan check and lands against the source.
- **What a disagreeing expert would flag:** the two reactive-substrate assumptions (PF-001, PF-002) —
  both now verified against `view.ts`/`group.ts`/`types.ts`.
- Review ran in a fresh session (post-`/clear`), so same-session bias is not elevated.
