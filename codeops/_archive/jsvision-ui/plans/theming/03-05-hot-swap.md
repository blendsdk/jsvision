# Hot-swap: Theming

> **Document**: 03-05-hot-swap.md
> **Parent**: [Index](00-index.md)

## Overview

Runtime theme replacement: `RenderRoot.setTheme` swaps the active theme and forces one coalesced full
recompose; `EventLoop.setTheme` wraps it in a tick so the frame reaches the host regardless of call
context; `Application.setTheme` forwards to the loop seam. This is the only behavioral change outside
`@jsvision/core` — every widget picks up the new colors automatically on the next compose (nothing in
any widget changes).

## Architecture

### Current Architecture
`RenderRootImpl.theme` is `private readonly` (`render-root.ts:225`); there is no way to change it.
The loop builds the render root with a **no-op `schedule`** (`event-loop.ts:193-195`) so only the
loop repaints, once per `runTick` via the trailing `flush()`+`onFrame()` (`:367-369`). The render root
already has the exact "a compose input changed → one full recompose" pattern: `setRevealAccelerators`
(`:292`) mutates a field and calls `markRelayout()` (`:300`).

### Proposed Changes (PA-3)
`setTheme` mirrors `setRevealAccelerators`: make `theme` a mutable field, assign it, call
`markRelayout()`. The reflow that `markRelayout` triggers is a **harmless deterministic no-op on
geometry** (a theme swap changes no layout — exactly as the accelerator overlay already relies on),
and `fullCompose` re-resolves every cached compose context against the new colors in one frame. No new
diffing: `serialize()` already emits only the cells that changed.

## Implementation Details

### `RenderRoot.setTheme` (AR-276)

`packages/ui/src/view/render-root.ts`:

```ts
// interface RenderRoot — add:
/** Replace the active theme and force one coalesced full recompose. … */
setTheme(theme: Theme): void;

// class RenderRootImpl:
private theme: Theme;                 // was: private readonly theme
setTheme(theme: Theme): void {
  this.theme = theme;
  this.markRelayout();                // one coalesced full recompose (same path as setRevealAccelerators)
}
```

`Theme` is already imported (`render-root.ts:16`). All existing `this.theme` reads (`composeView`
calls at `:354`/`:377`, `drawDropShadow`) are unaffected by the `readonly` removal.

### `EventLoop.setTheme` (AR-279)

`packages/ui/src/event/types.ts` — add to the `EventLoop` interface: `setTheme(theme: Theme): void;`
(import `Theme` from `@jsvision/core`).

`packages/ui/src/event/event-loop.ts`:

```ts
setTheme(theme: Theme): void {
  // The render root is built with a no-op schedule, so a bare renderRoot.setTheme() would mark dirty
  // but not repaint until the next input tick. Wrapping in a tick reuses the trailing flush()+onFrame()
  // push, so the swap repaints immediately from any call context (a command handler, a bare imperative
  // call between ticks, an async callback).
  this.runTick(() => this.renderRoot.setTheme(theme));
}
```

Because `renderRoot.setTheme` only marks dirty under the no-op schedule (it does **not** self-flush),
there is exactly **one** paint per swap — `runTick`'s trailing `flush()` (`:367`). A re-entrant call
(`setTheme` from inside an `onCommand` handler) joins the active tick and still collapses to one frame.

### `Application.setTheme`

`packages/ui/src/app/application.ts` — add to the `Application` interface and the returned object:

```ts
setTheme(theme: Theme): void;                       // interface
setTheme: (theme) => loop.setTheme(theme),          // returned object — forwards to the loop seam
```

`Theme` is already imported (`application.ts:10`). It forwards to `loop.setTheme` (NOT straight to the
render root — a direct render-root call would mark dirty into the no-op schedule and not repaint until
the next input tick).

## Integration Points
- `RenderRoot.setTheme` is public on an already-exported interface (no barrel change).
- `Application.setTheme` is the primary consumer path for the designer (`03-06`) and app code.
- `DrawContext.color()`/`role()` are unchanged — widgets read the swapped theme on the next compose.

## Code Examples

```ts
import { createApplication } from '@jsvision/ui';
import { nordTheme } from '@jsvision/core';

const app = createApplication({});
// … populate desktop …
app.onCommand('theme:nord', () => app.setTheme(nordTheme)); // repaints in one coalesced frame
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| `setTheme` called between input ticks (async / bare imperative) | `runTick` wrapper pushes the frame to the host anyway | AR-279, PA-3 |
| `setTheme` called from inside an `onCommand` handler | Re-entrant `runTick` joins the active tick → one coalesced frame | AR-279 |
| A swapped theme has a malformed color | `encodeStyle` degrades to no-color (crash-safe render loop) — never throws mid-frame | AR-273 |

> **Traceability:** `00-ambiguity-register.md` (PA-3) + `../../requirements/00-ambiguity-register.md` (AR-276/AR-279).

## Testing Requirements
- `renderRoot.setTheme(nordTheme)` after mounting `defaultTheme` → exactly one recomposed frame whose
  buffer differs; `originOf` for an unchanged view is preserved (ST-28).
- `EventLoop.setTheme`/`Application.setTheme` push the frame to the host (`onFrame` fires) even when
  called **outside** an input tick — a bare `app.setTheme(nordTheme)` repaints the host buffer (ST-29).
