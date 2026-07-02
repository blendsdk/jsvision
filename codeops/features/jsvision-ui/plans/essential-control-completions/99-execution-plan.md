# 99 — Execution Plan

> **Implements**: jsvision-ui/RD-07 · **CodeOps Skills Version**: 3.1.0
> **Progress**: 18 / 32 tasks (56%) · **Last Updated**: 2026-07-02

Spec-first per capability: **spec tests → RED → implement → GREEN → impl tests → verify**. Every TV-derived
component carries a **BEFORE-decode (GATE-1)** and **AFTER-diff (GATE-2)** task (fidelity directive,
`codeops/tv-fidelity-gate.md`). Commit after each verified task via **/gitcm** (or /gitcmp) per the active
mode. **Verify command**: `yarn verify` (targeted: `yarn workspace @jsvision/ui test`).

## Phases

| Phase | Title | TV-derived | Output |
|-------|-------|:---:|--------|
| 0 | Foundations (additive core + seams) | color only | `inputSelection` role · `Commands.cut/copy/paste` · caret+clipboard seam scaffolding |
| 1 | Input selection + logical caret | ✅ | selection model + logical caret in `input.ts` |
| 2 | Input clipboard (copy/cut/paste) | ✅ | OSC-52 write + bracketed paste |
| 3 | picture(mask) validator | ✅ | `controls/validators/picture.ts` (bounds-safe) |
| 4 | MultiCheckGroup (+ kitchen-sink story) | ✅ | `controls/multi-check-group.ts` + story + smoke |
| 5 | Hardware caret wiring + demos | seam | `run()`/`onResume` wiring · extended `demo:controls` + `Input` story |
| 6 | Final gate | — | full verify + AFTER-diff sign-off |

---

## Phase 0 — Foundations (additive)
- [x] **P0.1** ✅ 2026-07-02 BEFORE-decode (GATE-1): re-open `tinputli.cpp:84,145-161` — confirm the exact `cpInputLine`
  bytes + the color-3 slot → resolve the `inputSelection` attribute byte through `cpGrayDialog`→`cpAppColor`
  (resolves the PA-6 ⚠). **Also resolve `getColor(1)` and `getColor(2)` for a gray-dialog-hosted input
  (PF-004):** `cpInputLine` has color-1==color-2==`0x13`, so TV appears to draw a focused and unfocused input
  **identically** — which conflicts with the shipped RD-06 `inputSelected` (slot 20, `0x2F` green,
  `theme.ts:90-91`). If confirmed, **record it and surface a scoped `inputSelected` fidelity decision** (fixing
  it may ripple into RD-06 goldens — do NOT silently change shipped color; raise it as its own choice). Record
  the full decode in the code JSDoc.
- [x] **P0.2** ✅ 2026-07-02 Add the additive `inputSelection` role to core `Theme` + `defaultTheme` (`color/theme.ts`)
  with the P0.1 value; add `cut`/`copy`/`paste` to `ui/status/commands.ts` (PA-4/PA-7). Verify (typecheck +
  existing golden/theme tests still green).
- [x] **P0.3** ✅ 2026-07-02 Add the additive seam scaffolding (no behavior yet): `View.desiredCaret(): Point|null`
  (default null); `RenderRoot.originOf(view): Point|null` (pure origin-cache lookup, PF-002 — **not** a
  compose-time caret collector); `EventLoop.onCaret?`/`writeClipboard?` options + the
  `DispatchEvent.setClipboard?` envelope field sourced in `routeContext` (PA-5, 03-04/03-01). Verify.

## Phase 1 — Input selection + logical caret ✅TV
- [x] **P1.1** ✅ 2026-07-02 BEFORE-decode (GATE-1): re-open `tinputli.cpp:203-237,341-359,456-459,64-82,152-160`; record
  the selection/caret decode in `input.ts` JSDoc.
- [x] **P1.2** ✅ 2026-07-02 Spec tests ST-01…ST-04 + ST-13 (`controls.input-selection.spec` + `controls.caret.spec`
  logical) → confirmed **RED**.
- [x] **P1.3** ✅ 2026-07-02 Implement selection state + keyboard (Shift/Ctrl-Shift/Home/End/Ctrl+A, collapse,
  edit-over-selection) + mouse (press/drag/double-click PA-15) + `adjustSelectBlock`/`deleteSelect`/`prevWord`/
  `nextWord`/`posFromMouse` (extracted `input-selection.ts`, `input.ts` = 475 lines) + selection render
  (`inputSelection` role) + logical caret cell + `desiredCaret()` override → **GREEN**.
- [x] **P1.4** ✅ 2026-07-02 Impl tests (edges: curPos at ends, wide glyphs (code-unit v1), maxLength, firstPos scroll, caret-vs-`►`
  overlap at the right edge (PF-008), pure helpers).
- [x] **P1.5** ✅ 2026-07-02 AFTER-diff (GATE-2): selection band cols `[l+1,r+1)` in `inputSelection` (`0x2F`
  white-on-green = `getColor(3)`) ↔ `tinputli.cpp:152-157`; caret col `displayedPos(curPos)-firstPos+1` ↔
  `:160`. Caret preserves the glyph beneath (arrow/char) + reverses colours — TV's hardware cursor never
  erases a glyph (PF-008; the in-buffer caret is our DEF-19a extension). `yarn verify` green.

## Phase 2 — Input clipboard ✅TV
- [x] **P2.1** ✅ 2026-07-02 BEFORE-decode (GATE-1): re-open `tinputli.cpp:469-489` (cmCut/Copy/Paste, empty-selection).
- [x] **P2.2** ✅ 2026-07-02 Spec tests ST-05…ST-06 (`controls.input-clipboard.spec`) → confirmed **RED**.
- [x] **P2.3** ✅ 2026-07-02 Implement copy/cut (via `ev.setClipboard` → `setClipboard(text,caps)`) + paste
  (`type==='paste'` bracketed, replace selection, char-by-char validate) + the chords Ctrl+Ins/Shift+Ins/Shift+Del +
  `Commands.copy/cut/paste` handling → **GREEN**. **PA-16**: Shift+Ins/`Commands.paste` are no-ops (clipboard
  read deferred, **DEF-25**); real paste = the bracketed `PasteEvent`. Clipboard concern extracted to
  `input-clipboard.ts` + more selection math to `input-selection.ts` (`input.ts` = 483 lines, ≤500).
- [x] **P2.4** ✅ 2026-07-02 Impl tests (caps off = no-op, empty selection, paste filtering, maxLength on paste, pure helpers).
- [x] **P2.5** ✅ 2026-07-02 AFTER-diff (GATE-2): copy = `setText(selStart..selEnd)` (`:475-478`); cut = write +
  `deleteSelect` + collapse (`:479-485`); empty-selection cut = no-op (`:205` guard); paste = replace-selection
  + char-by-char validate (`:418-446`). `yarn verify` + `lint` green.

## Phase 3 — picture(mask) validator ✅TV
- [x] **P3.1** ✅ 2026-07-02 BEFORE-decode (GATE-1): re-open `tvalidat.cpp:149-162,264-599` (state machine + autoFill +
  syntaxCheck); recorded in `picture.ts` JSDoc.
- [x] **P3.2** ✅ 2026-07-02 Spec tests ST-07…ST-10 (`controls.picture.spec`) → written; ST-09 `[###]` oracle corrected
  to `[(###)]` (greedy-optional-group fidelity, C++ outranks the mis-decoded cell).
- [x] **P3.3** ✅ 2026-07-02 Implement `picture(mask, autoFill=true)`: the `process`/`scan`/`group`/`iteration`/
  `checkComplete` machine over JS strings + autoFill + `syntaxCheck`, **bounds-safe** (PA-2: `MAX_REPEAT=1024`,
  step budget `64*(m+i)+4096`, guarded indexing, unbounded-`*` spin-guard); re-exported from `validators/index.ts`
  + `controls/index.ts` + `src/index.ts` → **GREEN**. autoFill delivered via the additive `Validator.fill` (PA-17),
  wired into `Input.insertPrintable`/`pasteText`.
- [x] **P3.4** ✅ 2026-07-02 Impl tests (each special char `#?&!@`, alternation, nested/required/optional groups, `;`
  escape, empty/malformed masks, `*N` boundary 1024/1025, DoS masks terminate, autoFill delivery through `Input`).
- [x] **P3.5** ✅ 2026-07-02 AFTER-diff (GATE-2): the machine mirrors `tvalidat.cpp` process/scan/group/iteration/
  checkComplete/syntaxCheck 1:1; bounds are PA-2 additions; greedy-optional-group verified against `:322-336`.
  `yarn verify` + `lint` green.

## Phase 4 — MultiCheckGroup + story ✅TV
- [ ] **P4.1** BEFORE-decode (GATE-1): re-open `tmulchkb.cpp:65-103` + `tcluster.cpp:87-129,39` (box/marker/
  colors); record in `multi-check-group.ts` JSDoc.
- [ ] **P4.2** Spec tests ST-11…ST-12 (`controls.multi-check-group.spec`) → **RED**.
- [ ] **P4.3a** **Cluster base refactor (PF-001, prerequisite):** generalize `Cluster` to TV's marker-**string**
  model — replace `mark(i): boolean` + `ClusterBox.on/off` with `markIndex(i): number` + `ClusterBox.markers:
  string`; `draw()` paints `box().markers[markIndex(i)]` at col 2 (`tcluster.cpp:87-129`). Migrate `CheckGroup`
  (`markers:' X'`) + `RadioGroup` (`markers:' •'`) — a pure refactor, identical rendered output (03-03
  §"Cluster base change"). Existing RD-06 cluster specs stay GREEN.
- [ ] **P4.3b** Implement `MultiCheckGroup extends Cluster` (`Signal<number[]>` + `states`, cycle
  `(state+1)%selRange`, `markIndex(i)=value()[i]`, `box()={' [ ] ', markers:states}`, marker@col+2 visual,
  `cluster*` roles); re-export from `controls/index.ts` + `src/index.ts` → **GREEN**.
- [ ] **P4.4** Impl tests (single-state, disabled skip, hotkey, wrap).
- [ ] **P4.5** **Kitchen-sink story** `stories/multi-check-group.story.ts` + `stories/index.ts` line + bound-
  state echo; passes `kitchen-sink.smoke.spec` (NON-NEGOTIABLE).
- [ ] **P4.6** AFTER-diff (GATE-2): diff box/marker/label columns + colors vs `drawMultiBox`. `yarn verify`.
- [ ] **P4.7** **RD-06 regression (PF-001):** `controls.cluster.*` + `controls.foundation.*` specs and the
  check/radio goldens still green after the P4.3a base refactor (no public-API or rendered-output change).

## Phase 5 — Hardware caret wiring + demos
- [ ] **P5.1** Spec test ST-14 (`controls.caret.spec` hardware seam: `onCaret` payload + additive-seam
  oracle + `onResume` re-apply) → **RED**.
- [ ] **P5.2** Wire the caret in the **loop, post-`flush()`** (PF-002): `EventLoop` computes the absolute cell
  from `focus.getFocused()` + `leaf.desiredCaret()` + `RenderRoot.originOf(leaf)` and fires `onCaret` right
  after `onFrame` (runTick/resize/mount) — no compose-time collection; + `writeClipboard` firing + `run()`
  co-owns the stream, writes `cursor.*`/clipboard post-`host.render`, re-applies on `onResume` (03-04) →
  **GREEN**.
- [ ] **P5.3** Extend `examples/controls-demo/` (`demo:controls`): steps for selection→copy→paste, a
  `picture` field rejecting/auto-filling, a `MultiCheckGroup` cycling (ASCII frame per step) + its e2e.
- [ ] **P5.4** Extend the `Input` kitchen-sink story: selection highlight, copy/paste, a `picture` field,
  the visible caret. Smoke passes.

## Phase 6 — Final gate
- [ ] **P6.1** Packaging spec ST-15 + security spec ST-16 green; confirm every `03-*` AFTER-diff recorded.
- [ ] **P6.2** Full `yarn verify` + `yarn test:e2e` + `yarn check:deps` + `yarn lint` + `yarn gate`. Update
  `DEFERRED.md` (DEF-01/02/03/19 → Shipped; add DEF-21/22/25) + the roadmap (RD-07 → Done).

---

## Master Progress Checklist
Phase 0: [x] P0.1 [x] P0.2 [x] P0.3
Phase 1: [x] P1.1 [x] P1.2 [x] P1.3 [x] P1.4 [x] P1.5
Phase 2: [x] P2.1 [x] P2.2 [x] P2.3 [x] P2.4 [x] P2.5
Phase 3: [x] P3.1 [x] P3.2 [x] P3.3 [x] P3.4 [x] P3.5
Phase 4: [ ] P4.1 [ ] P4.2 [ ] P4.3a [ ] P4.3b [ ] P4.4 [ ] P4.5 [ ] P4.6 [ ] P4.7
Phase 5: [ ] P5.1 [ ] P5.2 [ ] P5.3 [ ] P5.4
Phase 6: [ ] P6.1 [ ] P6.2

**Totals:** 7 phases · ~18 sessions · **32 tasks** · est. **20–32 h**. Spec-first (ST-01…ST-16 ↔ AC-1…AC-15);
PA-1…PA-13 (4 user + 9 dominant/source); grounded in the RD-07 preflight recon + 3 GATE-1 TV decodes.
