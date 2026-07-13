# 07 — Testing Strategy

> Spec tests (`*.spec.test.ts`) are **immutable oracles** derived from RD-07 ACs + the TV source — never
> from the implementation. For TV-derived cells the C++ (`tinputli.cpp`/`tvalidat.cpp`/`tmulchkb.cpp`/
> `tcluster.cpp`) outranks a mis-decoded oracle (fidelity directive). Impl tests (`*.impl.test.ts`) cover
> internals/edges. Tests live in `packages/ui/test/` and `packages/examples/test/` only.

## Test files
- `controls.input-selection.{spec,impl}.test.ts` — selection model (ST-01…ST-04)
- `controls.input-clipboard.{spec,impl}.test.ts` — copy/cut/paste (ST-05…ST-06)
- `controls.picture.{spec,impl}.test.ts` — picture DSL + bounds (ST-07…ST-10)
- `controls.multi-check-group.{spec,impl}.test.ts` — cluster (ST-11…ST-12)
- `controls.caret.{spec,impl}.test.ts` — logical + hardware seam (ST-13…ST-14)
- `controls.completions.packaging.spec.test.ts` — re-exports, ≤500 lines, additive-seam (ST-15)
- `controls.completions.security.spec.test.ts` — paste/clipboard/mask bounds (ST-16)
- examples: `controls-demo.e2e` extended; `kitchen-sink.smoke` gains the MultiCheckGroup story

## Specification test cases

### Input selection (AC-1/2/3 · PA-1/6/9/12)
- **ST-01** (keyboard extend/collapse) — value `"hello world"`, curPos 0. Shift+Right ×3 ⇒ `selStart=0,
  selEnd=3`. Ctrl+Shift+Right ⇒ selEnd jumps to the start of `"world"` (space-delimited word, `=6`). Shift+End
  ⇒ selEnd=11. A plain Left ⇒ selection collapses (`selStart===selEnd`). *(tinputli.cpp:341-359,456-459,64-82)*
- **ST-02** (mouse drag) — press at col mapping to offset 2, drag to offset 7 ⇒ `selStart=2, selEnd=7`;
  double-click ⇒ select-all (`selStart=0, selEnd=value.length`). *(tinputli.cpp:312-338)*
- **ST-03** (select-all + edit-over-selection) — Ctrl+A on `"abc"` ⇒ whole value selected; typing `"X"` ⇒
  value `"X"`, curPos 1, selection collapsed (deleteSelect first, then insert, honoring
  `validator.isValidInput` + maxLength). Backspace over a selection deletes the selection only.
  *(tinputli.cpp:418-446,380-405)*
- **ST-04** (selection render) — with a 2-col selection and `sfSelected`, the buffer cells for
  `[selStart+1, selEnd+1)` carry the `inputSelection` role; unselected cells keep `inputNormal`/`inputSelected`.
  *(tinputli.cpp:152-157; role = PA-4/PA-6, exact byte confirmed at GATE-2)*

### Input clipboard (AC-4/5 · PA-7/8/9)
- **ST-05** (copy/cut) — caps with `osc.clipboard52=true`, selection `"ell"` of `"hello"`: Ctrl+Insert (or
  `Commands.copy`) ⇒ the loop's clipboard-write seam receives the OSC-52 base64 of `"ell"`; Shift+Delete
  (`Commands.cut`) ⇒ same **and** value becomes `"ho"`, re-validated, selection collapsed. With
  `clipboard52=false` ⇒ both are safe no-ops (empty sequence). Empty selection ⇒ cut is a no-op.
  *(tinputli.cpp:469-489; osc.ts:47-49)*
- **ST-06** (paste) — a `PasteEvent{text:"12ab34"}` to a focused `Input` with `validator=filter("0-9")`
  replaces any selection and inserts only `"1234"` (invalid chars dropped char-by-char), bounded by
  maxLength; Shift+Insert maps to the same path. *(tinputli.cpp:418-446; events.ts:131 cap)*

### picture(mask) (AC-6/7/8 · PA-2/3)
- **ST-07** (transient) — `picture("###-##")`: `isValidInput("12")` true, `isValidInput("1a")` **false**
  (prError), `isValidInput("123")` true (literal `-` auto-matched/inserted). *(tvalidat.cpp:149-153,371-463)*
- **ST-08** (blocking + autoFill default ON) — `picture("(###)###-####")`: `isValid("5551234")` false
  (incomplete), `isValid("(555)123-4567")` true; with default autoFill, `isValidInput("555")` appends the
  next literal(s). `isValid` never autoFills. *(tvalidat.cpp:156-162,552-599)*
- **ST-09** (DSL specials) — `picture("&&&")` accepts `"abc"` and stores `"ABC"`; `[###]###-####` accepts a
  value with or without the optional area code; `*3#` = exactly 3 digits. *(tvalidat.cpp:399,428,264-319)*
- **ST-10** (bounds-safety, PA-2) — a malformed mask (`"(##"` unbalanced) ⇒ `isValid` false + `error` set,
  no throw; `picture("*99999#")` ⇒ rejected at syntaxCheck (over `MAX_REPEAT`); a pathological input against
  a `*` mask terminates within the step budget (never hangs). *(tvalidat.cpp:519-550; PA-2)*

### MultiCheckGroup (AC-9/10 · PA-10)
- **ST-11** (cycle + bind) — states `" xX"` (selRange 3), 3 items, `value=[0,0,0]`. Space on the focused item
  ⇒ `value[i]` cycles `0→1→2→0`; the bound `Signal<number[]>` reflects each change; ↑↓ move focus; disabled
  items skipped. *(tmulchkb.cpp:88-103; tcluster.cpp nav)*
- **ST-12** (faithful visual) — each item renders `" [ ] "` with `states[value[i]]` at the box-center cell
  (col+2) and the label at col+5, in the `cluster*` roles; diffed against `drawMultiBox`.
  *(tmulchkb.cpp:65-68; tcluster.cpp:87-129)*

### Caret (AC-11/12 · PA-5/11)
- **ST-13** (logical) — a focused `Input`, value `"abcd"`, curPos 2 ⇒ the buffer marks the caret at
  `displayedPos(2)-firstPos+1`; it moves with the cursor and with horizontal scroll (firstPos>0).
  *(tinputli.cpp:160)*
- **ST-14** (hardware seam, additive) — driving the loop headlessly with a focused `Input`, `onCaret`
  receives the correct **absolute** cell each frame and `null` when focus is lost / no requester; the
  `onFrame`/`host.render`/`Host` signatures are unchanged (additive-seam oracle); `run()` re-applies the
  caret on `onResume`. **Partial-recompose persistence (PF-002):** with the focused `Input` unchanged,
  invalidate a *different* view (forcing a partial recompose that does not visit the `Input`) and assert the
  next `onCaret` still reports the `Input`'s correct absolute cell — the caret is derived by the loop from
  `focus.getFocused()` + `renderRoot.originOf(leaf)` (persisted origin), not collected during the compose
  walk, so it is not dropped when the `Input` is outside the dirty set. *(PA-5; render-root.ts:110,237-272;
  event-loop.ts:96-98)*

### Packaging + security (AC-13/14/15)
- **ST-15** (packaging) — `picture` + `MultiCheckGroup` have explicit named re-exports from `src/index.ts`;
  `input.ts` (and any split helper) each ≤ 500 lines; `yarn check:deps` passes; the caret/clipboard seams add
  only optional fields (no reshaped signature). *(AC-13)*
- **ST-16** (security) — pasted text is size-bounded (`PASTE_CAP_BYTES`) + validator/maxLength-filtered +
  `sanitize`-drawn; `setClipboard` output is base64 (no raw escape bytes); `picture` bounds recursion/iteration
  + indexing (no hang/overflow on a hostile mask/input). *(AC-15)*

## Red→green ordering
Per capability: write the ST spec file → confirm RED → implement (with the BEFORE-decode re-open) → confirm
GREEN → add impl tests (edges: empty value, curPos at ends, wide glyphs via wcwidth, maxLength boundary,
caret-vs-`►` overlap at the right edge (PF-008), caps off, malformed/empty masks, single-state cluster) →
run `yarn verify`.
