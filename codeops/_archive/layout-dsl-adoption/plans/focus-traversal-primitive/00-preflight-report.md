# Preflight Report: focus-traversal-primitive

> **Status**: ✅ PASSED — all 7 findings resolved and fixes applied (2 critical, 1 major, 3 minor, 1 observation)
> **Iteration**: 1 (first scan) + iteration-2 verification of applied fixes (below)
> **Artifact**: Implementation plan at `codeops/features/layout-dsl-adoption/plans/focus-traversal-primitive/`
> **Codebase Grounded**: 8 source files + 3 test files examined; ~20 references verified
> **Last Updated**: 2026-07-19

> ⚠️ **SAME-AGENT BIAS**: the plan was authored earlier today, likely by the same model. Same-agent
> bias risk is elevated. Mitigation applied: an independent challenger (fresh context) was run on the
> two CRITICAL findings and **converged** on both from the source code.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest. `@jsvision/ui`
widget framework on zero-dep `@jsvision/core`.
**Architecture:** Focus is stored *in the view tree* — each `Group` holds a `current` child pointer;
following `current` from the root reaches the focused leaf. `focusInto(view)` descends **restore-or-first**
(saved `current` if still focusable, else `children.find(canReceiveFocus)`). `focusLeaf` →
`setCurrentChain` rewrites **every** ancestor's `current` on the path to the newly-focused leaf. Today
`advance(direction)` is **group-scoped** (cycles the focused leaf's parent group only, `% length` wrap).
The event loop confines dispatch to `scopeRoot()` = `modal.topView()` while a modal is open, else the
mounted root.
**Key Files Examined:** `packages/ui/src/event/focus.ts` (`setCurrentChain` :89-97, `focusInto` :122-134,
`advance` :145-185), `event-loop.ts` (`scopeRoot` :492, public `focusNext/Prev` :296-302,
`createFocusManager(()=>this.root)` :197, `routeContext.focusNext` :540, `const scope` :502),
`dispatch.ts` (unbound-Tab intercept :134, pre-process sweep :202), `view/dsl/flex.ts` (`container()`→`new Group()`),
`split/split-view.ts`, `tabs/tab-view.ts`, `editor/keymap.ts`; tests `event.focus.spec.test.ts`,
`event.focus.impl.test.ts` (W-5 :29-52, W-6 :56), `event.hardening.spec.test.ts` (:263, :307).

**Reference Verification:** file/line citations in 02-current-state and 03-01 are accurate
(`focus.ts:145`, `:122`, `:161-181`; `event-loop.ts:197/492/502`; `dispatch.ts:132`; `flex.ts` nesting;
split/tab-view blast radius). Two document references are inaccurate (see PF-005). The **algorithm
itself** (03-01) does not satisfy its own oracles (PF-001, PF-002).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 3 | Logical Contradictions | PF-001, PF-003, PF-005 | 🔴 |
| 4 | Completeness Gaps | PF-001, PF-002, PF-004 | 🔴 |
| 7 | Testability | PF-006 | 🟡 |
| 12 | Consistency | PF-005 | 🟡 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-003, PF-004, PF-007 | 🔴 |

(Dimensions 1, 2, 5, 6, 8, 9, 10, 11 scanned — no findings. Scope is tight, spec-first ordering
correct, RD-01/RD-02 exist, no security surface.)

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2 | ✅ all resolved + fixed |
| MAJOR | 1 | ✅ resolved + fixed |
| MINOR | 3 | ✅ all resolved + fixed |
| OBSERVATION | 1 | ✅ resolved + fixed |

---

### PF-001: Restore-or-first descent makes the Tab-wrap re-enter containers at their last-visited child — ST-F2/ST-F6 unsatisfiable while W-5 stays unedited, and a new end-of-dialog trap 🔴 CRITICAL

**Dimension:** 3 (Contradiction) / 4 (Completeness) / 13 (Codebase Alignment — Stale Assumption)
**Location:** `03-01-focus-traversal.md` (`enterEnd` :53-55; climb :39-48), `07-testing-strategy.md`
(ST-F2, ST-F4, ST-F6), `00-ambiguity-register.md` AR-3 & AR-7, `01-requirements.md` R-3 + success
criteria #1/#3.
**Codebase Evidence:** `focus.ts:89-97` (`setCurrentChain` sets `current` on **every** ancestor on each
focus move), `focus.ts:122-134` (`focusInto` = restore-or-**first**), `event.focus.impl.test.ts:29-52`
(W-5 requires wrap→restore).

**The Problem:** The plan's `enterEnd(scope,+1)` = `focusInto(scope.children.find(canReceiveFocus))` and
its climb descend via **`focusInto`** (restore-or-first, explicitly "unchanged", AR-3). But every forward
Tab step calls `setCurrentChain`, which rewrites the `current` of **all** enclosing groups to the
just-focused leaf. So when Tab wraps, `focusInto` **restores the last-visited leaf**, not the tree-first one:

- **ST-F6** (`col = [row1=[input], row2=[ok,cancel]]`, the headline goal): after `input→ok→cancel`,
  `col.current=row2`, `row2.current=cancel`. Wrap → `focusInto(col)` → **`cancel`**, not `input`. Worse,
  from `cancel` every `siblingCandidate` up the chain is `null`, so Tab lands on `cancel` **again** — a
  hard single-leaf trap; `input`/`ok` become unreachable by Tab. This **defeats the plan's entire purpose**
  and violates success criterion #1 ("fully Tab-traversable, wrapping within the dialog").
- **ST-F2** wrap lands on `a2`, not the specified `a1`.
- **W-5** (immutable witness) wraps to `a2` and *passes* — but only because its exit was a non-Tab
  `focusView(sib)` that left `g1.current=a2`. W-5's pass relies on the **same restore** that dooms
  ST-F2/ST-F6. First-on-wrap (AR-3 option b) would satisfy ST-F2/ST-F6 but **break W-5** → editing an
  immutable oracle, contradicting AR-7's "additive-only / every witness unedited".
- **Internal contradiction:** ST-F4 explicitly expects wrap→**restore** (a2) while ST-F2 expects
  wrap→**first** (a1) — the two new oracles encode opposite rules for the identical operation.

So **AR-7's core claim — "every witness passes unedited AND all new DFS oracles pass" — is not achievable
under the algorithm as specified.** The challenger independently confirmed this (converged, ~0.95).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Clear a group's `current` when `advance` bubbles *out* of it** (Tab pass-through resets memory; `focusView`/window-switch exits still preserve it). Wrap/re-entry then goes tree-first; W-5's `focusView` exit still restores a2. Rewrite ST-F4 to match ST-F2 (drop restore-on-Tab-wrap). Stays inside `advance` (AR-6 intact). | Reconciles W-5 + ST-F2 + ST-F6 (challenger-verified); no trap; still "change `advance` only"; `focusInto` untouched. | Changes the Tab-vs-click focus-memory contract (a group Tabbed-through then clicked back into starts at first, not last); ST-F4 must be rewritten; needs an explicit R-3 restatement. |
| B | **Adopt pure tree order for Tab and re-baseline W-5** (declare a scoped immutable-spec exception like RD-02 did for parity). | Simplest mental model; Shift-Tab/Tab symmetric. | Edits an immutable witness → directly contradicts AR-7 ("additive-only"); larger blast radius; the plan's premise ("additive, no re-baseline") collapses. |
| C | **Keep restore-or-first as written and accept the trap** — narrow the goal to "Tab escapes to the first lap only". | Zero new design. | Non-viable: reintroduces a trap (relocated, not fixed), fails success criterion #1, fails ST-F2/F6. Rejected. |

**Recommendation:** **Option A.** It is the only path that satisfies the new oracles *and* keeps every
witness unedited (AR-7), stays within AR-6's "advance-only" surgical scope, and eliminates the trap — the
challenger reached A independently. It requires: (1) documenting the clear-on-bubble rule in 03-01 and
AR-3/R-3; (2) rewriting ST-F4 (and its "restore on Tab-wrap" wording) to expect first-on-wrap; (3) an
explicit note in R-3/success-criterion-#3 that container **restore** now applies to *non-Tab* entry only.
`Confidence: High` — the trace is deterministic against `setCurrentChain`/`focusInto`. `Hardening:`
challenger converged; added the ST-F4-rewrite and R-3-restatement sub-items. `Challenger: converged`.

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-002: Reverse traversal descends to the *first* focusable, not the last — Shift-Tab is not the inverse of Tab and skips every container's last child 🔴 CRITICAL

**Dimension:** 4 (Completeness) / 13 (Codebase Alignment)
**Location:** `03-01-focus-traversal.md` `enterEnd` :53-55 ("Reuse `focusInto` so restore-or-first still
applies") + the climb's shared `focusInto(next)` :42; `07-testing-strategy.md` ST-F3 (reverse→c),
ST-F2 ("focusPrev reverses exactly"); `00-ambiguity-register.md` AR-3.
**Codebase Evidence:** `focus.ts:122-134` — `focusInto` has **no descend-to-last mode**; it always
descends restore-or-first.

**The Problem:** For `dir = -1`, both `enterEnd(-1)` and the climb's descent step reuse `focusInto`, which
descends to a container's **first** focusable. Reverse traversal into any multi-leaf container therefore
lands on its first child and **skips the last**:
- **ST-F3** (`root=[a, g=[b,c]]`, fresh): `focusPrev` from `a` → `enterEnd(root,-1)` → `focusInto(g)` →
  **`b`**, not the specified `c`. `c` is unreachable going backward; the reverse cycle is `a→b→a→b…`.
- Independent case `root=[g=[b,c], d]`: `focusPrev` from `d` → `focusInto(g)` → **`b`** when tree-order
  reverse of `d` is `c`.

So Shift-Tab is **not** the exact inverse of Tab (contradicting ST-F2 "reverses exactly" and ST-F7). AR-3
chose "restore-or-first" without a direction variant, so the algorithm as written cannot produce correct
reverse order. Challenger confirmed (converged, ~0.95). This is distinct from PF-001 (which is about
*memory* on wrap); PF-002 is about *direction* on descent, and Option A alone does **not** fix it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Add a direction-aware `descendLast` (restore-or-**last**) helper**; use it for `dir=-1` in both `enterEnd(-1)` and the climb descent (pair with PF-001 Option A's clear-on-bubble so reverse re-entry is pure-last). Lives in `focus.ts`, `focusInto` untouched. | Makes Shift-Tab the exact inverse; small, self-contained; AR-6 intact. | One more helper than 03-01 claims; AR-3/03-01 must be corrected to stop asserting `focusInto` serves both directions. |
| B | **Weaken ST-F3/ST-F2 to accept first-on-reverse-descent** (document Shift-Tab as not a strict inverse). | No new code. | Non-viable: contradicts "focusPrev reverses exactly" and normal TUI expectations; leaves controls unreachable in reverse. Rejected. |

**Recommendation:** **Option A** — it is the only viable resolution; B is a strawman kept only to name
what was rejected. Correct 03-01's `enterEnd`/descent prose (remove "reuse `focusInto` so restore-or-first
still applies" for `dir=-1`) and AR-3 to record the direction-aware descent. `Confidence: High` — direct
from `focusInto`'s definition. `Hardening:` challenger converged (noted the climb's shared `focusInto(next)`
also needs the last-variant, not just `enterEnd`). `Challenger: converged`.

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-003: AR-11's non-regression guard rests on a false model of dispatch — an unbound Tab never reaches a view's `onEvent` 🟠 MAJOR

**Dimension:** 3 (Contradiction) / 13 (Codebase Alignment — Stale Assumption)
**Location:** `00-ambiguity-register.md` AR-11 ("widgets consume `tab` in `onEvent` **before** `focusNext`
runs (e.g. the editor memo 'lets Tab pass through')"); cross-check `01-requirements.md` Out-of-scope.
**Codebase Evidence:** `dispatch.ts:134` intercepts unbound Tab and `return`s **before** the pre-process
sweep (`:202`), focused phase, and post-process — so no view's `onEvent` ever sees an unbound Tab. A
keymap-bound `tab` is converted to a command earlier (`:124-129`). `editor/keymap.ts` binds no `tab` key
(only Ctrl-Q/Ctrl-K prefix tables) — the editor does **not** consume Tab.

**The Problem:** AR-11 justifies "no widget regresses" with a mechanism that is impossible in the real
dispatch order: a view cannot "consume `tab` in `onEvent` before `focusNext`", because the loop handles
unbound Tab first and returns. The only way a widget keeps Tab is **keymap binding** — which the plan's
own Out-of-scope section states correctly ("an app that binds `tab` still wins … `dispatch.ts:132`"), so
AR-11 **contradicts** 01. The cited example is also wrong: the editor binds no Tab; "lets Tab pass through"
means it lets Tab reach `focusNext` — i.e. the editor **is** subject to the DFS change, not exempt from it.
The *conclusion* (keymap-bound widgets are unaffected; Phase 4.1's full verify is the real backstop) is
sound, but the resolved-ambiguity rationale is factually incorrect and should not stand as the safety
argument.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Rewrite AR-11**: state the real mechanism (unbound Tab is intercepted in `route()` before any view; only keymap-bound `tab` — none in the editor — is exempt; every other widget is subject to DFS and the actual guard is the Phase 4.1 verify sweep). Add a task to enumerate widgets that keymap-bind `tab`. | Accurate; keeps the (correct) conclusion on a true premise; strengthens the guard. | Small rewrite of an AR entry + one Phase-4 sub-task. |
| B | Leave AR-11; rely on Phase 4.1 verify to catch any real regression. | No edit. | Leaves a false, load-bearing rationale in the audit trail; the "editor consumes Tab" example will mislead a future maintainer. |

**Recommendation:** **Option A** — correct the rationale to the real dispatch order and make the Phase 4.1
sweep the explicit guard. `Confidence: High` on the facts (dispatch order + editor keymap verified in
code); severity is MAJOR because AR-11 is the plan's stated safety resolution. `Hardening:` in-context only
(directly code-verified; challenger budget reserved for the CRITICALs — `Challenger: not run, code-verified`).

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-004: `TabView` blast-radius marked "unaffected", but plain-Tab out of the active page's content *does* change under DFS 🟡 MINOR

**Dimension:** 4 (Completeness) / 13 (Impact Blindness)
**Location:** `02-current-state.md` "Blast-radius sweep" (`TabView` → "unaffected").
**Codebase Evidence:** `tabs/tab-view.ts` JSDoc: "plain Tab/Shift-Tab move focus into and through the
active page's content **as usual**." Today (group-scoped) Tab wraps within the page's group; under DFS,
Tab from the last focusable of the active page **escapes** to the next focusable sibling after the
`TabView`.

**The Problem:** The sweep's "unaffected" note is about tab-**switching** chords (Ctrl+PageUp/Down,
Alt-hotkeys), which are indeed untouched. But plain Tab traversal *within/out of* the page content is a
real behavioral change (Tab now exits the page). This is almost certainly the *intended* DFS behavior, but
"unaffected" is imprecise and no oracle pins it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reclassify `TabView` in the sweep as "**changes as intended** — plain Tab now escapes the active page into the next sibling (DFS); switching chords unchanged"; optionally add a small oracle. | Accurate; documents an intended change. | Minor doc edit (+ optional test). |
| B | Leave as "unaffected". | No edit. | Imprecise; a reader may assume Tab still wraps within the page. |

**Recommendation:** **Option A** (doc reclassification; oracle optional). `Confidence: High`.

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-005: "Tab traversal is group-scoped … locked by spec oracle ST-05" is an inaccurate citation (00-index + roadmap) 🟡 MINOR

**Dimension:** 12 (Consistency) / 13 (Phantom/Stale Reference) / 3 (Contradiction)
**Location:** `00-index.md` "Why this plan exists" ("Locked by spec oracle **ST-05**
(`event.focus.spec.test.ts:167`)"); `../../00-roadmap.md` line 27 ("group-scoped (spec oracle ST-05)").
**Codebase Evidence:** `event.focus.spec.test.ts:167` is `ST-05: a Group is a focus target iff it has a
focusable descendant` — it tests container **descent + empty-skip**, not the group-scoped wrap **trap**.
No oracle asserts the trap — AR-7 itself says "none asserts the deep-exit case being changed."

**The Problem:** The premise attributes the group-scoped trap to ST-05, but ST-05 does not lock it (and
passes unchanged under DFS). This mildly contradicts AR-7 and could imply the trap is spec-protected when
it is emergent behavior of `advance()`.

**Recommendation:** Correct both references to "the trap is emergent behavior of the group-scoped
`advance()`, not asserted by any spec oracle (AR-7)". Only viable fix; `Confidence: High`.

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-006: ST-F4 is garbled and encodes the losing side of PF-001 🟡 MINOR

**Dimension:** 7 (Testability) / 12 (Consistency)
**Location:** `07-testing-strategy.md` ST-F4 ("`focusView(a1)…` re-enter path: after leaving `g2` on `b2`,
wrap to `g1` **restores** `a1`'s saved sibling").

**The Problem:** ST-F4's step sequence is garbled ("focusView(a1)…") so its exact assertion is unclear,
and its "restore on Tab-wrap" expectation directly contradicts ST-F2's "first on Tab-wrap" (the PF-001
conflict). Whichever way PF-001 resolves, ST-F4 must be rewritten with precise, executable steps.

**Recommendation:** Fold into the PF-001 resolution: rewrite ST-F4 with explicit steps consistent with the
chosen wrap semantics (under the recommended Option A, ST-F4 becomes a *non-Tab re-entry* restore case —
e.g. leave via `focusView`, not Tab — so it still exercises restore without contradicting ST-F2).
`Confidence: High`.

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

### PF-007: "No new allocation / O(depth) pointer walks" understates the per-Tab filter allocations 🔵 OBSERVATION

**Dimension:** 13 (Codebase Alignment — accuracy)
**Location:** `00-ambiguity-register.md` AR-12 ("O(depth) pointer walks"), `07-testing-strategy.md` IMP-3
("No new per-frame allocation").
**Codebase Evidence:** the DFS climb calls `siblingCandidate` at each level, each doing
`group.children.filter(canReceiveFocus)` — O(depth) **array allocations** per Tab press, more than today's
single filter.

**The Problem:** The allocations are per-**keypress** (not per-frame) and tiny, so IMP-3's "no per-frame
allocation" claim is technically fine, but "O(depth) pointer walks / no new allocation" mischaracterizes
the cost. Harmless, but worth rewording so IMP-3 asserts the right thing.

**Recommendation:** Reword to "O(depth) small candidate-filter allocations per Tab press, none per frame;
`yarn bench` no hot-widget regression." `Confidence: High`. (Optional.)

**User Decision:** Resolved — User accepted the recommendation; fix applied 2026-07-19 (iteration 1).

---

## Adversarial checklist (same-agent-bias)

- *Assumption I might be unconsciously confirming?* That `focusInto` "just works" for descent — the
  challenger and I both broke it (PF-001/PF-002).
- *External standard?* No RFC applies; TUI Tab-order convention (Shift-Tab = inverse of Tab) is the
  yardstick and PF-002 flags the violation.
- *What would a focus-management expert flag?* The Tab-vs-click focus-memory contract (PF-001 Option A's
  trade-off) — surfaced for the user's decision.

---

## Resolution & applied fixes (iteration 1)

User accepted all recommendations. Fixes applied to the plan on 2026-07-19:

| Finding | Applied change | Files |
|---|---|---|
| PF-001 | Algorithm rewritten to **reset each Tab-exited group's `current`** (continuous Tab = pure tree order, no relocated trap; wrap re-enters at tree-end); container **restore** kept for non-Tab entry so W-5 holds unedited. AR-3, R-3, success-criteria updated. | `03-01`, `00-ambiguity-register` (AR-3), `01-requirements` (R-3, criteria), `99` (2.1), `00-index` |
| PF-002 | Added **`descendLast`** (restore-or-last) for `dir=-1` in `enterEnd`/climb descent → Shift-Tab is the exact inverse of Tab. | `03-01`, AR-3/AR-6, `01` (R-5), `99` (2.1), `00-index`, roadmap |
| PF-003 | AR-11 rewritten to the real dispatch order (unbound Tab intercepted in `route()` before any `onEvent`; only keymap-bound `tab` is exempt; editor binds none). Phase 4.1 now enumerates tab-binding widgets. | `00-ambiguity-register` (AR-11), `99` (4.1) |
| PF-004 | `TabView` blast-radius reclassified: plain-Tab now escapes the active page by design; switching chords unaffected. | `02-current-state`, `99` (4.1) |
| PF-005 | Corrected "locked by ST-05" → the trap is emergent behavior of `advance()`, not spec-locked. | `00-index`, roadmap |
| PF-006 | ST-F4 rewritten as a precise **non-Tab restore** oracle (leave via `focusView`, Tab to sibling, wrap restores). | `07-testing-strategy` (ST-F4) |
| PF-007 | AR-12 / IMP-3 reworded: O(depth) per-**keypress** filter allocations + pointer writes, none per frame. | `00-ambiguity-register` (AR-12), `07` (IMP-3) |

## Iteration 2 — verification of applied fixes

Re-traced the corrected `advance()` (03-01) against every affected oracle:

- **ST-F1/F2 (fwd):** `input/a1 → … → wrap → first leaf` ✓ (exited-group reset makes the wrap tree-order).
- **ST-F2/F3/F7 (rev):** Shift-Tab is the exact inverse; `descendLast` reaches each container's last leaf
  (ST-F3 `focusPrev` from `a` → `c`) ✓.
- **ST-F6:** `input → ok → cancel → wrap → input`, **no trap** ✓ (the exact defect PF-001 flagged is gone).
- **W-5 (witness, unedited):** wrap restores `a2` because `g1` was left via `focusView` (non-Tab, `exited`
  empty at the wrap) ✓. **AR-7's "all witnesses unedited AND new oracles pass" is now achievable.**

**One self-inflicted defect caught and corrected during application** (not a new open finding): the first
draft of PF-001's fix said the descent could "reuse `focusLeaf`", but `focusLeaf` self-computes the old
leaf via `getFocused()`, which the memory reset makes unreliable mid-traversal. Corrected 03-01 to specify
the flip is driven from the **captured `old`** (an internal `focusLeafFrom(old, leaf)` for the traversal
path; `focusInto`'s external behavior for non-traversal callers is unchanged). Re-verified: the blur now
targets the correct pre-reset leaf in both the sibling-step and wrap cases.

No new findings. The plan is internally consistent and buildable as written.

> **Note on `focus.ts` scope (AR-6):** the fix stays confined to `focus.ts` but is modestly larger than a
> pure `advance()` body swap — it adds `descendLast`, the exited-group reset, and a small flip-from-`old`
> factoring. `focusInto`'s external contract is unchanged. Estimate ~240–260 lines (well under the 500 oracle).

**Final verdict:** ✅ **PASSED** — all 7 findings resolved and fixed; witnesses remain unedited; spec-first
ordering intact. Ready for `exec_plan`.
