# Preflight Report: Containers, Scrolling & Lists (RD-11)

> **Status**: ✅ PASSED — all 8 findings resolved (fixes applied 2026-07-01)
> **Iteration**: 1 (first scan) — resolutions applied to the plan docs
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/containers-scrolling-lists/`
> **Codebase Grounded**: ~16 source files examined; UI seams + TV citations independently verified
> **Last Updated**: 2026-07-01

⚠️ **SAME-DAY ARTIFACT**: this plan was authored 2026-07-01 (today). If it was created by the same
model, same-agent bias risk is elevated. Mitigation applied: an **independent challenger subagent**
(blind to the picks) reviewed the two high-stakes findings and **converged**; an independent
subagent re-verified the TV C++ citations against the live source.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/ui` = a retained View/Group tree + Solid-style signals on `@jsvision/core`.
RD-11 adds `src/{scroll,list,dialog}/` over the RD-01…06 subsystems. Faithful Turbo Vision re-creation
(fidelity directive: decode C++ at `/home/gevik/workdir/github/tvision`, GATE-1 before + GATE-2 after).
**Key Files Examined:** `window/{window,frame}.ts`, `event/{event-loop,modal}.ts`, `desktop/desktop.ts`,
`view/{view,group,draw-context}.ts`, `controls/{button,input}.ts`, `status/commands.ts`,
`core/.../color/theme.ts`, `examples/kitchen-sink/shell.ts`, `examples/tvision-demo/main.ts`;
requirements RD-11 + `00-ambiguity-register` (AR-103…114) + `DEFERRED.md` (DEF-16/19).

**Reference Verification:** UI seam `file:line` citations — all mapped, close (±small drift), no phantoms;
the `dialog` theme role, `execView`/`endModal`/`setCapture`, `Input.valid()`, layout `fr`, `Commands` all
exist as claimed. TV citations — 6 exact / 3 approximate / 1 wrong pointer (see PF-006); the decoded
*facts* (incl. the PA-10 theme bytes) are TRUE.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 1 (PF-003) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-004) | 🟡 |
| 4 | Completeness Gaps | 2 (PF-002, PF-007) | 🔴 |
| 9 | Edge Cases | 1 (PF-008) | 🔵 |
| 12 | Consistency | 1 (PF-005) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-006) | 🔴 |
| — | (others: 2,5,6,7,8,10,11) | 0 | — |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | ✅ resolved (PF-002) |
| 🟠 MAJOR | 1 | ✅ resolved (PF-001) |
| 🟡 MINOR | 4 | ✅ resolved (PF-003…006) |
| 🔵 OBSERVATION | 2 | ✅ resolved (PF-007, PF-008) |

---

### PF-001: Dialog frame-chrome reuse is not additive 🟠 MAJOR

**Dimension:** 13 (Architecture Mismatch / Impact Blindness) + 4
**Location:** `03-05-dialog.md` ("Dialog extends Window (reuse the RD-05 frame chrome), overriding draw to the dialog role"); `02-current-state.md:7` ("Every RD-11 change is additive — no existing subsystem needs reshaping") + PA-6; `99-execution-plan.md` Notes ("the sole edits to existing code are …").
**Codebase Evidence:**
- `packages/ui/src/window/frame.ts:53` — `export type FrameRole = 'window' | 'windowInactive';` (no `'dialog'`).
- `packages/ui/src/window/frame.ts:118` — `const iconStyle = { fg: theme.icon, bg: theme.bg };` (reads `.icon`).
- `packages/core/src/engine/color/theme.ts:43` — `dialog: ThemeRole & { border; title }` — **no `icon`** (window/windowInactive have it).
- `frame.ts:145-152` — draws close `[×]` **and** zoom `[↑]` gated only on `state.active && w>=8`; no `zoomable`/`closable` gate; `FrameState` (`:43`) has neither field.

**The Problem:** The plan says Dialog just overrides `draw` to the `dialog` role and reuses the frame chrome, additively. In reality: (A) `drawFrame`'s `role` param can't accept `'dialog'` (type error under `strict`), and even widened, `Theme['dialog'].icon` is `undefined` → malformed style; (B) `drawFrame` **always** draws the zoom box, so a TV-faithful non-zoomable Dialog (PA-6, GATE-2 requires close-but-no-zoom) is impossible from `drawFrame` unchanged. Either way the "additive-only, no existing subsystem reshaped" inventory is wrong.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **Generalize `frame.ts`**: widen `FrameRole` to include `'dialog'`; add `closable`/`zoomable` to `FrameState` and gate the icon draws on them; add `icon` to the `dialog` theme role. Correct the additive-edit inventory to list these `frame.ts` + `theme.ts` edits. | DRY (one frame drawer, already fidelity-verified); Dialog stays a thin subclass; fixes A+B at the source | Edits existing files → the plan's "additive-only" claim must be revised (honestly) |
| B | Dialog **overrides `draw()`** with its own dialog-role frame (close box, no zoom), not calling `drawFrame`. | Stays literally additive (subclass only) | Duplicates frame-drawing logic (DRY violation vs the global standard); re-opens the fidelity gate for a *second* frame drawer |

**Recommendation:** **Option A.** The codebase already owns one fidelity-verified frame drawer; forking a second (B) violates DRY and doubles the TV-decode surface. The honest cost of A is that the plan must stop claiming "additive-only / no reshaping" and instead enumerate the `frame.ts` (FrameRole + FrameState + icon gating) and `theme.ts` (`dialog.icon`) edits. Both are small and low-risk. — *Challenger: converged (MAJOR).*
`Confidence: High — the type facts are verified; only the DRY-vs-additive value call is a judgment.`
`Hardening: challenger reframed it as an unacknowledged either/or (additive-duplicative vs DRY-edits-files); folded into the options.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-002: Modal Dialog close-box / Esc bypasses `endModal` + `valid()` → stuck modality 🔴 CRITICAL

**Dimension:** 4 (Completeness) + 9 (Edge) + 13 (Stale Assumption)
**Location:** `03-05-dialog.md` ("on a command event whose command ∈ {ok,yes,no,cancel} (or close/Esc → treat as cancel): call valid()…"); PA-6 ("frame close [■] + Esc emit the negative terminating command"); `07-testing-strategy.md` ST-10 ("Cancel/Esc ⇒ cancel regardless").
**Codebase Evidence:**
- `packages/ui/src/window/window.ts:135` — `Window.onEvent` handles mouse-down; `:145` — `if (zone === 'close') this.close();`.
- `window.ts:109-111` — `close() { if (!this.closable) return; this.manager?.removeWindow(this); }` — removes the window directly, **emits no command**.
- No Esc handling anywhere in `Window` (onEvent only inspects `mouse`/`down`).
- `event/event-loop.ts:127-140` + `event/modal.ts` — the `execView` promise resolves **only** via `endModal` → `modal.end`.

**The Problem:** The plan assumes the Dialog's `postProcess` handler can catch a `close`/`Esc` command and route it through `valid()`→`endModal`. But the frame close `[×]` is consumed by inherited `Window.onEvent` → `this.close()` → `removeWindow` — a **mouse** path that emits no command, so the Dialog never sees it: `valid()` is skipped and `endModal` is never called → the awaited `execView` promise **never resolves** (stuck modality; input capture orphaned on a removed subtree). Esc has no mechanism at all. ST-10 (immutable oracle) therefore cannot pass as specified.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify that **Dialog overrides `onEvent`**: intercept the close-zone mouse-down and the raw `Esc` key, route both to the cancel→`valid()`(bypass)→`endModal(cancel)` path; do **not** delegate the close zone to `super.onEvent`/`this.close()`. Add a spec/impl test for close-box + Esc on a modal dialog. | Additive (subclass override + already-budgeted Commands/execView); makes ST-10 achievable; matches TV (close/Esc ⇒ cmCancel) | Dialog must carefully not double-handle (skip super for the close zone) |
| B | Make `Window.close()` emit `Commands.close` instead of removing directly, and bind a global `escape`→cancel in the loop keymap. | Centralizes close semantics | Edits existing `window.ts` + loop keymap (not additive); risks regressing existing Window close behavior/tests |

**Recommendation:** **Option A.** It keeps the change additive (a Dialog subclass override is exactly the seam the plan already relies on for `attachModalHost`) and localizes the fix to the new component, avoiding regressions in the shipped Window/desktop behavior that B risks. The plan must replace the "postProcess catches a close/Esc command" wording with the `onEvent` override + Esc-key handling, and add the close-box/Esc modal test. — *Challenger: converged (rated CRITICAL — silent hang + validation bypass).*
`Confidence: High — the close→removeWindow path and the missing Esc handling are both verified in source.`
`Hardening: challenger independently rated this the worst of the three (shipping blocker); raised from MAJOR to CRITICAL on that evidence.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-003: List selection index semantics under reordering are a foot-gun 🟡 MINOR

**Dimension:** 1 (Ambiguity) + 4
**Location:** `03-04-listview.md` ("focused/selected index the displayed order"; `onSelect?: (index: number)`); `03-06-kitchen-sink.md` S2 ("Selecting a sidebar row → `showStory(STORIES[i])`").
**Codebase Evidence:** `packages/examples/kitchen-sink/shell.ts:189,232` — the **existing** navigator passes the `Story` **object** (`handlers[story.id] = () => showStory(story)`), not an index; `shell.ts:44-55` groups by category (interleaved header rows).
**The Problem:** `items: Signal<T[]>` stays in source order, but `selected`/`focused` are defined as *display*-order indices. Under `sorted:true`, a consumer reading `items()[selected()]` gets the **wrong item**. Concretely, the navigator's `showStory(STORIES[i])` uses a sidebar **row** index over category-header-interleaved rows — headers shift the indices, so `STORIES[i]` is the wrong story. (Off by default, and example code, hence MINOR — but a latent public-API foot-gun.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Navigator carries a **row→Story model** (skip header rows), select→`showStory(row.story)`; and document/adjust the `ListView` select contract to also surface the **item** (not just a display index). | Removes the foot-gun; matches the existing object-passing pattern | Small API/story-spec addition |
| B | Keep index-only, but document loudly that under `sorted` the index is display-order and consumers must map back. | Minimal | Still foot-guns naive `items[selected]`; navigator still needs the row model anyway |

**Recommendation:** **Option A** for the navigator (it *must* map rows→stories regardless), and surface the selected **item** in `onSelect`/the select contract so sorted lists don't silently mis-index. — *no challenger (MINOR).*
`Confidence: Med — the navigator break is concrete; the generic-API part is a stated-but-risky contract, not a contradiction.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-004: `03-03` contradicts itself on Scroller keyboard 🟡 MINOR

**Dimension:** 3 (Logical Contradiction) + 12
**Location:** `03-03-scroller.md` — GATE-1 decode: "TScroller … **has no keyboard/wheel of its own** (those live in TScrollBar)"; Spec: "**the Scroller is focusable**; ↑↓/←→/PgUp/PgDn/Home/End adjust the owned bars."
**Codebase Evidence:** `03-02-scrollbar.md` already states the ScrollBar is "not focusable by default; the owning ListView/Scroller drive `value`" — i.e. the owner is meant to drive it.
**The Problem:** Within one doc the decode says the viewport has no keyboard, then the spec gives it keyboard. A GATE-2 reader diffing against `tscrolle.cpp` will flag an apparent decode/spec mismatch. The intent (jsvision's passive ScrollBar means the focusable owner must handle keys — a deliberate extension of TV, permitted by the fidelity rule for behavior) is fine but unstated.
**Options:** Single viable fix — add one sentence to `03-03` stating the Scroller's keyboard handling is an **intentional extension** (jsvision's ScrollBar is passive/non-focusable, so the owner drives it), consistent with the 03-02 note. *(Considered and dropped: making the ScrollBar focusable to match "keys live in TScrollBar" — contradicts PA-14 and the ListView model.)*
**Recommendation:** Add the reconciling sentence.
`Confidence: High.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-005: Frame close glyph mislabeled `[■]` (renders `[×]`) 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `02-current-state.md:79-80`, `00-ambiguity-register.md` PA-6, `03-05-dialog.md` — all write the close box as `[■]`.
**Codebase Evidence:** `packages/ui/src/window/frame.ts` — `const CLOSE_GLYPH = '×';` (the established RD-05 jsvision close glyph); Dialog reuses this chrome, so it renders `[×]`.
**The Problem:** The plan describes the Dialog's own rendered chrome as `[■]`, but the reused frame draws `[×]`. Minor, but the fidelity directive is about matching *rendered* output; the label should match what ships.
**Options:** Single viable fix — change the plan's `[■]` references to `[×]` (or annotate "`■` = the TV CP437 close byte, mapped to `×` in jsvision's frame").
**Recommendation:** Use `[×]` (with the TV-byte annotation for provenance).
`Confidence: High.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-006: TV citation line numbers drift (one wrong pointer) 🟡 MINOR

**Dimension:** 13 (accuracy of decoded facts)
**Location:** `02-current-state.md` §B + `03-02`/`03-04` TV-decode sections.
**Codebase Evidence (independent re-verification vs `/home/gevik/workdir/github/tvision`):** 6 exact, 3 approximate, 1 wrong:
- `tscrlbar.cpp` `drawPos` cited `:60` → actually defined `:65`; wheel `×3·arStep` cited `:148` → the multiply is `:169`.
- `tlstview.cpp` item-index/getColor cited `:77` (draw start) → the `item = j*size.y+i+topItem` line is `:110`, getColor 1–5 span `:88-95/:150`.
- **`selectItem` broadcasts `cmListItemSelected` cited `:213` (that's `handleEvent`) → actually `tlstview.cpp:357-359`.**
- All decoded *facts* are TRUE — incl. the PA-10 theme bytes (`app.h:145`=`0x13`, `:146`=`0x30 0x2F 0x3E 0x31`), `getPos` formula, `TDialog::valid`, `TGroup::valid`, command constants, glyph bytes.
**The Problem:** The fidelity directive requires citing the **exact** `file:line` of every decoded fact; four pointers are off (one materially). No design impact — the facts hold and each phase's GATE-1 re-opens these files — but the citations should be re-pinned.
**Options:** Single viable fix — re-pin the four line numbers during each phase's `BEFORE-decode` task (P1.1, P3.1) and correct them in the spec docs.
**Recommendation:** Re-pin at GATE-1 (already a planned task); no design change.
`Confidence: High — line numbers verified against the live source.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-007: `ModalHost.isCommandEnabled` defined but unconsumed 🔵 OBSERVATION

**Dimension:** 4 + 10 (no-dead-code)
**Location:** `03-01-foundations.md` F3 — `ModalHost { endModal; isCommandEnabled }`; the Dialog spec (`03-05`) only uses `endModal` + `valid()`.
**The Problem:** The seam exposes `isCommandEnabled`, but no plan doc shows the Dialog consuming it. Either it has a purpose (e.g. ignore a terminating command whose button is disabled — a reasonable TV-ish guard) or it's dead API that the coding standard says to drop.
**Recommendation:** Either specify the use (recommended: gate the terminating-command catch on `isCommandEnabled(command)`), or drop it from the seam.
`Confidence: Med.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

### PF-008: Wheel over the list/scroller body may not scroll 🔵 OBSERVATION

**Dimension:** 9 (Edge Cases) — "UX is the selling point"
**Location:** `03-02-scrollbar.md` (ScrollBar consumes wheel), `03-03`/`03-04` (owner drives the bar).
**The Problem:** `ScrollBar` is `focusable=false` and receives wheel only when the pointer hit-tests onto the bar. Wheel over the rows/content area (where users actually point) has no specified handler — TV scrolls on wheel-over-view. Likely a UX gap for the ListView/Scroller stories.
**Recommendation:** Have `ListRows`/`Scroller` also handle mouse-wheel (forward `±3·arrowStep` to the owned bar), so wheel-over-content scrolls.
`Confidence: Med.`

**User Decision:** ✅ Resolved — user accepted the recommendation ("yes, ok", 2026-07-01); fix applied to the plan docs.

---

## Verdict

**✅ PREFLIGHT PASSED** — all 8 findings resolved (all Option A / single-fix, user-accepted 2026-07-01),
fixes applied to the plan docs. The load-bearing gap (the **Dialog↔Window frame/close reuse**) is
closed: `frame.ts` is generalized to be dialog-aware (PF-001), `Dialog` overrides `onEvent` for the
frame-close/Esc → cancel→`valid()`→`endModal` path (PF-002), the "additive-only" inventory is corrected,
and the minors/observations (list index semantics, Scroller-keyboard reconciliation, `[×]` glyph, TV
citation re-pin, `isCommandEnabled` use, wheel-over-content) are addressed. New task **P4.3a** (frame
generalization) added; total 34 tasks.

### Applied edits (by file)
- `03-05-dialog.md` — frame-not-drop-in note + `frame.ts` generalization (PF-001); `onEvent` close/Esc
  override + `isCommandEnabled`-gated catch (PF-002/PF-007); close-box/Esc impl test; GATE-2 additions; `[×]`.
- `02-current-state.md` — corrected the additive-edit inventory (+`frame.ts`, +`dialog.icon`), the
  "almost-additive" framing, and the drawPos/wheel citations (PF-001/PF-005/PF-006).
- `03-04-listview.md` — `onSelect(index, item)` + sorted foot-gun note (PF-003); wheel-over-rows
  (PF-008); `selectItem` `:357` + draw item-index citations (PF-006).
- `03-06-kitchen-sink.md` — navigator row→Story mapping, never `STORIES[i]` (PF-003).
- `03-03-scroller.md` — Scroller keyboard/wheel reconciled as an intentional extension (PF-004/PF-008).
- `03-02-scrollbar.md` — drawPos `:65` / wheel `:169` citations (PF-006).
- `00-ambiguity-register.md` — PA-6 close glyph `[×]` (PF-005/PF-002).
- `99-execution-plan.md` — P4.3a (frame generalization) + expanded P4.3/P4.4 tests + corrected
  additive note + task count (34).

> A full iteration-2 re-scan was not run (fixes are doc-level and self-consistent); offer one before
> `exec_plan` if desired.
