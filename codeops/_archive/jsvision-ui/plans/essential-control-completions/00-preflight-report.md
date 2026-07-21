# Preflight Report: essential-control-completions (RD-07)

> **Status**: ✅ ALL 8 FINDINGS RESOLVED (fixes applied 2026-07-02) — no 🔴/🟠/🟡/🔵 outstanding
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/essential-control-completions/`
> **Codebase Grounded**: 14 source files examined (ui + core), 3 TV C++ sources decoded, ~40 `file:line` references verified
> **Last Updated**: 2026-07-02

> ℹ️ **Fresh-session review** — this plan was authored in a prior session (not the current one), which
> aids review independence. Same *model family* still applies, so the TV-fidelity finding (PF-004) was
> checked **against the C++ source directly** (`tinputli.cpp:84`) rather than from memory, per the
> standard-first safeguard.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/ui` — retained widget tree (`View`/`Group`) + fine-grained signals over
`@jsvision/core`. Controls extend `View`/`Cluster`; the event loop owns a `RenderRoot` and drives one
coalesced frame per tick; `run()` bridges the loop to a native `Host`.
**Key Files Examined:** `controls/input.ts`, `controls/cluster.ts`, `controls/validators/{index,types}.ts`,
`view/{types,render-root}.ts`, `event/{event-loop,dispatch}.ts`, `app/run.ts`, `status/commands.ts`;
core `color/theme.ts`, `render/{osc,cursor}.ts`, `input/{events,keys}.ts`, `host/signals.ts`; TV
`tinputli.cpp`, `tmulchkb.cpp`, `tcluster.cpp`.

**Reference Verification:** ~40 references mapped — the overwhelming majority verified exactly
(theme slots 19/20/21, `setClipboard` osc.ts:47, `PASTE_CAP_BYTES` events.ts:131, cursor.ts:14-29,
signals.ts:110-124, insert/delete decoder keys, `TInputLine::draw` getColor(1/2/3/4), `TMultiCheckBoxes`
draw/press). Two design claims did not survive code grounding (PF-001, PF-002).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 | 🔵 |
| 4 | Completeness Gaps | (see 13) | — |
| 9 | Edge Cases | 1 | 🔵 |
| 12 | Consistency | 3 | 🟡 |
| 13 | Codebase Alignment | 3 | 🟠 |
| (others) | — | 0 | — |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ resolved — Option A applied to the plan docs |
| 🟡 MINOR | 4 | ✅ resolved (PF-003 count → 32; PF-004 P0.1 broadened; PF-005 reworded; PF-006 inventory added) |
| 🔵 OBSERVATION | 2 | ✅ resolved (PF-007 trimmed; PF-008 caret style + edge specced) |

---

### PF-001: MultiCheckGroup cannot inherit `Cluster.draw()` — the marker seam is 2-state boolean 🟠 MAJOR

**Dimension:** 13 (Architecture Mismatch) · 4 (Completeness)
**Location:** `03-03-multi-check-group.md` §API (line 43) + "Faithful visual"; `02-current-state.md` line 28.
**Codebase Evidence:** `packages/ui/src/controls/cluster.ts:91` — `ctx.text(2, i, this.mark(i) ? on : off, base)`;
`mark(i): boolean` (`:49`); `box(): ClusterBox` returns `{icon, on, off}` single chars (`:17-24`).

**The Problem:** The plan states MultiCheckGroup is built by "overriding `mark`/`press`/`box`" and
inheriting `Cluster.draw()`, with the drawn marker being `states[value[i]]` at col+2. But `Cluster.draw()`
**hardcodes a boolean 2-state marker** (`this.mark(i) ? on : off`). There is no seam through which a
multi-**state** marker string (`" xX"`, `selRange=3`) can reach the col-2 glyph. `CheckGroup`/`RadioGroup`
inherit `draw()` precisely because they *are* 2-state. TV itself unifies this via a marker **string** indexed
by `multiMark(item)` (`tcluster.cpp` `drawMultiBox(icon, marker)`, `tmulchkb.cpp:65` `drawMultiBox(" [ ] ", states)`)
— exactly the generalization our TS base collapsed away. **Independent challenger: CONFIRMED.**

Consequence: implementation must either (a) **override `draw()`** in MultiCheckGroup — duplicating the
box/label/role/hotkey/enabled layout (a DRY violation against the coding standard), or (b) **refactor the
`Cluster` base** to a marker-string + `markIndex(i): number` seam (mirroring TV), which then touches shipped
`CheckGroup`/`RadioGroup` and their RD-06 tests (impact not analyzed in the plan). The plan picks neither and
its stated mechanism ("just override mark/press/box") is not implementable as written.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Refactor `Cluster` base to TV's shape: replace `mark(i):boolean`+`box().on/off` with `markers: string` + `markIndex(i): number`; `CheckGroup`/`RadioGroup` pass `" X"`/index 0-1, MultiCheckGroup passes `states`/`value[i]`. `draw()` renders `markers[markIndex(i)]`. | Faithful to TV (one `drawMultiBox`); DRY; all three clusters share one draw | Touches shipped RD-06 code + tests (must re-verify CheckGroup/RadioGroup green); slightly larger blast radius |
| B | Override `draw()` in MultiCheckGroup only, replicating the box/label/role/hotkey loop with the multi-state marker. | Zero change to shipped clusters | Duplicates ~20 lines of layout logic (DRY violation); two draw paths drift over time |

**Recommendation:** **Option A** — it matches the Turbo Vision source (the fidelity directive's whole
point: `drawMultiBox` is *already* the string-marker generalization), keeps the base DRY, and the RD-06
cluster tests give a safety net for the refactor. Option B is only preferable if the base refactor is judged
too risky this late; if chosen, the plan must call out the deliberate duplication. Either way, **03-03 and
02-current-state must be corrected** — MultiCheckGroup does *not* fit the current seam unchanged — and the
`99` plan must add a task for the chosen base change + (for A) an impact/regression check on
`CheckGroup`/`RadioGroup`.

**Confidence:** High. **Hardening:** independent challenger read `cluster.ts:49-91` + TV `drawMultiBox` and
confirmed the incompatibility; recommendation reconciled (challenger reached the same A/B fork).

**User Decision:** Resolved — User accepted recommendation (Option A). Applied 2026-07-02:
`02-current-state.md` (corrected the "fits the same seam" claim), `03-03-multi-check-group.md` (new §"Cluster
base change (PF-001)" specifying the `markers: string` + `markIndex(i)` generalization + CheckGroup/RadioGroup
migration), `99` (P4.3a base-refactor task + P4.7 RD-06 regression task).

---

### PF-002: Hardware-caret collection is coupled to the compose walker — breaks on partial recompose 🟠 MAJOR

**Dimension:** 4 (Completeness) · 9 (Edge Cases) · 7 (Testability)
**Location:** `03-04-visible-caret-seam.md` §Design step 2 (lines 15-19); ST-14 (`07-testing-strategy.md:68-71`).
**Codebase Evidence:** `packages/ui/src/view/render-root.ts:237-267` (partial-recompose path visits only
`topmostDirty(dirtyViews)`), `:272` (`cache.clear()` only in `fullCompose`), `composeView` `:95-142`;
RenderRoot has **no** focus knowledge; EventLoop does — `event-loop.ts:96-98` `getFocused()`.

**The Problem:** The plan collects the caret **inside `composeView`**: "after walking a view, if it is the
focused leaf and `desiredCaret()` is non-null, translate … Store it privately; expose `caret()`." Two defects,
both challenger-CONFIRMED:

1. **RenderRoot cannot know "the focused leaf."** Focus lives in the EventLoop/`FocusManager`; `composeView`
   is a pure module function with no focus input. The check "if it is the focused leaf" is not implementable
   in RenderRoot as written — it can only test `desiredCaret() != null` on every view and *trust* the implicit
   contract that only the focused Input returns non-null.
2. **Partial recompose need not visit the focused Input.** On a normal repaint (`render-root.ts:247-264`),
   only dirty subtrees are composed. If the focused Input is unchanged while **another** view repaints (a
   bound-state echo, a clock, a sibling — common in the kitchen-sink stories), `composeView(Input)` never runs,
   so compose-time caret code never executes. The plan never specifies the reset/persist semantics: reset-to-null
   at compose start → the caret **wrongly vanishes** whenever an unrelated view repaints; never reset → the caret
   can go **stale**. ST-14 ("`onCaret` receives the correct absolute cell each frame") does not exercise the
   "another view repainted while the focused Input is unchanged" case, so the bug slips through the oracle.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Compute the caret in the **EventLoop after `flush()`**, not in `composeView`: get `focus.getFocused()` → `leaf.desiredCaret()` → look up the leaf's persisted `absOrigin` from the RenderRoot cache (survives partial recompose, cleared only on full compose) → translate → `onCaret(cell)`. RenderRoot exposes a `originOf(view): Point \| null` (cache lookup) instead of a stateful `caret()`. | Uses the component that actually owns focus; independent of which views repainted this frame; no reset/stale ambiguity; cache origins already persist | Adds a tiny RenderRoot accessor; caret recomputed every tick (cheap — one map lookup) |
| B | Keep collection in `composeView` but **do not reset** the stored caret across frames; recompute only when the focused view is (re)composed, and clear explicitly when focus changes (EventLoop pokes RenderRoot on focus change). | Smaller change to the stated design | Still couples caret to paint order; needs an explicit focus-change → clear hook; more moving parts than A; the "focused leaf" detection problem (defect 1) remains |

**Recommendation:** **Option A** — it dissolves both defects by locating caret computation where focus is
known and reading the *persisted* origin cache rather than piggy-backing on the compose walk. The challenger
independently identified this same design as available and cleaner. `03-04` should be rewritten so RenderRoot
exposes a pure `originOf(view)` lookup and the **EventLoop** owns the `onCaret` computation post-flush; **ST-14
must add** a case asserting the caret persists (correct absolute cell) across a frame where a *different* view
repaints and the focused Input is untouched.

**Confidence:** High. **Hardening:** challenger read `render-root.ts:237-272` + `event-loop.ts:96-98` and
confirmed parts 1-2 and the availability of Option A; recommendation reconciled.

**User Decision:** Resolved — User accepted recommendation (Option A). Applied 2026-07-02:
`03-04-visible-caret-seam.md` (RenderRoot exposes pure `originOf(view)`; the **loop** computes the caret
post-`flush()` from `focus.getFocused()` + `desiredCaret()` + `originOf` — no compose-time collection), `99`
(P0.3 `originOf`, P5.2 loop-computes wiring), `07`/`03-04` (ST-14 + AC-12 gain the partial-recompose
persistence assertion).

---

### PF-003: Task count is stated as 34 but the checklist contains 30 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `99-execution-plan.md` header (line 2: "0 / 34 tasks") + footer (line 109: "**34 tasks**").
**Codebase Evidence:** n/a (internal to the artifact).

**The Problem:** The Master Progress Checklist (lines 101-107) lists P0(3) + P1(5) + P2(5) + P3(5) + P4(6) +
P5(4) + P6(2) = **30** tasks, not 34. A wrong denominator makes the progress percentage and effort framing
misleading during exec_plan.

**Options:** Single viable fix — correct the count. (Considered and dropped: adding 4 tasks to reach 34 — there
is no evidence tasks are missing; the phases are complete, so the number is simply a miscount.)

**Recommendation:** Change both the header and footer to **30 tasks** (and re-state the progress line as
`0 / 30`). Verify the per-phase sub-counts if the totals line is regenerated.

**User Decision:** Resolved — corrected in `99` to **32** (not 30): the PF-001 fix added 2 Phase-4 tasks
(P4.3a split + P4.7), so the true post-fix total is 32; header/checklist/footer all reconciled 2026-07-02.

---

### PF-004: GATE-1 (P0.1) should also re-check RD-06's `inputSelected` — TV shows focused == unfocused input color 🟡 MINOR

**Dimension:** 13 (Stale Assumption / TV fidelity)
**Location:** `03-01-input-selection-clipboard.md` §Draw+color (the ⚠ note, lines 38-43); `99` P0.1; PA-6.
**Codebase Evidence:** TV `source/tvision/tinputli.cpp:84` `#define cpInputLine "\x13\x13\x14\x15"` (color-1
== color-2 == `0x13`); `:139` `getColor((state & sfFocused) ? 2 : 1)`; shipped `core/color/theme.ts:88-91`
declares a *distinct* `inputSelected` (slot 20, `0x2F` white-on-green) for the focused field.

**The Problem:** The plan's own ⚠ flags that `cpInputLine` color-1 and color-2 are **both `0x13`** — i.e. in
Turbo Vision a `TInputLine` draws the **same** attribute whether focused (`getColor(2)`) or not (`getColor(1)`).
Yet RD-06 shipped `inputSelected` as a distinct green (`0x2F`, slot 20). That strongly suggests the shipped
`inputSelected` (focused-field green) is itself a **mis-decode** (RD-06 appears to have used the blue-window
palette bytes rather than resolving `cpInputLine`→`cpGrayDialog`→`cpAppColor` for an input hosted in a gray
`Dialog`). The plan defers only the *new* color-3 (`inputSelection`) resolution to GATE-1, but the **same
decode** bears on the sibling role — and ST-04 bakes `inputSelected` into an oracle (`07:31`). Per the
NON-NEGOTIABLE fidelity directive ("C++ outranks our spec"), P0.1 is the natural place to settle this.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Broaden P0.1: while resolving color-3, also resolve `getColor(1)` and `getColor(2)` for a gray-dialog-hosted input; if TV yields focused==unfocused, record it and raise a scoped fidelity fix (or an explicit accepted deviation) for `inputSelected`; re-word the ST-04 oracle against the source. | Catches a latent shipped fidelity break at the one moment the decode is open; keeps the new role honest | Slightly widens P0.1; may surface an RD-06 correction |
| B | Leave as-is (only decode color-3); treat `inputSelected` as out of scope for RD-07. | Minimal scope | Misses a fidelity break the plan already half-spotted; ST-04 may encode a mis-decode; likely re-surfaces later |

**Recommendation:** **Option A**, bounded to *investigation + record*: have P0.1 explicitly resolve
`getColor(1/2/3)` for a gray-dialog input and **document the finding**. If focused==unfocused is confirmed,
present the `inputSelected` correction as its own small decision (fixing it may ripple into RD-06 goldens) —
don't silently change shipped color. This honors "decode, don't design" without scope-creeping the completion
slice. Note: this does **not** re-litigate PA-4/PA-6 (the *new* role name/color decision stands); it augments
what P0.1 must verify.

**User Decision:** Resolved — User accepted recommendation (Option A). Applied 2026-07-02: `99` P0.1 now also
resolves `getColor(1/2/3)` for a gray-dialog input and, if focused==unfocused is confirmed, surfaces a scoped
`inputSelected` fidelity decision; the `03-01` ⚠ note augmented to match.

---

### PF-005: "The 15 RD ACs map 1:1 onto the ST oracles (ST-01…ST-16)" — 16 ≠ 15 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `01-requirements.md:42-43`.
**Codebase Evidence:** RD-07 has exactly 15 ACs (AC-1…AC-15, verified); `07-testing-strategy.md` defines 16
oracles (ST-01…ST-16), grouping several STs per AC (e.g. AC-1/2/3 → ST-01…ST-04).

**The Problem:** The mapping is many-to-many (some ACs expand to multiple STs), not "1:1". The claim is
harmless but inaccurate and could mislead a reader tracing coverage.

**Options:** Single viable fix — reword. (Dropped: renumbering STs to 15 to force parity — the extra oracle
is legitimate coverage, not redundancy.)

**Recommendation:** Reword to "the 15 RD ACs map onto the 16 ST oracles (ST-01…ST-16), several ACs expanding
to more than one oracle" (or "cover" instead of "1:1").

**User Decision:** Resolved — reworded in `01-requirements.md` ("a cover, not a strict 1:1", 2026-07-02).

---

### PF-006: 00-index "cross-package additive" list omits the new clipboard-write envelope seam 🟡 MINOR

**Dimension:** 12 (Consistency) · 4 (Completeness)
**Location:** `00-index.md:24` ("Cross-package additive (core): the `inputSelection` Theme role … + `Commands.cut/copy/paste`").
**Codebase Evidence:** `99` P0.3 + `03-01`/`03-04` add `DispatchEvent.setClipboard?` (`view/types.ts`) and an
`EventLoop.writeClipboard?` option; these are new **ui** additive primitives not listed in the index summary.

**The Problem:** The index's additive-surface summary lists only the theme role + commands, but the plan also
introduces a `setClipboard?` field on the dispatch envelope and a `writeClipboard?` loop option (plus the
`View.desiredCaret`/`RenderRoot.caret`/`EventLoop.onCaret` caret seam, which the index does mention in the
Scope table row 5). The clipboard-write seam is a genuine new additive primitive and should appear in the
additive inventory for accurate scoping/packaging (ST-15 asserts "only optional fields added").

**Options:** Single viable fix — list it. (Nothing to drop.)

**Recommendation:** Add the `DispatchEvent.setClipboard?` field + `EventLoop.writeClipboard?` option to the
00-index additive inventory (they are ui-internal additive, not core), so the packaging oracle's "additive-only"
surface is fully enumerated in one place.

**User Decision:** Resolved — `00-index.md` now enumerates the additive ui seams (caret + clipboard-write)
alongside the core additive line (2026-07-02).

---

### PF-007: The clipboard-write seam section in 03-01 documents a discarded exploration inline 🔵 OBSERVATION

**Dimension:** 1 (Ambiguities / readability)
**Location:** `03-01-input-selection-clipboard.md` §Clipboard (lines 77-95).
**The Problem:** The prose reasons in a visible loop ("reuse `ev.emit`? No — … is insufficient. → Use a small
additive `ev.setClipboard?`") before landing on the decision that is then re-stated cleanly in the boxed
"Clipboard-write seam decision" note. The dead-end exploration is fine as thinking but makes the *spec* harder
to read and could confuse an implementer skimming for the contract.

**Recommendation:** Trim the exploratory paragraph to the conclusion (the boxed decision already states it
crisply); keep the rationale one sentence. Purely editorial — no behavioral change.

**User Decision:** Resolved — trimmed the Copy bullet in `03-01` to the decided seam (2026-07-02).

---

### PF-008: Logical-caret render style is under-specified; caret-at-right-edge may collide with the `►` arrow 🔵 OBSERVATION

**Dimension:** 1 (Ambiguities) · 9 (Edge Cases)
**Location:** `03-01` §Logical caret (lines 97-100); `03-04` §"Logical caret (companion)"; ST-13 (`07:65-67`).
**Codebase Evidence:** `Input.draw` paints the `►` at `w-1` when `canScrollRight` (`input.ts:107`); the caret
cell is `displayedPos(curPos)-firstPos+1`, which at end-of-scroll can land on/next to the arrow column.

**The Problem:** (a) "a visible attribute (reverse/cursor style via the buffer)" is vague — no concrete
`Style`/attr is named, and there is no explicit "reverse" role today; the implementer must invent one. (b) The
edge case where the caret column coincides with the `►` arrow column (curPos at the far right with active
right-scroll) is not addressed by ST-13 (which tests position, not arrow overlap). TV sidesteps this with a
hardware cursor and no in-buffer caret; our logical caret is the addition (DEF-19a), so the overlap is ours to
define.

**Recommendation:** Name the concrete logical-caret style in `03-01` (e.g. reuse `inputSelected`/a reversed
`Style`) and add one impl-test edge for caret-vs-arrow at the right edge (which glyph/attr wins). Low stakes —
the hardware caret is the primary UX; the logical caret is the headless/no-cursor fallback.

**User Decision:** Resolved — `03-01` now specifies a reversed `Style` (field fg/bg swapped, drawn last) and
the caret-vs-`►` right-edge edge; the edge case added to the `07` + P1.4 impl-test lists (2026-07-02).

---

## Adversarial checklist (same-agent-bias safeguard)

- *What assumption might I be confirming?* — "It's all additive / it just fits the Cluster seam." Both were
  actively disproven against code (PF-001, PF-002) rather than trusted.
- *What standard might this violate?* — Turbo Vision fidelity: checked `cpInputLine` **from source**
  (`tinputli.cpp:84`), surfacing PF-004 rather than reasoning from the shipped theme comments.
- *What would a dissenting expert flag?* — The compose/caret coupling (PF-002) and the boolean-marker seam
  (PF-001); an independent challenger agent confirmed both.

## Outcome

**✅ PREFLIGHT PASSED — all 8 findings resolved (fixes applied 2026-07-02).**

The two MAJOR design defects are corrected in the plan docs + execution tasks: the `Cluster` base is now
specced to TV's marker-string model (with CheckGroup/RadioGroup migration + an RD-06 regression task, PF-001),
and the hardware caret is derived by the EventLoop from the persisted origin cache after `flush()` — not
collected during the compose walk — with a partial-recompose persistence oracle (PF-002). The 4 minor + 2
observation findings are also applied: task total reconciled to **32** (PF-003), P0.1 GATE-1 broadened to
settle the `inputSelected` fidelity question (PF-004), the "1:1" mapping reworded (PF-005), the additive ui
seams enumerated in the index (PF-006), the circular clipboard prose trimmed (PF-007), and the logical-caret
style + right-edge overlap specced with an impl-test edge (PF-008).

**Ready for `exec_plan`.** Files touched by the fixes: `00-index.md`, `01-requirements.md`, `02-current-state.md`,
`03-01-input-selection-clipboard.md`, `03-03-multi-check-group.md`, `03-04-visible-caret-seam.md`,
`07-testing-strategy.md`, `99-execution-plan.md`.
