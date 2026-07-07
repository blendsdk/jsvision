# Task T-04: Converge the editor multi-click detector onto `DispatchEvent.clickCount`

> **Type**: Task (lightweight) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.0
> **Progress**: 5/5 tasks (100%) · **Last Updated**: 2026-07-07 21:41
> **Discharges**: `double-click-activation` **AR-6** (the editor half — "editor/input converge onto
> `ev.clickCount` later"). Input is intentionally **out of scope** (D1 below).

## Objective

Delete the editor's private multi-click detector and read the loop-owned `DispatchEvent.clickCount`
(shipped by `double-click-activation`) instead. **Internal DRY refactor — no user-facing behavior
change:** the editor's double-click-word / triple-click-line / cyclic-repeat selection must stay
byte-for-byte identical. Removes the duplicate 500 ms timing loop + the parallel injectable clock so
there is one multi-click source of truth in the framework.

## Decisions (resolved with the user 2026-07-07)

- **D1 — Editor only; input deferred.** `Input`'s detector (`input.ts:448-449`, via `lastDownX`) is
  **positional and untimed** (a 2nd same-`x` down selects-all with *no* 500 ms bound) and carries
  HR-54 disarm semantics (a paste/edit resets it, `:286,306`). Converting it to the timed
  `clickCount === 2` would *change* behavior (add a window, alter disarm) — not a pure refactor — so
  it stays as-is and is tracked as a separate follow-up. (AR-6's input half remains open.)
- **D2 — Preserve the cyclic wrap.** The editor cycles `(n % 3) + 1` (caret→word→line→caret…,
  `editor-mouse.ts:52`); the loop's `clickCount` is **unbounded** (1,2,3,4…). The consumer re-wraps:
  `count = ev.clickCount === undefined ? 1 : ((ev.clickCount - 1) % 3) + 1`. This is exact — for the
  loop's `cc = 1,2,3,4,5,6,7` it yields `1,2,3,1,2,3,1`, identical to today's sequence (4th→single,
  5th→word, 6th→line). `undefined` (bare envelope / loop-less editor) ⇒ `1` (single caret), the AR-14
  contract the row family already uses.
- **D3 — Remove the dead apparatus.** Delete `EditorOptions.now` + `ed.clock`/`lastClickTime`/
  `lastClickCell`/`clickCount` (the clock is used *only* for multi-click — verified no other consumer).
  A standalone/loop-less editor no longer self-detects multi-click; callers/tests set `ev.clickCount`
  on the envelope (AR-14). `@jsvision/ui` is private pre-release, so trimming the unused public
  `EditorOptions.now` field is clean. **Cross-package reach:** `@jsvision/files`'s
  `FileEditorOptions extends EditorOptions` (`packages/files/src/editor/file-editor.ts:32`, and
  `OpenFileInEditorOptions extends FileEditorOptions`), so removing `now` also narrows those inherited
  interfaces — verified safe (no `@jsvision/files` source/test passes `now`; `FileEditor extends Editor`
  forwards via `super(options)` which stays assignable) and covered by T-04.5's `packages/*` verify.

## Current state (grounded @ 2026-07-07)

- **Detector:** `editor-mouse.ts:48-58` — on a `down`, `sameCell && t - lastClickTime <= MULTI_CLICK_MS`
  bumps `ed.clickCount = (n % 3) + 1`; `2 ⇒ SM_DOUBLE` (word), `3 ⇒ SM_TRIPLE` (line);
  `MULTI_CLICK_MS = 500` (`:22`); keyed on `ev.local`.
- **State/clock:** `editor.ts:115-120` (`clock`/`lastClickTime`/`lastClickCell`/`clickCount`) +
  `:149` (`this.clock = options.now ?? Date.now`); option declared at `editor-types.ts:34-35`.
- **The primitive it converges onto:** `DispatchEvent.clickCount` — the loop stamps a consecutive
  same-**screen-cell** count on every mouse-`down` within 500 ms (`event-loop.ts` `dispatch()` +
  `MULTI_CLICK_MS`). The editor already receives it on its `down` envelopes today (it just ignores it).
- **Consumers of `EditorOptions.now`:** the two editor test harnesses (`editor.spec`/`editor.impl`
  `mountEditor({ now })`) + `examples/editor-demo/main.ts:62`. `edit-window.ts`, `tvedit-demo`, and the
  `editor.story` do **not** reference `now` (safe). `@jsvision/files` extends `EditorOptions` (see D3) but
  passes no `now` (safe). Repo-wide `now:` sweep confirms this is the complete set.

## Accepted equivalences / edge cases (no behavior change in practice)

- **Screen-cell vs view-local.** The loop compares raw screen `event.x/y`; the old detector compared
  `ev.local`. They differ only by the editor's screen origin (a constant translation), so "same cell
  clicked twice" is preserved — the origin can't move between two clicks 500 ms apart in normal use.
- **Global vs per-editor counter.** The loop's `clickCount` is one global counter; a different screen
  cell (or >500 ms) resets it. Two views can't occupy the same screen cell simultaneously (top-most
  wins the hit-test), so no cross-view false double-click. Pathological only if a view is *moved* onto
  the prior click's cell within 500 ms — accepted. The symmetric case (a false *negative*): a `down` on
  a *different* screen cell (another widget/window) landing *between* two same-cell editor clicks within
  500 ms resets the global counter (`event-loop.ts:150`), so the 2nd click reads single where the old
  per-editor detector — updated only on editor downs — read a double. Not a real double-click gesture
  (nothing is clicked between the two presses of one), so accepted.

## Tasks

- [x] **T-04.1** Baseline oracle — run the editor suite; confirm today's behavior GREEN and record it
      as the invariant to preserve: `editor.spec` **ST-10** (double-click → exact word; triple-click →
      whole line incl. EOL) + `editor.impl` (4th same-cell click → single caret; a different-cell 2nd
      click → reset to single). No code change.
- [x] **T-04.2** Implement the convergence — `editor-mouse.ts`: replace the timing block (`:49-54`)
      with `const count = ev.clickCount === undefined ? 1 : ((ev.clickCount - 1) % 3) + 1;` feeding the
      existing `SM_DOUBLE`/`SM_TRIPLE` mapping (D2); delete `MULTI_CLICK_MS` (`:22`). Update the file
      JSDoc — drop the "editor-local multi-click detector (PA-18)" prose, cite this convergence + the
      loop primitive. `ed.selecting → SM_EXTEND` and the drag/capture paths are untouched.
- [x] **T-04.3** Remove the dead apparatus (D3) — `editor.ts`: delete `clock`/`lastClickTime`/
      `lastClickCell`/`clickCount` (`:115-120`) + the `this.clock = options.now ?? Date.now` line
      (`:149`); `editor-types.ts`: remove the `now` field + its JSDoc (`:34-35`). Fix any JSDoc that
      referenced the editor-local clock. **Also update the now-stale event-package JSDoc** (this task
      discharges AR-6's editor half and removes `EditorOptions.now`): `event/event-loop.ts:33-37` —
      drop the "editor keeps its own equal `MULTI_CLICK_MS` (`editor-mouse.ts:22`) pending a later
      convergence (AR-6)" prose, state the convergence is done; `event/types.ts:53-56` — drop the
      "mirrors `EditorOptions.now`" clause. Typecheck must stay clean (no dangling refs).
- [x] **T-04.4** Migrate consumers + lock the wrap — `editor.spec.test.ts` + `editor.impl.test.ts`:
      move `now` from the **editor** options to the **`createEventLoop`** options inside `mountEditor`
      (the behavioral assertions are unchanged — the immutable oracle is preserved, only the clock's
      injection point moves, AR-14). Add one `editor.impl` assertion pinning the cyclic wrap: a **5th**
      consecutive same-cell click → word again (proves `((cc-1)%3)+1`). `examples/editor-demo/main.ts`:
      move the deterministic `now` from the `Editor` to its event loop (or drop it).
- [x] **T-04.5** Full verify — `TUI_SKIP_PERF=1 yarn verify` + `yarn lint`. Confirm the editor oracle
      still GREEN (behavior preserved), zero other-package regressions, and no `EditorOptions.now`
      references remain (`grep`). CHANGELOG note optional (private pre-release; field removal).

## Task ledger

| # | Task | Status | Implemented | Verified |
|---|------|--------|-------------|----------|
| T-04.1 | Baseline oracle recorded | [x] | 2026-07-07 21:35 | 2026-07-07 21:35 (41 editor tests GREEN) |
| T-04.2 | Converge `editor-mouse.ts` (read `clickCount` + wrap) | [x] | 2026-07-07 21:40 | 2026-07-07 21:41 |
| T-04.3 | Remove `now`/clock/state (`editor.ts`+`editor-types.ts`) + refresh stale `event/` JSDoc | [x] | 2026-07-07 21:40 | 2026-07-07 21:41 |
| T-04.4 | Migrate test harness + demo; pin cyclic wrap | [x] | 2026-07-07 21:40 | 2026-07-07 21:41 |
| T-04.5 | Full verify + lint | [x] | 2026-07-07 21:41 | 2026-07-07 21:41 (verify 11/11, lint clean, 42 editor GREEN, no `now:` residuals) |

**Verify**: `TUI_SKIP_PERF=1 yarn verify` then `yarn lint`.
