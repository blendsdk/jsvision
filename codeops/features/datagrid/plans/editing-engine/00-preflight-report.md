# Preflight Report — Editing Engine & Commit Model (datagrid/RD-02 plan)

> **Artifact**: `codeops/features/datagrid/plans/editing-engine/` (9 docs)
> **Implements**: datagrid/RD-02
> **Reviewed**: 2026-07-13
> **Git ref at scan**: `6261de0d` (working tree clean)
> **Skill**: preflight (CodeOps 3.5.0)
> **Outcome**: ❌ **BLOCKED** at scan time — 1 CRITICAL + 1 MAJOR.
> **Resolutions applied 2026-07-13** (per the decisions below): the RD-02 amendment (Tab→RD-10) + the
> plan-doc + register edits are **in place**. A fresh-session `preflight datagrid editing-engine` re-run
> (pending, to be run separately) should verify clean and advance the roadmap row `📋 → 🔬 Plan Preflighted`.

> ⚠️ **Review-independence note.** This is a fresh-session review (the plan's own register
> [`00-ambiguity-register.md`](00-ambiguity-register.md) requested it). The `advisor`/independent-
> challenger channel was unavailable, so per the recommendation-hardening protocol the two headline
> findings were hardened in-context (grounded to `file:line`, each second-guessed) **and** put to an
> independent adversarial challenger subagent tasked with refuting them — both were **CONFIRMED**.

## Codebase Context Summary

RD-02 is genuinely additive over the shipped RD-01 foundation, and the great majority of its
grounded claims verify **exactly** against the real code:

| Plan claim | Verified? | Evidence |
|---|---|---|
| `GridRows<T>` state/geometry/hooks are `protected` (subclassable) | ✅ | `packages/ui/src/table/grid-rows.ts:94-105,160,184,244,272-341` |
| `GridRows`/`GridHeader`/`apportionColumns`/`alignCell`/`stringWidth`/`GridRowsConfig`/`ColumnGeometry` on the ui barrel | ✅ | `packages/ui/src/index.ts:154-171`, `table/index.ts` |
| `column()` casts through (`col as GridColumn<T>`) → adding `set` propagates at runtime | ✅ | `packages/datagrid/src/column.ts:64-69` (no field-drop; the RD-01 defect analog is clear) |
| `commitCell` writes-first, awaits `onCommit`, reverts on `false`/reject | ✅ | `packages/datagrid/src/commit.ts:58-81` |
| `mountCellOverlay({host,loop,rect,origin,view})` + disposer + `absoluteRect` | ✅ | `packages/datagrid/src/overlay.ts:33-92` |
| Container owns `indent`/`focused`/`selected` as locals; overlay is the mount host | ✅ | `packages/datagrid/src/grid.ts:95-98,149-150` |
| `Input` leaves `enter`/`tab` unhandled; Esc unconsumed by `handleKey` | ✅ | `input.ts:247` + `insertPrintable` `input.ts:377-380` (`'escape'` >1 char → `false`) |
| Focus-chain bubble (leaf→ancestor Groups) for **Enter/Esc** | ✅ | `dispatch.ts:99-109,207-214` (Phase 2) |
| `gridCursor`/`gridDirty` land beside `calendarCursor`/`colorMarker`; `ThemeRole {fg,bg,hotkey?}` | ✅ | `theme.ts:15,337,340` |
| Theme inventory tripwire: `LATER_ADDITIVE_ROLES` allowlist is the sanctioned extension point | ✅ | `packages/ui/test/tabs-theme.spec.test.ts:118-141` (+ editor/feedback/date/color) |
| `version`-signal repaint precedent | ✅ | `packages/ui/src/surface/surface.ts:83-190` |
| `DispatchEvent.focusView`/`getFocused` on the envelope | ✅ | `view/types.ts:140,170`; `event-loop.ts:292` |

Phase 1 (theme roles + tripwire), the subclass approach, the overpaint math, the commit/overlay
seams, the dirty registry, and the container integration are all feasible as written. **Two
assumptions about keyboard dispatch, however, do not hold** — they are the blockers below.

---

## Findings

### 🔴 PF-001 (CRITICAL) — `Tab`/`Shift-Tab` never reach `onEvent`; the plan's Tab interception cannot work

**Dimension:** Feasibility / Codebase Alignment (Stale Assumption) · **Verdict:** CONFIRMED (independent challenger)

The dispatch router special-cases an unbound Tab **before any view is offered the event**:

```
packages/ui/src/event/dispatch.ts:134
  if (inner.type === 'key' && inner.key === 'tab') {
    if (inner.shift) ctx.focusPrev(); else ctx.focusNext();
    return;                       // ← returns before the preProcess sweep AND the focused chain
  }
```

This runs at step 2 of `route()` — before enrichment (`:182`), before the pre-process sweep
(`:202`), and before the focused-leaf/ancestor chain (`:208`). The default keymap binds **only**
clipboard chords, not tab (`default-keymap.ts:25-37`), so nothing converts Tab to a command first.
Therefore **no view — not a `preProcess` catcher, not the focused body, not an ancestor `Group` in
the focus chain — ever receives a Tab in `onEvent`.** An unbound Tab always moves focus.

This breaks the plan in two load-bearing places:
- **Idle cell navigation** — `03-02` nav table (`:48`) routes `Tab`/`Shift+Tab` → `moveCellForward`/`Back`
  "✅ intercept" in `EditableGridRows.onEvent`. Unreachable — Tab moves focus **off** the grid body.
- **Commit-advance while editing** — `03-02` `onEditorKey` (`:149-151`) catches `tab`/`shift-tab` on
  the editor-host `Group` to commit + advance. Unreachable — a Tab keystroke while editing moves
  focus off the open editor instead of committing.

Impact: RD-02 **Must-Haves** req #3 (Tab/Shift-Tab cell nav) & req #9 (Tab auto-advance), **AC-6**,
and **ST-7** (the Tab/Shift-Tab wrap spec, driven through `loop.dispatch`) cannot pass as designed —
`loop.dispatch({type:'key',key:'tab'})` moves focus rather than advancing the cursor. (Enter, Esc,
F2, arrows, Home/End, and printables are **not** swallowed and reach `onEvent` normally, so
everything *except* the Tab paths is fine.)

Corroboration: the throwaway spike already made this exact mistake —
`packages/spike-data-studio/src/editable-grid.ts:106` has a dead `case 'tab': this.tabCell(...)` in
its `onEvent`, unreachable under the same loop.

**Resolution options** (the user decides; this is a real design fork, not a typo fix):

- **(A) Keymap-bound grid commands — RD-conformant, the codebase's own idiom.** Define
  `gridCellNext`/`gridCellPrev` commands; handle them as `inner.type === 'command'` in
  `EditableGridRows.onEvent` (idle nav) and the editor-host `onEvent` (commit-advance), gated on the
  grid holding focus. Precedent: `Input` handles `selectAll` as a command *because the keymap
  swallows raw Ctrl+A* (`input.ts:222-229`). **Sub-choice — global vs. opt-in:** a globally-bound
  `tab` (dispatch.ts:124-130 fires first) means Tab-as-focus-traversal is lost **app-wide**; an
  **opt-in** binding (installed by the test harness + kitchen-sink loop, documented as a host
  requirement) keeps default Tab-traversal for hosts that don't opt in and still lets ST-7 pass.
  Cost: the datagrid widget can't set the loop keymap itself, so RD-02 must document the host/harness
  wiring, define the commands, focus-gate them, and rewrite the `03-02` nav table + `onEditorKey` +
  **ST-7** to drive commands.
- **(B) Defer Tab from RD-02; ship Enter-advance now.** Enter reaches `onEvent` and already advances
  by row; RD-02 could ship F2/Enter/type begin-edit, Enter commit+row-advance, Esc cancel, and
  arrow/Home/End/Ctrl+Home/End cell nav — everything except Tab. Cost: this narrows a stated RD-02
  Must-Have (req #3/#9, AC-6, ST-7 name Tab explicitly), so it needs a **requirements amendment**,
  not just a plan edit.
- **(C) preProcess catcher — rejected.** The tab-swallow runs *before* the preProcess sweep, so a
  preProcess view can't intercept Tab either. Not viable.

**Recommendation:** **(A) opt-in keymap-bound grid commands.** It satisfies AC-6/ST-7 (the test loop
opts in), uses the established `selectAll`-as-command pattern, keeps default Tab focus-traversal for
non-opting hosts, and stays inside the datagrid package + its tests. It requires a plan revision to
Phase 2/3 + ST-7 + the `03-02` nav table/`onEditorKey`, and a documented host-keymap note on the
container. Choose **(B)** instead if you'd rather keep RD-02 self-contained and amend the RD to defer
Tab. **Confidence:** High (dispatch path traced end-to-end + independently refuted-and-confirmed).
**Hardening:** in-context grounding + independent challenger subagent (advisor unavailable).

### 🟠 PF-002 (MAJOR) — `inner.char` is a phantom field; printable detection + Space seeding are wrong

**Dimension:** Codebase Alignment (Phantom Reference) / Consistency · **Verdict:** CONFIRMED (independent challenger)

`03-02:51` detects a printable as `inner.char !== undefined && !ctrl && !alt`. The core `KeyEvent`
has **no `char`**: `{ type:'key', key, ctrl, alt, shift, codepoint? }` (`events.ts:13-22`; no member
of the `InputEvent` union carries `char`). After narrowing `inner.type === 'key'`, reading
`inner.char` is a TypeScript **strict compile error** — a faithful implementation would not build.

The codebase's real idiom (from `Input.insertPrintable`, `input.ts:377-380`) is:
```ts
if (inner.ctrl || inner.alt) return false;               // guard
const ch = inner.key === 'space' ? ' ' : ([...inner.key].length === 1 ? inner.key : null);
// ch === null  ⇒ a named non-printable key (enter/tab/escape/up/f2…) — not a printable
```
A printable's character **is** `inner.key` (with `codepoint` set); named keys are multi-char lowercase
names. This also exposes a second bug in the seed: `03-02:138` seeds the field via
`replaceWith: inner.key`, which for the Space key seeds the literal string `'space'` rather than
`' '` — Space must be mapped exactly as `insertPrintable` does.

Impact: AC-2 (printable replaces), **ST-3**, **ST-12** (the printable-begin-edit path). Fix: replace
the `inner.char` predicate and the raw `inner.key` seed with the `insertPrintable` idiom (guard
`!ctrl && !alt`; printable ⇔ `inner.key === 'space' || [...inner.key].length === 1`; seed
`inner.key === 'space' ? ' ' : inner.key`). **Confidence:** High.

### 🟡 PF-003 (MINOR) — base `Enter`/`Space` **activate** is silently shadowed on read-only cells

**Dimension:** Edge Cases / Impact Blindness

The base grid binds `enter`/`space` → `activate` (row select + `onSelect`/`command`,
`grid-rows.ts:301-304,333-341`). RD-02 intercepts Enter (begin-edit / consumed no-op) and treats
Space as a printable, so on a **read-only** cell both become consumed no-ops and keyboard
activation/selection never fires. No existing spec pins this (`grid.spec.test.ts` asserts no
activate/select behavior — grep clean), and selection is RD-08, so impact is low — but it's an
unacknowledged divergence from the base. Decide deliberately: should a read-only cell's Enter/Space
fall **through** to the base `activate` (preserving keyboard selection) rather than being swallowed?
Note the chosen behavior in `03-02` either way.

### 🔵 PF-004 (OBSERVATION) — the `editable-grid-rows.ts` ↔ `editing.ts` `this` boundary is under-specified

The `03-02` code samples use `this.commit` / `this.focused` / `this.moveCellForward` as if all on
one object, but AR #11 splits the lifecycle FSM into `editing.ts` while the view lives in
`editable-grid-rows.ts`. Pin down whether `beginEdit`/`commit`/`cancel` are methods **on**
`EditableGridRows` or on a separate controller holding a grid reference — otherwise the implementer
guesses the seam. Low stakes; resolvable during Phase 3, but cheaper to state now.

### 🔵 PF-005 (OBSERVATION) — verify the async-resolve repaint actually flushes (ST-8 may not catch a miss)

`commit()` runs `bumpVersion()` / `applyAdvance()` / `ev.focusView(this)` **after** `await
commitCell(...)` — i.e. outside the original dispatch tick (`ev.focusView` = `focus.focusView`
called directly, not via `runTick`). Confirm a deferred-async commit's post-resolve signal writes
schedule a real frame flush headlessly; **ST-8** as specified asserts `isDirty` state + a
separately-constructed `•` frame, so it could stay green even if the live post-resolve repaint never
flushes. Worth an explicit assertion (dispatch/settle, then read the frame) during Phase 3/4.

### 🔵 PF-006 (OBSERVATION) — several `file:line` citations drifted post-`develop`-merge

The symbols are all correct but some line numbers are stale after the `origin/develop` integration
(e.g. `Input` enter/tab passthrough cited `input.ts:250`, now `:247`; `getFocused` cited
`event-loop.ts:247`, now `:292`; `view/types.ts:163`, now `:170`; role count stated "80"). Harmless
to the design, but an implementer navigating by line number will land wrong — treat the citations as
approximate, or refresh them when the plan is revised for PF-001/PF-002.

---

## Disposition

| # | Severity | User decision (2026-07-13) |
|---|---|---|
| PF-001 | 🔴 CRITICAL | **(B) Defer Tab; ship Enter-advance.** Tab/Shift-Tab cell traversal + auto-advance + AC-6 move to **RD-10** (which owns the consolidated keymap + the keymap→command wiring Tab needs). RD-02 ships Enter commit+row-advance and ←/→/Home/End/Ctrl+Home/End cell nav. Requires an RD-02 amendment. |
| PF-002 | 🟠 MAJOR | **Apply the idiom.** Replace `inner.char` detection + raw `inner.key` seed with `!ctrl && !alt` + `inner.key === 'space' ? ' ' : ([...inner.key].length === 1 ? inner.key : null)`. |
| PF-003 | 🟡 MINOR | **Fall through to base activate.** Read-only cells no longer intercept Enter/Space — they fall to `super.onEvent` (row activate/select); only editable cells intercept for editing. (AC-1/ST-1 still hold: no editor mounts, record untouched.) |
| PF-004 | 🔵 OBSERVATION | Clarify the `editing.ts`↔`editable-grid-rows.ts` `this` seam during Phase 3. |
| PF-005 | 🔵 OBSERVATION | Verify async-resolve repaint flush during Phase 3/4. |
| PF-006 | 🔵 OBSERVATION | Refresh drifted `file:line` citations when the plan is revised. |

**Outcome: ❌ BLOCKED** (pending the revision below). The roadmap row stays at `📋 Plan Created` (a
BLOCKED preflight does not advance to `🔬 Plan Preflighted`). Re-run `preflight datagrid
editing-engine` after the edits land to advance the row to `🔬 Plan Preflighted`.

---

## Preflight Report: Editing Engine — Iteration 2 (fix-verification re-run)

> **Status**: REVIEW COMPLETE — 1 new finding (0 critical, 0 major, 1 minor, 0 observation) + all iteration-1
> findings verified · **Outcome**: ✅ **PASSED** (block cleared — no CRITICAL/MAJOR remains)
> **Iteration**: 2 (fresh-session re-scan after the PF-001/002/003 fixes)
> **Previous Iteration**: 6 findings — PF-001/002/003 fixed, PF-004/005 accepted (carried), PF-006 accepted (partially swept)
> **This Iteration**: 1 new finding (PF-007), the residual tail of PF-006
> **Reviewed**: 2026-07-13 (fresh session — independent of the authoring/iteration-1 session)
> **Git ref at scan**: working tree with the iteration-1 fixes applied (uncommitted); base `6261de0d`
> **Codebase Grounded**: 9 source files re-verified (`dispatch.ts`, `input.ts`, `event-loop.ts`, `view/types.ts`,
> `grid-rows.ts`, `theme.ts`, `column.ts`, `commit.ts`, `overlay.ts`)

### Fix verification (iteration-1 findings)

| # | Prior severity | Applied fix — verified against the current artifact + code | Verdict |
|---|---|---|---|
| PF-001 | 🔴 CRITICAL | Tab/Shift-Tab deferred to RD-10 across **every active spec** — RD-02 (amendment + nav list + auto-advance + interaction map + AC-6), RD-10 (keymap receives `nextCell`/`prevCell` + dispatch note), 00-index, 01, 02, 03-02 (nav table, `onEditorKey`, `commit`), 07 (ST-7 + AC-6 map), 99 (tasks 2.2.1/3.2.2). The mechanic re-verifies: `dispatch.ts:134` swallows an unbound `tab` **before** the pre-process sweep (`:202`) and the focused chain (`:208`). | ✅ **Fixed** |
| PF-002 | 🟠 MAJOR | `inner.char` predicate + raw `inner.key` seed replaced by the `Input.insertPrintable` idiom in 03-02 (`:141-145`) + task 3.2.3. Matches the real code exactly (`input.ts:378`: `const ch = inner.key === 'space' ? ' ' : [...inner.key].length === 1 ? inner.key : null`). | ✅ **Fixed** |
| PF-003 | 🟡 MINOR | Read-only `Enter`/`Space`/printable fall through to `super.onEvent` (base activate/select) — 03-02 (`:49-50,137-140`), 02 (`:29`), RD-02 amendment, ST-1 (asserts editor-absence + untouched record, not `selected`), task 2.2.1/3.2.3. Base `activate` binding confirmed at `grid-rows.ts:301-304,333-341`. | ✅ **Fixed** |
| PF-004 | 🔵 OBSERVATION | Accepted for Phase-3 resolution (the `editing.ts`↔`editable-grid-rows.ts` `this` seam). Still open by design; the 03-02 `commit`/`cancel` samples read `this.focused` while task 3.2.1 puts them in `editing.ts` — the exact accepted ambiguity, to be pinned when Phase 3 lands. | ↩ Accepted (carried) |
| PF-005 | 🔵 OBSERVATION | Folded into task 3.3.1 ("verify the post-resolve repaint/focus actually flush headlessly for a deferred-async commit"). | ✅ Addressed |
| PF-006 | 🔵 OBSERVATION | Active-spec citations refreshed (`input.ts:247`, `event-loop.ts:292`, `view/types.ts:170`, `calendarCursor:337`/`colorMarker:340`). **Residual drift remains** in the register prose + two counts → PF-007. | ◑ Partially swept |

### PF-007: Residual documentation drift after the revision (the PF-006 tail) 🟡 MINOR

**Dimension:** Consistency / Codebase Alignment (Stale Assumptions) · **Related:** PF-006 (accepted "refresh drifted
citations when the plan is revised" — the plan was revised, but these three references were not swept).

**Location & Codebase Evidence:**
- `00-ambiguity-register.md:27` (AR #7 table cell) and `:81` (AR #7 note) still describe the host `onEvent` as
  catching "Enter/**Tab**/Shift-Tab/Esc" / "all three bubble up the focus chain", and cite `input.ts:250` — the
  passthrough is now at **`input.ts:247`** (verified). This **contradicts the same row's own status** ("amended
  PF-001 (Enter/Esc only; Tab→RD-10)") and the register's PF-001 amendment section (`:148-156`). Per PF-001, Tab
  does **not** bubble — it is swallowed by `dispatch.ts:134` before the focus chain.
- `00-ambiguity-register.md:96` (AR #15 note) still says "On **Enter/Tab** while editing, the controller parses
  the field" — should be **Enter** only.
- `00-index.md:35` says the register has "**14 items**"; it has **15** (`grep` confirms rows 1–15; header says
  "all 15 items resolved").
- `02-current-state.md:103` and AR #3 (`:23`) say "**80 roles today**"; the `Theme` interface has **60**
  `readonly … : ThemeRole;` members (`packages/core/src/engine/color/theme.ts`).

**The Problem:** All four are low-stakes doc leftovers, but the register ones are a genuine internal
self-contradiction: a reader of AR #7/#15 prose gets the pre-amendment (now-wrong) Tab behavior, while the
authoritative specs (03-02, 99) and the register's own amendment + status column say Enter/Esc-only. The two
counts are descriptive and do not affect implementation. None cause rework — the executor follows 03-02/99, which
are correct — hence MINOR, not a blocker.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Refresh all four** — AR #7 cell/note + AR #15 note → "Enter/Esc; Tab→RD-10" and `input.ts:247`; `00-index` "14 items"→"15 items"; "80 roles today"→"60 roles today". | Register stops self-contradicting; counts accurate; closes PF-006 fully. | ~6 small edits in a binary-treated file (literal control bytes) — careful editing needed. |
| B | **Refresh the register prose only** (AR #7/#15 + `:250`→`:247`); leave the two counts as accepted descriptive drift. | Kills the only self-contradiction; minimal churn. | "14 items"/"80 roles" stay mildly stale. |
| C | **Accept all as historical** — the amendment section + status column already override the prose; note it and move on. | Zero churn; treats the register as an append-only decision log. | A future reader of AR #7/#15 body is briefly misled until they reach the amendment section. |

**Recommendation:** **Option A** — it is a ~6-edit sweep that removes a real (if minor) self-contradiction and
finally closes PF-006, which was accepted precisely as "refresh when the plan is revised." If you'd rather not
touch the control-byte-bearing register beyond the essential, **Option B** is the pragmatic floor (fix the
contradiction, accept the counts). **Confidence:** High (all four verified against the file + code).
**Hardening:** in-context grounding to `file:line`; no challenger needed (MINOR, no CRITICAL/MAJOR this iteration).

**User Decision:** **Resolved — Option A (refresh all four).** Applied 2026-07-13: AR #7 table cell + note and
AR #15 note updated to "Enter/Esc; Tab→RD-10" with `input.ts:247`; `00-index.md` "14 items"→"15 items";
`02-current-state.md` + AR #3 "80 roles today"→"60 roles today". PF-006 fully closed.

### Disposition — Iteration 2

| # | Severity | Verdict / decision |
|---|---|---|
| PF-001…003 | 🔴🟠🟡 | ✅ Verified **fixed** in the active specs; the PF-001 mechanic re-confirmed against `dispatch.ts:134`. |
| PF-004 | 🔵 | Accepted, carried to Phase 3 (the `this`-seam clarification). |
| PF-005 | 🔵 | Addressed (task 3.3.1). |
| PF-006 | 🔵 | Partially swept → residual drift tracked as PF-007. |
| PF-007 | 🟡 MINOR | ✅ **Resolved — Option A applied** (all four refreshed; PF-006 fully closed). |

**Outcome: ✅ PASSED.** Zero CRITICAL/MAJOR; the sole MINOR (PF-007) resolved. All iteration-1 blockers
(PF-001/002/003) verified fixed in the active specs. Roadmap row advanced `📋 Plan Created → 🔬 Plan Preflighted`
(see the roadmap sync below).
