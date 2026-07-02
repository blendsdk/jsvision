# Event Loop & Focus Hardening: Runtime Hardening (RD-13)

> **Document**: 03-06-event-loop-focus.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-02 (Critical), HR-10, HR-11 (Major), HR-38, HR-39, HR-42
> **Files**: `packages/ui/src/event/{hit-test.ts,focus.ts,dispatch.ts,event-loop.ts,modal.ts}`, `view/group.ts`

## Implementation Details

### HR-02 — Modal hit-testing uses the absolute origin (Critical)

**Defect** (`hit-test.ts:129-137`): the modal-scope branch builds `rootRect` from
`scopeRoot.bounds` directly and passes `bounds.x/y` as the absolute origin — but `View.bounds` is
**parent-relative** (`view/view.ts:37`). The capture branch six lines above already does it right
(`absoluteOrigin(ctx.captureTarget)`). Any app with a `MenuBar` (desktop at `y=1`) gets every modal
click off by one row; clicks on the dialog's real bottom row are dropped as "outside modal".

**Fix spec.** The modal branch computes the scope origin with `absoluteOrigin(scopeRoot)` —
mirroring the capture branch — for both the containment rect and the `topMost()` walk origin.
One-line class of fix + the offset-invariance oracle: the delivered `ev.local` must be identical
for the same dialog mounted at any ancestor offset (property-style: several offsets, one expected
local coordinate — AC-1).

### HR-10 — Removing the focused child heals `current` *(Decision per PA-10)*

**Defect** (`view/group.ts:68-75` `remove`, `:139-144` `unmountDynamicChild`): neither clears
`this.current`; the focus chain **is** those pointers (`event/focus.ts:73-80`), so `getFocused()`
returns the unmounted leaf and Phase-2 keeps delivering keys to it (repro: close the last window
while its `Input` is focused).

**Fix spec (PA-10).** Both removal paths check whether `current` points at (or descends into) the
removed child; if so they clear it and **re-home focus to the nearest remaining focusable sibling
in Tab order** (reusing the focus manager's existing candidate walk), clearing to `null` only when
no candidate remains. The re-home must run through the loop's focus mutator (so the focused flag +
focus-change signals stay consistent) when a loop is attached; a detached tree just clears
pointers.

### HR-11 — `isFocusable` requires mounted

**Defect** (`event/focus.ts:44-55`): an unmounted view has `parent === null` (`view.ts:215-222`) so
`noBlockingAncestor` trivially passes; `modal.ts:71-72` and `menu/controller.ts:234-236` rely on
"restore is a no-op if the target is gone" — false today: `focusView(detachedLeaf)` blurs the real
focused leaf while `setCurrentChain` no-ops, leaving `getFocused()` pointing at a view whose
`focused` flag is false.

**Fix spec.** `isFocusable` additionally requires the view to be **mounted** (reachable to the
scope/tree root). `focusView` on a detached target becomes a genuine no-op: no blur, no chain
mutation. This lands **before** HR-10 in the phase (HR-10's re-home builds on the corrected
predicate).

### HR-38 — TV-faithful cascade quit *(Decision per PA-2)*

**Defect** (`event-loop.ts:230-232`): `scopeRoot()` confines every sweep to the modal subtree; the
root `QuitCommandSink` is unreachable → a keymap-bound quit is silently dead during any modal.

**Fix spec (PA-2).** The loop special-cases the quit command while modals are active: it walks the
modal stack **top-down**, resolving each modal via the existing `endModal(quit-command)` path — a
`Dialog`'s `valid()` gate may veto (TV `valid(cmQuit)` semantics), stopping the cascade (app does
not quit, remaining modals stay). When the stack empties, the quit command proceeds to the root
sink. Every resolved modal's `execView` promise settles (no dangling awaits).

**TV decode (GATE 1) — required before implementation.** Decode `TProgram`'s `cmQuit` handling and
`TGroup::endModal`/`valid(cmQuit)` chain in `source/tvision/tprogram.cpp` + `tgroup.cpp` (exact
veto order: is `valid` consulted per-modal at `endModal` time, or swept once from the outermost
group?). The decode's `file:line` cites go into this section and the implementation JSDoc; the
BEFORE-decode/AFTER-diff tasks are in the execution plan. The C++ pins the veto semantics (PA-2).

**GATE-1/GATE-2 decode (recorded 2026-07-02):** `TProgram::handleEvent` (`tprogram.cpp:205-207`)
maps `evCommand cmQuit` → `endModal(cmQuit)`. `TGroup::endModal` (`tgroup.cpp:159`) sets `endState =
command` on the modal group, which terminates its `execute()` inner loop; the **outer** loop is
`do { … } while(!valid(endState))` (`tgroup.cpp:173-186`) — so **`valid` is consulted per-modal at
`endModal` time**, and a `False` keeps that modal's loop running (stays open). `TGroup::valid`
(`:566`) vetoes when `firstThat(isInvalid, &command) != 0` (any invalid child). **Order = top-down**
(the innermost modal's loop runs first). **AFTER-diff:** `EventLoop.cascadeQuit` walks the stack
top-down, checks each modal's duck-typed `valid(quit)` (veto → stop), `endModal(quit)`s otherwise,
then emits to the root sink when empty. Matches the decode (per-modal veto, top-down).

### HR-39 — Disabling the focused view evicts focus

**Defect** (`focus.ts:149-159`): `advance()` loses position when the focused child is no longer a
candidate (`indexOf → -1`); Phase-2 keeps delivering to a `disabled` view.

**Fix spec.** (a) Disabling the currently-focused view evicts focus (re-home per PA-10's mechanism —
next candidate, else null). (b) `advance()` recovers when the anchor is not in the candidate list:
resume from the nearest candidate by tree order instead of resetting/looping wrong. No key reaches
a disabled view.

### HR-42 — Sweep delivery skips unmounted views

**Defect** (`dispatch.ts:62-72,144-158`): `collectSweep` snapshots, then delivers without a
`mounted` check — a handler that removes a later view mid-sweep still delivers to it.

**Fix spec.** `deliver` guards each delivery with `view.mounted` (the property `routeContext`
already consults for capture, `event-loop.ts:237-239`). Snapshot semantics otherwise unchanged.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Click at any ancestor offset inside a modal | correct `ev.local` via `absoluteOrigin` | RD HR-02 (pinned) |
| Focused child removed | re-home to next focusable, else null | **PA-10** |
| Focus-restore to a detached view | genuine no-op | RD HR-11 (pinned) |
| Quit while modal(s) open | top-down `endModal(quit)` cascade; `valid()` may veto | **PA-2** |
| Focused view disabled | focus evicted; keys stop | RD HR-39 (pinned) |
| View unmounted mid-sweep | delivery skipped | RD HR-42 (pinned) |

## Testing Requirements

- Spec oracles ST-1.y (HR-02 + offset-invariance property), ST-3.a–b, ST-7.d–e,h
  ([07-testing-strategy.md](07-testing-strategy.md)).
- Impl tests: modal-in-modal offsets; remove-the-scope-root edge; quit veto at the middle of a
  3-deep modal stack; disable-then-Tab sequences; mid-sweep removal of earlier *and* later views.
