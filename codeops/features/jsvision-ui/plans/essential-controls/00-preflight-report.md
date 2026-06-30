# Preflight Report: Essential Controls + Validators (RD-06)

> **Status**: ✅ PASSED — Iteration 2 complete; all 9 findings resolved (fixes applied to the plan docs)
> **Iteration**: 2 (re-scan after fixes)
> **Previous Iteration**: 8 findings (2 major, 4 minor, 2 observation) — all resolved
> **This Iteration**: 1 new finding (PF-009, MAJOR) found by the re-scan — resolved
> **Carried Forward**: none open
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/essential-controls/`
> **Codebase Grounded**: ~14 source files examined (ui `event/`, `view/`, core `color/theme.ts`, `render/`), all key references mapped; TV source (`magiblot/tvision`) fidelity claims independently verified
> **Last Updated**: 2026-07-01

> ⚠️ **CROSS-SESSION, SAME-MODEL REVIEW**: the plan was authored 2026-06-30 (a prior session) and reviewed here by the same model family. Same-agent bias risk is moderate; the codebase + TV-source grounding and two independent challenger passes (PF-001/PF-002) mitigate it.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps. `@jsvision/ui` builds on `@jsvision/core`.
**Architecture:** Retained widget tree (`View`/`Group`) + fine-grained signals; host-agnostic 3-phase event loop; depth-aware theming via core `Theme`/`defaultTheme`.
**Key Files Examined:** `packages/ui/src/event/{dispatch,event-loop,focus,hit-test,commands}.ts`, `packages/ui/src/view/{view,types}.ts`, `packages/core/src/engine/color/theme.ts`, `packages/core/src/engine/render/{cursor,serialize}.ts`, `packages/ui/src/menu/builders.ts`, `packages/ui/src/index.ts`; TV source `app.h`, `dialogs.h`, `t{statict,label,button,inputli,cluster,checkbo,radiobu}.cpp`, `tvtext1.cpp`.

**Reference verification:** TV fidelity claims (palette slots, glyphs, line ranges) **verified TRUE** — the heart of the plan is well-grounded. The findings below concern the **intra-ui integration seams** (`ev.emit`/`ev.focusView`, the cursor), naming drift vs RD-06, and stale/undocumented dependencies — not the drawing fidelity.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | PF-006 | 🟡 |
| 2 | Implicit Assumptions | PF-002 | 🟠 |
| 4 | Completeness Gaps | PF-005, PF-006 | 🟡 |
| 12 | Consistency | PF-003, PF-004 | 🟡 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-005, PF-007, PF-008 | 🟠 |

(Dimensions 3, 5, 6, 7, 8, 9, 10, 11 — no findings. Dependency order, feasibility, testability, security, scope are sound.)

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | ✅ all resolved (PF-001, PF-002, PF-009) |
| 🟡 MINOR | 4 | ✅ all resolved (PF-003…PF-006) |
| 🔵 OBSERVATION | 2 | ✅ all resolved (PF-007, PF-008) |

### Iteration 2 — fixes applied & re-scan

All eight iteration-1 findings were fixed in the plan docs (see each finding's **User Decision** line).
The re-scan verified the fixes against the code and surfaced **one new MAJOR (PF-009)** that iteration 1
missed — the non-reactive `state.focused` breaks `Label`'s link-focus highlight and the Input blur hook
that the PF-006 fix introduced. PF-009 was resolved by an additive focus-change-signal primitive
(challenger-confirmed). Regression check: the role-rename edits leave no live phantom roles; the DEF-19 +
`DEFERRED.md` edits are consistent; the "two additive primitives" framing is now consistent across
`00-index`/`02-current-state`/`99-execution-plan`. No further findings.

---

### PF-001: `ev.emit` / `ev.focusView` wiring is mis-described (wrong site, phantom `RouteContext.focusView`) 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment — Stale Assumption / Phantom Reference)
**Location:** `03-01-foundation.md` §A; `99-execution-plan.md` task 1.2.1
**Codebase Evidence:** `packages/ui/src/event/dispatch.ts:23-40` (`RouteContext` — has `emitCommand`/`focusNext`/`focusPrev`/`hitTestRoute`, **no `focusView`**), `dispatch.ts:88-132` (`route(ev, ctx)` receives one already-built `ev` and delivers the SAME `ev` to many views — it does not build per-phase envelopes), `event-loop.ts:83-87` (the envelope is created in `dispatch()` as `{ event, handled: false }`), `commands.ts:53` (the command cascade creates its own envelope), `hit-test.ts:152` (`{ ...ev, local }` spread), `event-loop.ts:219` (`focusView` is passed only into `hitTestRoute`'s context, not `RouteContext`).

**The Problem:** The plan says to populate `emit`/`focusView` "in `event/dispatch.ts`, when building each phase's envelope, from the active `RouteContext`." Three facts contradict this: (1) `dispatch.ts route()` builds no envelopes — there is **one** envelope per event delivered to many views, not one "per phase"; (2) `RouteContext` has **no `focusView`** member (it's a phantom); (3) the envelopes are actually created in `event-loop.ts dispatch()` and `commands.ts`. An implementer following 1.2.1 literally would wire it in the wrong place against a non-existent member. The underlying capability is fine (`registry.emit`, `focus.focusView` both exist), so this is a wiring-description defect, not a design impossibility — but it will cause a failed first attempt + rework.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `emit`/`focusView` to `RouteContext`; enrich the envelope **once at the top of `route()`** (`const ev2 = { ...ev, emit: ctx.emit, focusView: ctx.focusView }`) and use `ev2` for the mouse branch + all sweeps (the hit-test spread then propagates them). Correct 03-01 + task 1.2.1 accordingly. | Single convergence point — key, command-cascade, AND mouse paths all flow through `route()`; respects `readonly` (fresh object); no coupling into the command registry | Two new `RouteContext` fields; a per-route shallow spread (negligible) |
| B | Set `emit`/`focusView` at every envelope-creation site (`event-loop.ts dispatch()` + `commands.ts enqueue`), relying on the hit-test spread for mouse | Sets fields once at creation | `commands.ts` has no `RouteContext` — would need context threaded into the registry (coupling) or a timing hazard; fragmented across ≥2 sites |

**Recommendation:** **Option A** — enrich in `route()` via two added `RouteContext` fields. It is the one point all event paths pass through before `onEvent`, it respects the `readonly` envelope, and it avoids coupling the command registry to dispatch context. The plan text just needs to point at `route()`/`RouteContext` instead of "per-phase envelope in `dispatch.ts`."

**Confidence:** High — what changes it: if the team prefers not to widen `RouteContext`, B is viable but messier.
**Hardening:** Independent challenger ran blind to my pick. **Challenger: converged** — independently chose route-level enrichment via `RouteContext` for the same single-convergence-point reason, and flagged B's command-registry coupling.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-002: No `View`→host cursor seam; `Input` over-claims "RD-05 cursor machinery" 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment — Stale Assumption) / 2 (Implicit Assumptions)
**Location:** `03-05-input.md` "Drawing" §, cursor bullet (lines 35-36)
**Codebase Evidence:** `packages/core/src/engine/render/cursor.ts` (only raw escape-sequence builders `cursor.to/show/hide`), `render/serialize.ts:95` (`cursorTo` used solely for damage-run output positioning), `view/render-root.ts` (no cursor-position API — only mount/resize/flush/buffer), `event/types.ts` + `event-loop.ts` (no cursor seam; `onFrame` delivers `ScreenBuffer` only), `app/run.ts` (wires `onFrame → host.render`, no caret).

**The Problem:** The Input doc states "the host positions the hardware cursor; the RD-05 cursor machinery handles visibility." There is **no machinery** wiring a focused `View`'s desired caret position to the host — no `View` can report a caret, and neither `RenderRoot`, `EventLoop`, nor `host.render(buffer)` carries one. The control is fully functional and testable headless (spec tests assert `ScreenBuffer` content; the logical caret cell is rendered correctly at `curPos - firstPos + 1`), but the claim asserts an integration that doesn't exist.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Defer** hardware-caret positioning (register a new `DEF-NN → RD-07`); correct the doc to say the logical caret is rendered in the buffer, and terminal-caret visibility is deferred | Honest about scope; preserves the stable RD-05 host/loop interfaces for RD-07's larger container/Dialog design pass; all spec tests pass; matches the plan's headless-first scope (AR-93) | A real terminal Input shows no blinking caret until RD-07 |
| B | Add a minimal cursor seam now (focused `View` reports caret → `RenderRoot`/loop → `host.render`) | Visible caret in v1 | Widens stable host/loop interfaces for one control before RD-07 designs the full set; speculative generalization |

**Recommendation:** **Option A** — defer + correct the claim. The milestone is explicitly headless + buffer-based (AR-93); the caret is a terminal render detail, not a control-fidelity requirement, and RD-07 (containers/Dialog/rich editors) is where the host-seam decision should be made with full context. Mirrors existing deferrals (DEF-01/16/17/18).

**Confidence:** Med-High — what changes it: if RD-06 is intended to ship a real interactive terminal app (not just the headless demo), B becomes warranted.
**Hardening:** Independent challenger ran blind to my pick. **Challenger: converged** — independently chose (a) defer + correct the doc, citing scope alignment, host stability, and existing DEFERRED precedent; named the same counter-argument (no visible caret = rough UX) and judged it outweighed for this milestone.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-003: Role-name drift — `buttonNormal`/`buttonSelected`/`labelNormal` named in RD-06/plan but never created 🟡 MINOR

**Dimension:** 12 (Consistency) / 13 (Convention)
**Location:** `01-requirements.md:18` (lists `buttonNormal`/`buttonSelected`); vs `03-01-foundation.md` §B + `00-index.md` Key Decisions + `07-testing-strategy.md` ST-02/ST-05 (reuse `button`/`buttonFocused`, role `label`)
**Codebase Evidence:** `packages/core/src/engine/color/theme.ts:44-45` (existing roles are `button`/`buttonFocused`); RD-06 `AC-3`/`AC-9` and `:58` name `buttonNormal`/`buttonSelected`/`labelNormal`.

**The Problem:** RD-06's ACs and the plan's `01-requirements.md:18` name `buttonNormal`/`buttonSelected` (and `labelNormal`), but the plan's actual design (PA-5/03-01/ST-02/ST-05) **reuses the existing `button`/`buttonFocused`** and names the normal label role `label`. Those AC names are never created. A spec-test author reading `01-requirements.md:18` or AC-9 literally would assert roles that don't exist.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a one-line reconciliation note in 03-01 + 01-requirements: AC's `buttonNormal`→existing `button`, `buttonSelected`→`buttonFocused`, `labelNormal`→`label`; fix `01-requirements.md:18` to the actual role set | Cheap; removes the trap; keeps the existing-role reuse decision (PA-5) | A small doc edit only |

**Recommendation:** **Option A** (sole viable) — the reuse decision (PA-5) is sound and verified; only the naming needs an explicit AC→role map so the immutable ST-02/ST-05 oracle and the spec-test author don't chase phantom role names. Considered and dropped: actually creating `buttonNormal`/`buttonSelected` aliases — needless duplication of `button`/`buttonFocused`.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-004: Stale task — 7.2.2 / ST-15 says to *add* deferred items already present in `DEFERRED.md` 🟡 MINOR

**Dimension:** 12 (Consistency) / 13 (Redundancy)
**Location:** `99-execution-plan.md` task 7.2.2; `07-testing-strategy.md` ST-15
**Codebase Evidence:** `codeops/features/jsvision-ui/requirements/DEFERRED.md:35-37` — DEF-16 (modal focus-trap), DEF-17 (multi-column cluster), DEF-18 (Text center/right) already registered; DEF-01/02/03 (Input selection, picture, MultiCheckGroup) also present.

**The Problem:** Task 7.2.2 says "Add the Phase-1 deferred items surfaced here (modal focus-trap, multi-column cluster) to `requirements/DEFERRED.md` (ST-15)." All of them are already in `DEFERRED.md`. The task is stale — it should *verify presence*, not add.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword 7.2.2/ST-15 to "verify DEF-16/17/18 (+ DEF-01/02/03) are present and correctly targeted" | Accurate; ST-15 becomes a real check | Doc edit only |

**Recommendation:** **Option A** (sole viable) — the register is already correct; the task just needs to become a verification step.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-005: Undocumented `controls/`→`menu/` dependency for `~hotkey~` parsing + Alt-hotkey matching 🟡 MINOR

**Dimension:** 4 (Completeness) / 13 (Dependency Reality)
**Location:** `03-02-text-label.md` (Label `parseTilde`), `03-03-button.md` (`~hotkey~` accent + `Alt-hotkey`), `03-06-clusters.md` (`~X~` + `Alt-<hotkey>`); `00-index.md` "Related Files"
**Codebase Evidence:** `packages/ui/src/menu/builders.ts:61` (`parseTilde`), `:72` (`tildeSegments` / `moveCStr`-style runs), `packages/ui/src/status/statusline.ts:15` (`import { parseTilde, tildeSegments } from '../menu/index.js'` — existing cross-subsystem precedent), `status/statusline.ts` (`matchesChord` accelerator parsing).

**The Problem:** Label, Button, and Cluster all need `~hotkey~` parsing/accenting and `Alt-<hotkey>` key matching. The plan describes the behavior ("`parseTilde(text)`", "accented via `buttonShortcut`", "`Alt-<hotkey>` matching an item's tilde char") but never identifies **where** these come from. `parseTilde`/`tildeSegments` live in `menu/` and the Alt-hotkey matching pattern lives in `menu/menubar` + `status/`. So three controls will import from `../menu/` (a new `controls/`→`menu/` coupling) and need a hotkey-key matcher — neither is acknowledged in "Related Files" or the foundation doc.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Document the reuse: controls import `parseTilde`/`tildeSegments` from `menu/` (precedent: `status/`), and reuse/extract the Alt-hotkey matcher; add to 03-01 "Integration Points" + "Related Files" | DRY; matches existing precedent; makes the dependency explicit | Cements a `controls/`→`menu/` import edge |
| B | As A, but first extract `parseTilde`/`tildeSegments` (+ hotkey matcher) into a neutral shared module (e.g. `view/` or a small `text/` util) that `menu/`, `status/`, and `controls/` all import | Cleaner layering — a shared text/hotkey util isn't conceptually owned by `menu/` | A refactor of two existing subsystems; larger blast radius; out of RD-06's "no spine re-shape" intent |

**Recommendation:** **Option A** — reuse from `menu/` and document it. There is direct precedent (`status/` already imports `parseTilde` from `menu/`), and RD-06 is explicitly scoped to *not* re-shape existing subsystems. The cleaner relocation (B) is worth a tiny DEFERRED note but shouldn't expand RD-06's blast radius. **Action also needs:** name the Alt-hotkey key-matcher source (reuse `status/`'s `matchesChord` or `menubar`'s Alt-hotkey logic, or extract a small shared helper).

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-006: `Input` focus-leave → blocking-validation trigger is underspecified (no "blur event") 🟡 MINOR

**Dimension:** 1 (Ambiguities) / 4 (Completeness)
**Location:** `03-05-input.md` "Behavior" → Validator bullet ("on focus-leave (a blur event / when focus moves away) run `valid()`")
**Codebase Evidence:** `packages/ui/src/event/focus.ts:99-109` (`focusLeaf` flips `state.focused` + `invalidate()` — there is **no blur event** dispatched); `view/view.ts:120` (`bind` observes reactive state).

**The Problem:** The plan says blocking validation runs "on focus-leave (a blur event …)", but the dispatch model emits no blur event — focus changes flip `state.focused` and invalidate. To auto-run `valid()` when focus leaves, the `Input` must reactively observe `state.focused` (e.g. `bind(() => this.state.focused)` and act on the `true→false` transition). The mechanism is achievable but unspecified; ST-09 can also drive `valid()` explicitly, so this isn't blocking.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify the mechanism: `Input` binds to `state.focused` and runs `valid()` on the focused→unfocused transition; ST-09 may also call `valid()` directly | Removes the "blur event" misnomer; concrete for the implementer | Doc edit |

**Recommendation:** **Option A** (sole viable) — replace "a blur event" with the reactive `state.focused`-transition mechanism that actually exists.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-007: RD-06 AC-3 says "one-cell drop-shadow" but TV + the plan draw a full block-glyph shadow 🔵 OBSERVATION

**Dimension:** 13 (Codebase Alignment — fidelity nuance) / 12 (Consistency)
**Location:** RD-06 `AC-3` ("one-cell shadow") vs `03-03-button.md` PA-8 (block-glyph right-column + bottom-row shadow)
**Codebase Evidence (TV, verified):** `tbutton.cpp:116` `shadows = "\xDC\xDB\xDF"`, used at `tbutton.cpp:143-146` — TV draws `▄`/`█`/`▀` down the right column and across the bottom row, not a single cell.

**The Problem:** RD-06's loose "one-cell drop-shadow" wording understates TV's actual shadow. The plan (PA-8/03-03) correctly replicates the full block-glyph shadow — i.e. the plan is *more* faithful than the RD's phrasing. No plan defect; flagging so the immutable ST-05 oracle follows the plan/TV geometry, not the RD's "one-cell" phrasing.

**Recommendation:** No change to the plan. Optionally add a one-line note in ST-05 that "one-cell" in RD-06 is shorthand; the oracle asserts the TV `▄`/`█`/`▀` shape.

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-008: `tlabel.cpp:91-98` cites the `focusLink` call site, not its definition 🔵 OBSERVATION

**Dimension:** 13 (Codebase Alignment — citation precision)
**Location:** `00-ambiguity-register.md` PA-10, `02-current-state.md`, `03-02-text-label.md` (cite `tlabel.cpp:91-98`)
**Codebase Evidence (TV, verified):** `focusLink()` is *defined* at `tlabel.cpp:76-81`; lines `91-98` are the `handleEvent` *call* into it.

**The Problem:** Minor citation imprecision. Since the plan describes Label's `handleEvent` click/hotkey behavior, the `91-98` call site is actually relevant — but citing the `76-81` definition too would be more complete.

**Recommendation:** No change required; optionally cite both `tlabel.cpp:76-81` (def) and `:91-98` (handleEvent use).

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

### PF-009: `state.focused` is not reactive — `Label` link-highlight + `Input` blur-validation are broken as designed 🟠 MAJOR (found Iteration 2)

**Dimension:** 13 (Codebase Alignment — Stale Assumption / Architecture Mismatch)
**Location:** `03-02-text-label.md` (Label Highlight bullet, PA-10/ST-04); `03-05-input.md` (validator focus-leave, the PF-006 fix); `02-current-state.md:12-13` ("no new spine work")
**Codebase Evidence:** `view/view.ts:38` (`state.focused` is a plain boolean), `event/focus.ts:99-109` (`focusLeaf` flips it + `invalidate()`s **only** the focus-flipping view), `view/view.ts:120` (`bind` subscribes only on a **signal** read — a plain-field read fires once), `view/render-root.ts:253-263` (partial recompose redraws only each dirty view's own subtree — a non-invalidated sibling Label is not repainted).

**The Problem:** A control reflecting its **own** focus works (the focus manager invalidates it; its `draw()` re-reads `state.focused`). But (a) `Label` must repaint when its **link's** focus flips — the manager invalidates the link, not the Label, and `bind(() => link.state.focused)` never re-fires (plain field); and (b) the `Input` blur-validation hook (introduced by the PF-006 fix) can't react to its own focus-loss for the same reason. The plan's "no new spine work" claim is therefore inaccurate — focus must be made **observable**.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a lazy per-view **focus-change signal** (`focusSignal()`) the focus manager pokes in `focusLeaf`; `Label`/`Input` `bind` to it | Idiomatic (RD-01 signals); maximally additive — unobserved views pay nothing; solves both cases composably; zero blast radius on existing controls | A second additive primitive + an additive `focus.ts` edit (RD-06 is not zero-spine-work) |
| B | A focus-change listener/observer seam on the focus manager | Works | Parallel notification protocol when signals already exist; listener-lifecycle management; larger focus-manager surface |
| C | Control-local hack (mirror focus into a signal during `draw()`) | No spine change | Doesn't fix the Label (it never redraws); side-effect-in-draw anti-pattern |

**Recommendation:** **Option A** — the lazy focus-change signal. It keeps reactivity in the signal layer (matching RD-01), stays additive (existing plain-field readers unaffected; the poke is `?.set()` — a no-op when unobserved), and fixes both the Label highlight and the Input blur hook with one primitive. The cost is honest: RD-06 now carries **two** additive primitives and an additive `focus.ts` edit (docs corrected).
**Confidence:** High — what changes it: if the team rejects any spine touch in RD-06, the Label highlight (AC-2/ST-04) would have to be re-scoped, which the immutable AC forbids — so A is effectively required.
**Hardening:** Independent challenger ran blind to my pick. **Challenger: converged** — independently chose the lazy focus signal (`equals: () => false`) poked by `focusLeaf`, for the same idiomatic/additive/composable reasons, and rejected B (parallel protocol) and C (doesn't fix the Label).

**User Decision:** ✅ Resolved (Iteration 2) — fix applied to the plan docs per the recommendation.

---

## Verdict

**✅ PREFLIGHT PASSED — all 9 findings resolved (8 from Iteration 1 + PF-009 from the re-scan).**

The plan is execution-ready. Its TV fidelity — the highest-risk part — is independently verified solid (palette slots, glyphs, shadow, arrows, line ranges all TRUE). Dependency order, scope split (RD-11/RD-07), security, and the spec-first structure are sound. The fixes corrected the intra-ui integration seams (`ev.emit`/`ev.focusView` wiring, the new focus-change signal), the cursor over-claim (deferred → DEF-19), role-name drift, a stale DEFERRED task, an undocumented `controls/`→`menu/` dependency, and the focus-leave mechanism. RD-06 now honestly carries **two** additive intra-ui primitives + the additive core theme roles.

> **Scope note for the user:** PF-009's fix adds a *second* additive spine primitive (the per-view focus-change signal) that wasn't in the original plan. It's minimal, additive, and challenger-confirmed, but it does mean RD-06 touches `view/view.ts` + `event/focus.ts` (additively). Flag if you'd prefer to re-scope rather than add it.

> **Next step:** ready for `exec_plan` (the roadmap has no `00-roadmap.md` row for this plan to advance — the roadmap sync hook is inert here).
