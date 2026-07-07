# 03-02 — Armed mode (F12 toggle + router synth-alt intercept + lifetime)

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0
> Realizes **FR-2, FR-3, FR-4, FR-5, FR-7, FR-8**. Decisions AR-1, AR-3, AR-4, AR-5, AR-7, AR-10, AR-16, AR-17.

## Responsibility

Own a single "accelerator mode" flag on the event loop. **F12** toggles it (AR-1/AR-10). While on:
(a) the RenderRoot's `revealAccelerators` is set (03-01 lights up the overlay), and (b) the router
converts the next plain-letter keystroke into `{...ev, alt:true}` and dispatches it normally, so every
existing Alt-handler fires (AR-4). Sticky lifetime per AR-3.

## State (loop-owned, AR-17)

On `EventLoopImpl`:

```ts
private acceleratorMode = false;   // the single mode flag (reveal + arm)
private readonly revealKey: string; // from options, default 'f12' (AR-10)
```

`setAcceleratorMode(on)` (private): sets the flag, calls
`this.renderRoot.setRevealAccelerators(on, on ? this.scopeRoot() : null)` — passing the current
dispatch scope so reveal is modal-scoped (03-01 "Reveal scoping"; FR-4/AR-5) — and is always invoked
**inside `runTick`** so the recompose + frame coalesce (AR-14).

`EventLoopOptions.revealKey?: string | null` (AR-10) — default `'f12'`; `null` disables the feature
entirely (no intercept, no toggle).

## The router intercept (AR-16)

A new step in `route()` at `dispatch.ts:~129` — **after** the keymap-consume block (`:113-120`) and
Tab (`:122-128`), **before** the `ev2` enrichment (`:135`). It reads two additive `RouteContext`
fields (mirroring how `emit`/`focusView` were added, `dispatch.ts:135-145`, `event-loop.ts:299-346`):

```ts
// RouteContext additions (dispatch.ts:22-59), supplied by routeContext() (event-loop.ts)
acceleratorMode?: () => boolean;
toggleAcceleratorMode?: () => void;   // called for the trigger key
```

Logic (only when `revealKey !== null`), in `route()`:

1. **Toggle** — `inner.type === 'key' && inner.key === revealKey` (default `f12`) ⇒
   `ctx.toggleAcceleratorMode()`, set `ev.handled`, **return**. (Works whether currently on or off.)
2. **Armed dispatch** — else if `ctx.acceleratorMode()` is true and `inner.type === 'key'`:
   - **Esc** ⇒ dismiss (`toggleAcceleratorMode` off), `ev.handled`, return (AR-3).
   - a **plain single letter** (`inner.key.length === 1 && !inner.alt && !inner.ctrl`) ⇒ **dismiss
     first** (sticky ends on an action), then re-enter `route()` with a synthesized
     `{...inner, alt:true}` event so the normal 3-phase sweep fires the matching accelerator exactly
     like `Alt+letter` (AR-4). First-in-dispatch-order wins (collision = today's behavior).
   - **any other key** (function keys, navigation, already-Alt/Ctrl) ⇒ dismiss (non-accelerator key
     ends the mode, AR-3) and let it dispatch normally (do **not** consume).

**Menu precedence (FR-7/AR-7):** when a MenuBar menu opens, the controller takes over plain letters;
the app dismisses accelerator mode as the menu opens (the menu's own overlay visibility already gates
dispatch). Concretely: `MenuController` open ⇒ call `setAcceleratorMode(false)`. A synth-alt letter
that *opens* a top menu (via `MenuBar` preProcess) therefore both fires and dismisses — correct.

**Scope (FR-4/AR-5):** no extra work — the synthesized event runs through the same `route()` whose
`scopeRoot()` already clamps to the modal subtree (`event-loop.ts:294`). Reveal is likewise scoped
because a modal's `fullCompose` only paints the modal subtree's views on top.

## Re-dispatch mechanism

Prefer a direct recursive call: build `const alt = { ...inner, alt: true }` and route it through the
same path the loop uses (`route(alt, ctx)` / `EventLoopImpl.route`). Because arming already ran inside
`runTick`, the synthesized dispatch is part of the same tick and coalesces to one frame (AR-14).
Guard against re-entrancy: the synth event has `alt:true`, so it can never re-trigger the
`!inner.alt` armed branch (no infinite loop).

## Disabled/invisible (FR-6/AR-8)

Handled downstream: a disabled widget's `onEvent` already no-ops on activate, and reveal (03-01) skips
its emphasis. The intercept itself does no per-widget filtering — it just synthesizes and dispatches.

## Lifetime summary (AR-3, sticky)

| Event while armed | Result |
|---|---|
| F12 | toggle off (dismiss) |
| Esc | dismiss, consumed |
| plain accelerator letter | dismiss, then fire the accelerator (synth-alt) |
| plain non-accelerator letter | dismiss, key dispatched normally (nothing matches ⇒ no-op) |
| function/nav/modified key | dismiss, key dispatched normally |
| mouse click | dismiss (a click routes through `hitTestRoute`; add a dismiss on the mouse branch) |
| a menu opens | dismiss (AR-7) |

Dismiss always flips `revealAccelerators` off ⇒ the next `fullCompose` clears all underlines (FR-5,
no residual emphasis).

## Kitty upgrade seam (AR-13, NFR-4)

The trigger is a single named key (`revealKey`) + a `toggleAcceleratorMode` seam. When Kitty/CSI-u
(DEF-1) lands, real key-down/up for Alt can drive the same `setAcceleratorMode(true/false)` without
touching the reveal seam or the synth-fire path — hold-Alt simply becomes another toggle source.

## Files touched

| File | Change |
|------|--------|
| `event/event-loop.ts` | `acceleratorMode` + `revealKey` state; `setAcceleratorMode`; `EventLoopOptions.revealKey`; supply `acceleratorMode`/`toggleAcceleratorMode` in `routeContext()`; dismiss-on-menu-open + dismiss-on-mouse hooks |
| `event/dispatch.ts` | the intercept step at `:129`; two optional `RouteContext` fields (`:22-59`); mouse-branch dismiss |
| `event/types.ts` | `EventLoopOptions.revealKey?: string \| null` |
| `menu/controller.ts` (or app) | dismiss accelerator mode when a menu opens (AR-7) |
