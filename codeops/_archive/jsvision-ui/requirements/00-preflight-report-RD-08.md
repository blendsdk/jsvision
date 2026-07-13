# Preflight Report: RD-08 — Editor family (Editor/Memo/EditWindow/Indicator/Terminal + FileEditor)

> **Status**: ✅ **PREFLIGHT PASSED — all 15 findings resolved** (0 critical, 2 major, 10 minor, 3 observations; user accepted all recommendations in bulk, fixes applied + verified across 2 iterations)
> **Iteration**: 2 (fixes verified 2026-07-06; 0 new findings)
> **Artifact**: Requirements doc at `codeops/features/jsvision-ui/requirements/RD-08-editor-family.md` (uncommitted, blob `228d787`)
> **Codebase Grounded**: 30+ jsvision source/test/manifest files examined (2 recon agents + direct reads) · 19 Turbo Vision citation clusters re-verified against `/home/gevik/workdir/github/tvision`
> **Hardening**: 1 independent challenger spawned for the MAJOR batch — both findings **CONFIRMED at MAJOR**, Option (a) picked on each (agrees with reviewer)
> **Last Updated**: 2026-07-06

> ⚠️ **SAME-DAY REVIEW**: RD-08 was drafted 2026-07-06 (same day, same model family; the drafting
> session was cleared before this audit). Same-agent-bias risk is partially mitigated by the fresh
> context, two independent recon subagents, and the independent challenger — but not eliminated.

## Codebase Context Summary

**Tech Stack:** TypeScript ESM-only (NodeNext, strict), yarn 1.x + Turborepo monorepo, zero runtime deps, vitest (spec/impl split), Node >= 20.
**Architecture:** `@jsvision/core` engine (render/input/host/color/safety) → `@jsvision/ui` retained-tree + signals widget framework (reactive/layout/view/event/app-shell/controls/containers/…) → `@jsvision/files` fs-bound package over an injectable `FileSystem` seam. TV fidelity is a NON-NEGOTIABLE decode-don't-design directive with GATE-1/GATE-2.
**Key files examined:** `ui/src/event/dispatch.ts`, `event-loop.ts`, `menu/menubar.ts`, `tabs/tab-view.ts`, `status/commands.ts`, `view/view.ts`, `window/{window,frame}.ts`, `desktop/{desktop,gestures}.ts`, `scroll/{scroll-bar,scroller}.ts`, `controls/{input-clipboard,input-editing,measure,input-render}.ts`, `core/src/engine/render/{width,buffer,cursor,osc}.ts`, `core/src/engine/color/theme.ts`, `files/src/{fs/types.ts,openers.ts,index.ts}`, `examples/kitchen-sink/stories/index.ts`, `packages/*/package.json`; TV: `edits.cpp`, `teditor1/2.cpp`, `editstat.cpp`, `tmemo.cpp`, `teditwnd.cpp`, `tindictr.cpp`, `textview.cpp`, `ttprvlns.cpp`, `tfiledtr.cpp`, `tvtext1.cpp`, `editors.h`, `views.h`, `app.h`, `examples/tvedit/tvedit2/3.cpp`.
**Reference verification:** ~50 discrete claims mapped — TV decode facts **all substantively verified** (incl. the `cpEditor`→`wpBlueWindow`→`cpAppColor` chain independently re-derived to normal `0x1E` / selected `0x71`, the 41-entry `firstKeys` table letter-by-letter, all `tvedit2.cpp` dialog rects, the `TEditWindow` rects + 24×6 min, the `TTerminal` ring, triple-click, `.bak`, `eolCrLf` default). jsvision-side: 11 verified, 4 mismatches (→ PF-001…PF-004), 1 not-found (→ PF-005).

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 3 (PF-007, PF-009, PF-015) | 🟡 |
| 2 | Implicit Assumptions | 2 (PF-002, PF-004) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-008) | 🟡 |
| 4 | Completeness Gaps | 1 (PF-005) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 2 (PF-006, PF-010) | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | (PF-008 co-filed) | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-011, PF-012) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001, PF-003, PF-013, PF-014) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ all resolved (fixes applied + verified) |
| 🟡 MINOR | 10 | ✅ all resolved (fixes applied + verified) |
| 🔵 OBSERVATION | 3 | ✅ all resolved (fixes applied + verified) |

---

## Findings

### PF-001: "Focused editor consumes Ctrl-Q/Ctrl-K before any app accelerator" is inverted by the shipped dispatch order 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption / Architecture Mismatch)
**Location:** RD-08 §Must Have › "The faithful keymap (AR-259)" (lines 108-110); echoed in AR-259.
**Codebase Evidence:** `packages/ui/src/event/dispatch.ts:114-120` — the app key→command consume runs FIRST and `return`s on a match, before any view is delivered (the deliberate RD-04 PA-1 contract); MenuBar preProcess (`menubar.ts:29`, consumes only F10/Alt per `menubar.ts:6-8`) also precedes the focused chain. A focused view's `onEvent` is Phase 2 — it can never preempt an app-keymap chord.
**The Problem:** The RD states a delivery-order guarantee the shipped dispatcher makes impossible for app-keymap bindings. Taken literally at plan time it silently commits to a new dispatch primitive (focused-view-first key claim), inverting the deliberate PA-1 keymap-first design — a scope-changing misdirection on the RD's hardest component.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Reword: the editor claims Ctrl-Q/Ctrl-K in **preProcess scoped to the focused editor** (the shipped TabView idiom, `tab-view.ts:311-336` `preProcess` + `isWithin(ev.getFocused(), this)`), + a documented constraint that apps must not bind Ctrl-Q/Ctrl-K in the app keymap (the keymap consume step cannot be preempted) | Zero dispatch/core change; proven in-repo idiom; honest about the real precedence (beats menu accelerators + other windows, not the app keymap) | The "before ANY app accelerator" promise weakens to "before menu accelerators / focused-window handlers; app keymap must stay clear" |
| B | Add a new dispatch primitive giving the focused view first claim on designated keys | Preserves the literal guarantee | Inverts the deliberate PA-1 contract; new architectural surface for a problem the preProcess idiom already solves |
| C | Drop the precedence guarantee entirely | Simplest | Loses a genuinely TV-faithful behavior (WordStar prefixes are the TV editor's identity, AR-259) |

**Recommendation:** Option A — the TabView preProcess+`isWithin` idiom already ships in this codebase and needs no new surface; the constraint ("keep Ctrl-Q/Ctrl-K out of the app keymap") is what `dispatch.ts:114-120` forces regardless.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED at MAJOR, picked A (noting the reword must name the app-keymap consume step as the unavoidable precursor).

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-002: Grapheme-cluster navigation is attributed to core's width engine, which has no cluster capability 🟠 MAJOR

**Dimension:** 2 — Implicit Assumptions (+ 13 Stale Assumption)
**Location:** RD-08 §Must Have › gap-buffer core (lines 82-86: "grapheme-cluster + CRLF-atomic … via core's width engine, `WIDTH_MODE='wcwidth'`"); AR-251.
**Codebase Evidence:** `packages/core/src/engine/render/width.ts:156` exposes only per-codepoint `charWidth(codepoint, widthMode)` — no segmentation API. No `Intl.Segmenter`/grapheme code exists anywhere in `packages/*/src`; `ui/src/controls/input-render.ts:26` + DEFERRED.md DEF-21 confirm caret stepping is deliberately code-point-only today.
**The Problem:** The requirement (AC-16 — legitimate, a documented TV extension) rests on a capability that exists nowhere, and the RD leaves the segmentation source undecided — a load-bearing architectural decision on the make-or-break XL module, not a prose nit. Verified viable: `Intl.Segmenter` (`granularity:'grapheme'`) is built into Node ≥ 16 with bundled ICU; all `engines` pins are `>= 20`, so it is a true zero-dependency option.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Amend the RD: **widths** from core `charWidth`; **cluster boundaries** = a new pure module in the editor's buffer core, `Intl.Segmenter`-based; promotion to core noted as a plan-time option (DEF-21's future consumer) | Honest attribution; keeps RD-08's core footprint at theme-roles-only; matches the house "defer surface until a second consumer" discipline | Input (DEF-21) can't reuse it until promoted |
| B | Add cluster segmentation to `@jsvision/core` as additive public surface now | One canonical segmenter; DEF-21 ready-made | Grows the cross-package footprint beyond the RD's stated theme-roles-only stance, for a consumer (DEF-21) nobody has scheduled |

**Recommendation:** Option A — local pure module now, clean promotion seam later.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED at MAJOR (explicitly rejected a MINOR downgrade — the segmentation source is an open decision, not wording), picked A; verified the Node/ICU viability claim.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-003: `Commands.undo` does not exist — the RD says it is "reused" 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Phantom Reference)
**Location:** RD-08 §Integration Points › With RD-07 (line 255: "`Commands.cut/copy/paste/undo` reused (+ an additive `Commands.redo` if absent)").
**Codebase Evidence:** `packages/ui/src/status/commands.ts:12-45` — quit/close/zoom/next/prev/cascade/tile/ok/cancel/yes/no/**cut/copy/paste** exist; **no `undo`, no `redo`**.
**The Problem:** `undo` must be added just like `redo`; the "if absent" hedge is resolvable now. A planner would otherwise hunt for a constant that isn't there.
**Resolution (single viable option):** State the fact: "`Commands.cut/copy/paste` reused; **additive `Commands.undo` + `Commands.redo`**." (Considered and dropped: leaving the hedge — it's just an unverified claim now verified false.)

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-004: Caret "insert vs overwrite shape" — no shape support exists anywhere in the seam or core 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** RD-08 §Rendering (line 129: "`desiredCaret()` reports the cursor cell (insert vs overwrite shape where the host supports it)").
**Codebase Evidence:** `packages/ui/src/view/view.ts:144` — `desiredCaret(): Point | null`, position only; `packages/core/src/engine/render/cursor.ts:3-6` — show/hide/to only, DECSCUSR shape explicitly deferred core-side; `run.ts:27` caret sequence is position-only.
**The Problem:** "where the host supports it" reads as if support exists and is merely capability-gated. In reality caret shape needs an additive core DECSCUSR API + a shape field through `desiredCaret`/`onCaret`/`run()` — none of which the RD's additive-surface list mentions.
**Options:** (a) Drop the shape clause (caret position only; shape becomes a named DEF); (b) keep it and add the additive core cursor-shape API + seam field to the Technical Requirements' additive surface.
**Recommendation:** (a) — shape is cosmetic to RD-08's scope and DEF-20 already deferred overwrite-mode caret-shape coupling for Input; a named DEF keeps it honest without growing three layers of surface.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-005: The Indicator's `═`↔`─` drag swap has no observable drag state to react to 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** RD-08 §`Indicator` (lines 161-164) + AC-11 ("while its window drags, the fill swaps").
**Codebase Evidence:** `packages/ui/src/desktop/desktop.ts:53` — the in-flight gesture is a `protected gesture: Gesture | null`, private and non-reactive; `window/window.ts` exposes no dragging state. TV's `sfDragging` has no shipped analogue a child view could subscribe to.
**The Problem:** The requirement is stated with no mechanism and none exists — the plan would discover mid-implementation that a ui-internal seam (e.g. a reactive `Window.dragging` signal set/cleared by the Desktop's beginMove/beginResize gesture lifecycle) must be added.
**Resolution (single viable option):** Name the additive ui-internal seam in Technical Requirements (a `Window` drag-state signal driven by the Desktop gesture lifecycle; exact shape at plan time). (Considered and dropped: polling/frame-hacks — against the reactive house model.)

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-006: AC-12 mixes inclusive and exclusive rect conventions 🟡 MINOR

**Dimension:** 7 — Testability (spec-oracle precision)
**Location:** RD-08 AC-12 (lines 346-349).
**Codebase Evidence:** TV `teditwnd.cpp:41,46,51`: at 60×20, hScrollBar `TRect(18,19,58,20)` covers columns **18..57**; vScrollBar `TRect(59,1,60,19)` covers rows **1..18**; indicator `TRect(2,19,16,20)` covers columns **2..15**.
**The Problem:** AC-12's "(18,19)-(58,19)" uses the TV-exclusive end (58) for the hScrollBar while "(59,1)-(59,18)" and "(2,19)-(15,19)" use inclusive ends for the vScrollBar/indicator. As an immutable spec oracle this is a latent off-by-one: a faithful implementation covering 18..57 "fails" the inclusive reading of 58.
**Resolution (single viable option):** Normalize AC-12 to one convention — either quote the TV `TRect`s verbatim (exclusive, recommended: matches the decode) or make all ends inclusive (hScrollBar → `(18,19)-(57,19)`). (No second viable option: leaving it mixed is the defect.)

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-007: Terminal "byte" cap semantics are undefined over JS strings 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** RD-08 §`Terminal` (lines 184-188) + AC-14 ("cap 32 and 5 writes of 10-byte lines").
**Codebase Evidence:** TV `textview.cpp:66` counts C bytes; jsvision buffers are JS strings (UTF-16 code units) — no byte representation exists unless one is invented.
**The Problem:** "Byte-capped" is meaningless without choosing a unit: UTF-8 bytes (requires encoding on every write), UTF-16 code units (native, zero-cost), or code points. Eviction math, the cap default, and AC-14's arithmetic all depend on it.
**Options:** (a) Cap in **UTF-16 code units** (JS-native, mirrors AR-251's position-unit decision; document as "units" not "bytes"); (b) cap in UTF-8 bytes (byte-faithful to TV but costs an encode per write for no user-visible gain).
**Recommendation:** (a) — consistent with AR-251's UTF-16-unit stance; reword "byte" → "code-unit" in the RD + AC-14.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-008: Mixed-EOL files break the "round-trips byte-identically" + "every insert converted" pair 🟡 MINOR

**Dimension:** 3 — Logical Contradictions (+ 9 Edge Cases)
**Location:** RD-08 §Line endings (lines 87-90, AR-252) + AC-15.
**Codebase Evidence:** TV `tfiledtr.cpp:104-145` — `loadFile` reads raw bytes straight into the buffer (NOT through `insertBuffer`); only `insertBuffer` converts (`teditor2.cpp:118-154,178,220`). So TV itself stores loaded text verbatim and converts only new insertions.
**The Problem:** The RD says every insert "(typed, pasted, clipboard)" is converted AND content round-trips byte-identically. For a mixed-EOL file both cannot hold if loading/`setText` counts as insertion. AC-15 only tests uniform CRLF, so the ambiguity survives into the oracle.
**Resolution (single viable option — it is also the faithful one):** Specify: loaded/`setText` content is stored **verbatim** (round-trip guaranteed, matching TV `loadFile`); EOL conversion applies to **new edits only** (typing/paste/clipboard). Optionally add a mixed-EOL round-trip clause to AC-15.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-009: AC-8's replace-all "reports a count ≥ 1" has no recipient or mechanism 🟡 MINOR

**Dimension:** 1 — Ambiguities (+ 7 Testability)
**Location:** RD-08 AC-8 (lines 331-335).
**Codebase Evidence:** TV `doSearchReplace` (`teditor1.cpp:400-429`) reports nothing on success — no count exists in the decode.
**The Problem:** "Reports a count" is an invented surface with no stated recipient (return value? an `edXXX` message? the dialog seam?). As written it fails the no-invention rule unless declared an extension with a defined shape.
**Options:** (a) Drop the report — assert the buffer state ("every hit replaced") instead; (b) declare a documented extension: the replace operation returns a count (test-visible API, no UI surface).
**Recommendation:** (b) — a return value is free, useful to the demos/tests AC-8 itself needs, and stays out of the drawing-fidelity zone; just say so explicitly.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-010: AC-17 mandates "the golden-screen harness", which is core-package-local 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** RD-08 AC-17 (lines 365-366).
**Codebase Evidence:** `@xterm/headless` is a devDependency of `packages/core` only (`packages/core/package.json:33`); the harness helpers live in `packages/core/test/golden-screen-helpers.ts`. No ui/files test uses xterm.
**The Problem:** An editor/terminal sanitize test lives in `ui` (or `files`), where the named harness doesn't exist. The AC as written forces either a new ui devDep + helper duplication or is unsatisfiable as stated.
**Options:** (a) Reword: assert sanitize at the ScreenBuffer/serialize level (the established ui test pattern — write-time sanitize is already core-guaranteed per `buffer.ts:133-159`); (b) add `@xterm/headless` + a shared harness to ui at plan time.
**Recommendation:** (a) — buffer-level assertion is sufficient (sanitize is write-time; nothing hostile can even be stored) and follows every existing ui suite; keep the golden harness for core.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-011: TV citation-precision nits (three locations) 🟡 MINOR

**Dimension:** 12 — Consistency (fidelity-directive citation accuracy)
**Location:** RD-08 decoded-facts table (lines 41-42, 49-51).
**Codebase Evidence (verified in tvision):**
1. The palette `#define`s are **not** in `editors.h:180-181` (that span is only the "1 = Normal / 2 = Selected" comment): `cpEditor "\x06\x07"` = `teditor1.cpp:171`, `cpMemo "\x1A\x1B"` = `tmemo.cpp:27`, `cpIndicator "\x02\x03"` = `tindictr.cpp:27`.
2. The tab-expansion math `pos = (pos|7)+1` is in `nextCharAndPos` (`teditor1.cpp:255`), which `formatLine` calls — not in `edits.cpp:31-92` itself.
3. `editors.h:485-492` is the TEditWindow palette-layout comment; the 24×6 min is `minEditWinSize` at `teditwnd.cpp:29` (applied in `sizeLimits` 91-95).
**The Problem:** The fidelity directive requires exact `file:line` citations to be carried into code JSDoc at GATE-1; wrong anchors propagate. All *facts* are correct — only the anchors drift.
**Resolution (single viable option):** Correct the three citations in the decode table.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-012: DEFERRED.md §B still lists RD-09 (files package) as "⬜ Backlog" though it is Done 🟡 MINOR

**Dimension:** 12 — Consistency (companion document)
**Location:** `requirements/DEFERRED.md` §B ("Files package … RD-09 … ⬜ Backlog").
**Codebase Evidence:** Feature roadmap `00-roadmap.md:38` — RD-09 **Done ✅ 2026-07-06** (43/43 tasks); RD-08 itself depends on the shipped RD-09 seam.
**The Problem:** Not a defect in RD-08's text, but the same maintenance pass that registered DEF-34/35 left §B stale — a future reader could believe RD-08's RD-09 dependency is unbuilt.
**Resolution (single viable option):** Flip the §B row to `✅ SHIPPED 2026-07-06`.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-013: "Re-rendered on the update-title broadcast" — the shipped title is already a reactive Signal 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (Redundancy)
**Location:** RD-08 §`EditWindow` (line 170) and the decode table's "frame redraw on `cmUpdateTitle`" row.
**Codebase Evidence:** `packages/ui/src/window/window.ts:61,87-89` — `Window.title` is a `Signal<string>` bound to repaint. A saveAs just sets the signal; no broadcast primitive is needed (the `cmUpdateTitle` row is a correct TV fact; the *requirement* wording implies new mechanism).
**Suggestion:** Reword to "reactive title (the existing `Window.title` signal); `FileEditor.saveAs` sets it" so the plan doesn't build a broadcast.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-014: Word-hop helpers already exist as plain-string pure functions 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (Redundancy note)
**Location:** RD-08 navigation primitives (`nextWord`/`prevWord`, line 84).
**Codebase Evidence:** `packages/ui/src/controls/input-editing.ts:17,33` — pure `prevWord(s, pos)` / `nextWord(s, pos)` (TV `tinputli.cpp:64-82` decode). They operate on plain strings, so a gap-buffer editor can't call them directly — but the TV *word-class rules* should not be re-derived divergently.
**Suggestion:** Note at plan time: share the char-class predicate (or document why the editor's `teditor2.cpp:45-59` classes differ from Input's `tinputli.cpp` ones — they are different TV decodes).

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

### PF-015: The EditWindow bars/indicator "active-state rule as decoded" is never stated 🔵 OBSERVATION

**Dimension:** 1 — Ambiguities
**Location:** RD-08 §`EditWindow` (line 169).
**The Problem:** "Visible per TV's active-state rule as decoded" points at a decode the decoded-facts table doesn't contain (which states are hidden — inactive window? dragging?). Deferring to GATE-1 is legitimate; the reference should say the rule is *to be pinned at GATE-1* rather than implying it was already decoded.
**Suggestion:** One-line wording fix, or pin the rule now.

**User Decision:** Resolved — User accepted recommendation (2026-07-06, bulk "accept all"); fix applied.

---

## Iteration 2 — fix verification & re-scan (2026-07-06)

> **Previous iteration**: 15 findings — all resolved (user accepted every recommendation in bulk).
> **This iteration**: 0 new findings. **Carried forward**: none.

- **Fix verification (15/15)**: every fix re-read in the modified RD — PF-001 (preProcess-scoped
  prefix claim + app-keymap constraint, lines 111-121), PF-002 (`Intl.Segmenter` pure module,
  82-91), PF-003 (additive `Commands.undo`+`redo`, 273-275), PF-004 (shape clause dropped →
  DEF-36 Won't-Have row + DEFERRED.md registration), PF-005 (additive `Window` drag-signal seam,
  174-178), PF-006 (AC-12 TV-`TRect`-verbatim, 367-372), PF-007 (code-unit cap in the requirement,
  overview table + AC-14), PF-008 (verbatim-load rule + AC-15 mixed-EOL clause), PF-009
  (replace-count return + extensions list), PF-010 (AC-17 buffer-level assert), PF-011 (three
  citation anchors corrected in the decode table), PF-012 (DEFERRED §B RD-09 → SHIPPED), PF-013/
  PF-014/PF-015 (wording applied). Companion updates: DEF-36 registered in DEFERRED.md §A;
  Ambiguity Register status line cross-references this report.
- **Regression check**: three residual echoes of PF-002/PF-007 found in the first application pass
  (the Scope Decisions AR-251/AR-257 summary rows + the core Integration bullet still said
  "clusters via core" / "byte-ring") — completed in the same iteration.
- **Fresh 13-dimension pass** over the changed text: clean. (The decode-table `Terminal` row
  deliberately retains TV's "circular **byte** queue" — it records the C++ fact; the requirement
  maps the cap to UTF-16 code units.)

## Verdict

# ✅ PREFLIGHT PASSED — all 15 findings resolved

No CRITICALs. The TV decode itself (the RD's core value) verified substantively clean across all
19 citation clusters — including the `cpEditor`→`wpBlueWindow`→`cpAppColor` chain independently
re-derived to `0x1E`/`0x71`. Both MAJORs were codebase-alignment corrections (dispatch-order
precedence, cluster-segmentation source), challenger-confirmed and fixed per Option A. RD-08 is
ready for `make_plan RD-08`.
