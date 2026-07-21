# 03-01 — The multi-click primitive (loop-owned `clickCount`)

> Realizes FR-1/FR-2/NFR-1. Decisions AR-1/AR-2/AR-3/AR-4/AR-13/AR-14. **No `@jsvision/core` change.**

## Surface added (additive only)

1. **`DispatchEvent.clickCount`** — `packages/ui/src/view/types.ts` (in the `DispatchEvent`
   interface, `:120`):

   ```ts
   /**
    * The consecutive same-cell click count for a mouse-`down` (1 = single, 2 = double, 3 = triple…),
    * computed once by the loop (double-click-activation FR-1/AR-3). Present only on a mouse-`down`
    * envelope during real dispatch; `undefined` for move/drag/up, wheel, keys, and bare
    * unit-constructed envelopes — so consumers read it optional (`ev.clickCount === 2`). A widget
    * activates a row on `=== 2` (AR-7). Same source/availability discipline as {@link emit}.
    */
   readonly clickCount?: number;
   ```

2. **`EventLoopOptions.now`** — `packages/ui/src/event/types.ts` (in `EventLoopOptions`, after the
   existing seams):

   ```ts
   /**
    * Multi-click clock (double-click-activation AR-4), default `Date.now`. Injected so headless
    * tests drive exact timestamps for the same-cell double-click window; mirrors `EditorOptions.now`.
    */
   now?: () => number;
   ```

3. **`MULTI_CLICK_MS`** — the shared `500` constant. Define once in the loop module and reuse the
   editor's value semantics (the editor keeps its own `MULTI_CLICK_MS` in `editor-mouse.ts:22`; a
   later convergence unifies them — out of scope here, AR-6). Document that both are 500.

## Loop-owned state + computation

In `EventLoop` (`event-loop.ts`), add private multi-click state mirroring the editor's fields:

```ts
private readonly clock: () => number;          // opts.now ?? Date.now  (set in the constructor)
private lastClickTime = Number.NEGATIVE_INFINITY;
private lastClickCell: Point = { x: -1, y: -1 };
private clickCount = 0;
```

The click-count is computed inside `dispatch(event)`'s `runTick` thunk — the single host→loop entry
(`event-loop.ts:121-125`, wired by `run()`'s `onInput → dispatch`) — where the loop **builds the
`DispatchEvent` and enqueues it onto the tick's cascade queue** (`this.queue.push(...)`); `route()`
runs later, draining that queue (`event-loop.ts:264-267`). Stamping at construction satisfies the
`readonly clickCount` field. The coordinates used are the **raw 1-based screen cell** the terminal
sent (`event.x`/`event.y`) — sameness is screen-cell sameness (AR-2), so no view-local translation is
needed (and none is available this early):

```ts
// inside dispatch(event)'s runTick thunk — compute for a mouse-`down`, then ENQUEUE (do NOT route directly):
let clickCount: number | undefined;
if (event.type === 'mouse' && event.kind === 'down') {
  const t = this.clock();
  const sameCell = event.x === this.lastClickCell.x && event.y === this.lastClickCell.y;
  this.clickCount = sameCell && t - this.lastClickTime <= MULTI_CLICK_MS ? this.clickCount + 1 : 1;
  this.lastClickTime = t;
  this.lastClickCell = { x: event.x, y: event.y };
  clickCount = this.clickCount;
}
this.queue.push({ event, handled: false, clickCount }); // clickCount undefined for non-down; readonly ⇒ set here
```

- **Only `down`** carries `clickCount`; move/drag/up/wheel/keys enqueue as today (`clickCount` `undefined`). *(AR-13)*
- The `{ ...ev, …seams }` spread in `route()` (`dispatch.ts:183`) copies `clickCount` into `ev2`, and
  the `hit-test.ts` `{ ...ev, local }` spreads (capture branch `:157`, down-bubble `:192`, non-down
  `:208` — the param is named `ev`, bound to the `ev2` `route()` passes in at `dispatch.ts:197`) carry
  it to the delivered envelope — **verified by inspection**; the ST-2 test pins it.
- **Placement:** `dispatch(event)` (`event-loop.ts:121-125`) is the exact site — it wraps every
  decoded `AppEvent` in `{ event, handled: false }` and **enqueues it onto `this.queue`** inside
  `runTick` (it does **not** call `this.route` directly; the drain loop routes each envelope). Compute
  the count there (narrowed to `type:'mouse' & kind:'down'`) and carry it on the enqueued envelope, not
  inside `route()` (so the accelerator synth-Alt key re-dispatch — keys only — is never involved).

## Why not a `RouteContext` seam

A seam (`ctx.clickCount(inner)`) would force `route()` to special-case mouse-downs and re-stamp
`ev2`. Pre-stamping on the envelope is simpler and rides the existing spread chain (AR-13). The loop
already owns all other mutable dispatch state (focus, capture, accelerator mode), so multi-click
state belongs there too.

## Interaction notes

- **Capture (drag/resize):** while a target is captured, the down still flows through the same wrap
  site, so `clickCount` is still computed and delivered (the capture branch spreads it). A widget
  mid-capture simply ignores `clickCount` unless it wants it.
- **Reset semantics:** a `down` on a different cell, or after > 500 ms, resets to 1 (the ternary). A
  non-down event never touches the state (matches the editor). So a single click, a pause, then a
  click on the same cell = two separate single-clicks (count 1 each). Correct.
- **Accelerator synth-Alt:** re-dispatches a **key** envelope (`dispatch.ts:167`) — never a mouse —
  so it cannot perturb multi-click state.
