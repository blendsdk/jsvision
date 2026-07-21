# Modality, Loop Assembly, Packaging & Demo

> **Document**: 03-04-modality-loop-assembly-demo.md
> **Parent**: [Index](00-index.md)

## Overview

The async modal stack (`execView`/`endModal`, input capture, nested LIFO, save/restore-around-modal),
the `EventLoop` assembly (the loop-built `RenderRoot` + deferring scheduler), packaging, and the
headless `demo:events`. Covers AC-12, AC-13, AC-14, AC-15, AC-20.

## Architecture

### Modality (`event/modal.ts`)

A modal **frame** captures everything needed to push, capture input, and resolve:

```ts
interface ModalFrame<R> {
  readonly view: View;                 // the modal subtree root (mounted into the tree)
  readonly savedFocus: View | null;    // outer focused leaf, restored on close (AR-48, AR-53)
  readonly resolve: (result: R) => void;
}
```

The loop holds a `modalStack: ModalFrame<unknown>[]`; `modalStack.length > 0` ⇒ "modal active".

**`execView<R>(view): Promise<R>` (AR-53, PA-11/PF-009):**
```
execView(view):
  ensure view is mounted into the tree under the desktop/root scope (runWithOwner, AR-43)  # see note
  savedFocus = getFocused()
  return new Promise<R>(resolve => {
     runTick(() => {                                                     # PF-009: open paints one frame
        modalStack.push({ view, savedFocus, resolve })
        focus the modal: first focusable in `view` (or no focus)         # AR-53
     })
     # the runTick drains (empty queue) → onIdle → one flush, so the opened modal is composed
     # without relying on serialize()'s force-flush; subsequent dispatch confines to this subtree
     # until endModal
  })
```
> **One frame on open (PF-009).** `execView` is a public state mutator (pushes the modal stack,
> moves focus), so per PA-11 its synchronous push+focus runs **inside `runTick`** — exactly one
> coalesced frame paints the modal the moment it opens, even when the modal has no focusable child
> (the empty-queue tick still flushes). The `Promise` returned to the caller resolves later, on
> `endModal`. Earlier drafts omitted `execView` from the tick set and leaned on a later
> `serialize()` to force the paint (the anti-pattern PF-001 removed) — corrected here.

**`endModal<R>(result): void` (AR-53, PA-4):**
```
endModal(result):
  frame = modalStack.pop()             # LIFO (AR-15/nested)
  restore focus to frame.savedFocus (if still focusable)                 # AR-48, AR-53
  frame.resolve(result)                # resolves the awaited execView Promise
  (unmount of the modal view is the caller's/RD-05's concern; RD-04 pops + resolves)
```
`endModal` is called **explicitly** by app/modal handlers (PA-4) — RD-04 ships **no** built-in
Esc/`cmCancel`→`endModal` wiring (that is RD-05). Nested `execView` stacks; each `endModal` resolves
the matching promise in LIFO order, restoring each saved focus (AC-15).

**Input capture (AR-53, PA-6, PA-12):** the dispatch `scopeRoot` (03-02) and hit-test `scopeRoot`
(03-03) are the **top** modal frame's `view` subtree whenever the stack is non-empty. All
key/mouse/command phases run only within it — the pre/post sweeps walk `preOrder(scopeRoot)` and the
**Phase-2 focused-chain bubble is clamped to `scopeRoot`** (PA-12/PF-002), so the outer tree is truly
inert (the `parent`-pointer bubble can't escape the modal up to the desktop/root). A click outside
the modal subtree resolves to a null hit and is **ignored** (PA-6).

> **Mounting note (RT-candidate):** `execView` assumes `view` is part of the live tree so it
> composes + receives focus. The minimal RD-04 contract is that the caller has added the modal view
> to the tree (e.g. the desktop/root group) before/at `execView`; the demo adds it explicitly.
> Auto-add/auto-remove of the modal view is an RD-05 desktop concern. The exact wiring is recorded
> as an RT entry during execution if a finer seam is needed.

### Loop assembly (`event/event-loop.ts`)

`createEventLoop(viewport, opts)` (03-01) ties the parts together:
- Builds `renderRoot = createRenderRoot(viewport, { caps, theme, logger, schedule })` with a
  **deferring `schedule`**: the seam records that a flush is wanted but does **not** run it, so the
  root never self-flushes mid-tick; the loop calls `renderRoot.flush()` once at tick drain (AR-61,
  AR-64). (RD-03's `RenderRoot.scheduleFlush` coalesces via its `scheduled` flag, so a deferred
  no-op leaves `scheduled = true` and the explicit `flush()` clears it — `render-root.ts:173-177`.)
- Instantiates the focus manager (03-03), command registry + keymap glue (03-02), and modal stack
  (this doc), all as plain loop-owned structures (no signals, AR-58).
- Exposes the full `EventLoop` surface; `renderRoot` is exposed for host integration + tests (AR-61).

### Packaging (`event/index.ts`, `src/index.ts`)

- `event/index.ts` re-exports the RD-04 public surface: `createEventLoop`, the `EventLoop` /
  `EventLoopOptions` types, and the contract types `CommandEvent`/`AppEvent`/`DispatchEvent`
  (declared in `view/types.ts`, PA-8).
- `src/index.ts` adds explicit named re-exports from `event/index.js` (matching the layout/view
  convention) plus the additive `View` fields ride along with the existing `View` export.
- Pure TS, no third-party/native deps; `yarn check:deps` passes (AR-47).

## Implementation Details

### Demo (`packages/examples/event-demo/`, PA-9)

`main.ts` builds a small themed tree (a `Group` desktop with two focusable test `View`s + a modal
dialog view), then feeds a **synthetic** `dispatch()` sequence, printing an ASCII frame after each
step (via `renderRoot.buffer()` / `serialize()`), demonstrating: Tab moves focus; `Enter` →
`'ok'` command handled; `execView(dialog)` captures input and a dialog handler calls
`endModal('ok')`, resolving the awaited Promise. Deterministic + CI-able, mirroring `demo:view`
(AR-59). A `"demo:events": "tsx event-demo/main.ts"` script + a probe-style e2e assert exit 0 and a
non-empty frame.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `endModal` with an empty stack | no-op (nothing to pop/resolve) | AR-53 |
| `savedFocus` no longer focusable on close | restore skipped; focus left unchanged (no throw) | AR-48, PA-5 |
| Input while a modal is active | confined to the top modal subtree; outer inert | AR-53 |
| Click outside the modal subtree | null hit → ignored (bell → RD-05) | AR-53, PA-6 |
| Nested `execView`/`endModal` mismatch | strict LIFO pop; each resolves its own promise | AR-53 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- **Spec (ST-12,13,14,15):** `await execView` resolves on `endModal(result)`; modal input capture
  (outer receives nothing); outer focus restored on close; nested `execView` resolves LIFO with
  per-frame focus restore.
- **Spec (ST-20):** re-export shape (`createEventLoop`/`EventLoop`/`CommandEvent`/`DispatchEvent`
  from `@jsvision/ui`); `check:deps` passes; a dispatch/hit-test/flush are bounded single passes; no
  external-input/injection/auth surface (output guarded by RD-03→core `sanitize`).
- **E2E:** `demo:events` exits 0 and prints a non-empty themed frame showing focus + command + modal.
- **Impl:** `endModal` empty-stack no-op; nested stack ordering; deferring scheduler drives exactly
  one flush/tick across a modal open/close; `renderRoot` accessor returns the live root.
