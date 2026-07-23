# Component: Router Core

> **Document**: 03-02-router-core.md
> **Parent**: [Index](00-index.md)
> **Covers**: R-2, R-4, R-5, R-6 · AR-3, AR-7, AR-8, AR-9, AR-12, AR-13, AR-14, AR-16, AR-19

The `packages/ui/src/router/` subsystem (AR-15): the retained screen stack, typed navigation, keep-alive,
`location()`, and focus restore. Built entirely on the verified substrate (`02-current-state.md`).

## Public API

```ts
type Routes = { home: void; detail: { id: number }; /* … */ };

const router = createRouter<Routes>({
  initial: { name: 'home' },                       // AR-14 structured
  routes: {
    home:   { build: (ctx) => ({ view: new HomeScreen(),        status: [...] }) },
    detail: { build: (ctx) => ({ view: new DetailScreen(ctx.params.id) }),
              keepAlive: false,                     // AR-7 (default)
              serialize: (p) => `id=${p.id}`,       // AR-9 designed, restore→#19
              parse:     (s) => ({ id: Number(new URLSearchParams(s).get('id')) }) },
  },
});

router.push('detail', { id: 42 });   // typed against Routes (AR-8)
router.back();                        // no-op at root (AR-12)
router.replace('home');
router.reset('home');
router.location();                    // reactive → { name:'detail', params:{id:42} } (AR-9)
router.canGoBack();                   // reactive → boolean
```

`createRouter<Routes>` returns a **`Router<Routes>` instance** — a subclass of `Group` (so it *is* the
body `View`, swapping its single visible screen) that also carries the navigation API
(`push`/`back`/`replace`/`reset`/`location`/`canGoBack`) and implements `ChromeHostAware` (AR-21). It
is one object: `content: router` passes the `Group`; `router.push(...)` calls the API.

## Types

```ts
interface RouteContext<P> { params: P; }
interface ScreenBundle {                 // AR-3
  view: View;
  status?: View[];
  menu?: MenuItem[];
}
interface Route<P> {                     // AR-7, AR-9, AR-14
  build: (ctx: RouteContext<P>) => ScreenBundle;
  keepAlive?: boolean;
  focusKey?: (view: View) => string;     // AR-19 opt-in exact restore for disposed screens
  serialize?: (params: P) => string;     // AR-9 designed; restore→#19
  parse?: (s: string) => P;
}
type RouteMap<R> = { [K in keyof R]: Route<R[K]> };
interface RouterLocation<R> { name: keyof R; params: R[keyof R]; }
```

## Internal model

A LIFO **stack of frames**, mirroring `event/modal.ts`:

```ts
interface StackFrame {
  name: string;
  params: unknown;
  bundle: ScreenBundle | null;   // built lazily; null when a warm screen was disposed? no — see keep-alive
  view: View | null;             // mounted screen (null when disposed)
  savedFocus: View | null;       // exact-tier restore (AR-19)
  savedFocusKey: string | null;  // focusKey-tier restore (AR-19)
}
```

- The router `Group` renders the **top** frame's `view` (via `Show`/`addDynamic`, AR-16). Frames below
  the top are retained (that is the back-stack) but their mounted state depends on keep-alive.

### Navigation operations

| Op | Behavior | AR |
|---|---|---|
| `push(name, params?)` | Build the new screen, save current focus into the current frame, mount the new screen on top, apply its chrome via `ChromeHost` (or restore base if none). | AR-3, AR-13 |
| `back()` | Pop the top frame (dispose its screen unless it was warm), re-show the previous frame, restore its focus (AR-19), re-apply its chrome. **No-op when the stack has one frame** (AR-12). | AR-12, AR-19 |
| `replace(name, params?)` | Dispose the current top, mount the replacement in its place — stack depth unchanged. | AR-7 |
| `reset(name, params?)` | Dispose the entire stack, start fresh with one frame. | — |

All four run through the loop's `runTick`/schedule seam so a navigation coalesces to one frame (AR-16),
consistent with how focus ops are wrapped.

### Keep-alive (AR-7)

- **Default (`keepAlive` falsy):** navigating away from a frame unmounts + disposes its screen (its
  scope disposes → `onCleanup` runs, `reactive/owner.ts`). Returning re-runs `build(ctx)` with the
  frame's saved params → a fresh screen.
- **`keepAlive: true`:** the frame's screen stays mounted-hidden (the TabView keyed-`For` + `visible`
  toggle idiom). Returning re-shows the same `view` — scroll/input/signals intact. `build()` is **not**
  re-run.
- **Cross-cutting (AR §A×B):** the frame retains its `bundle.status`/`menu` so chrome re-applies on
  every activation whether the screen is warm or freshly rebuilt.

### Focus restore (AR-19 — contract fixed, middle tier decided in Phase 0)

On `back()` (and any re-activation), restore focus in tier order (finalized by the Phase 0 spike):

1. **Exact** — warm frame with a live `savedFocus` `View` → `loop.focusView(savedFocus)` (the
   `modal.ts` pattern).
2. **Screen-cooperative override** — a disposed+rebuilt frame whose route supplies `focusKey`:
   re-resolve the saved key against the fresh subtree and focus the match.
3. **Index-path (automatic)** — otherwise resolve the frame's saved child-index path against the
   rebuilt tree (`viewAtPath(rebuiltRoot, savedPath)`, `router/focus.ts`) and focus the same-position
   leaf. The spike proved this restores focus exactly for an identically-structured rebuild — the
   common case — with no per-route configuration.
4. **Best-effort floor** — if the path does not resolve (a reshaped rebuild), focus the screen's
   first focusable (`firstFocusableLeaf`).

The Phase 0 spike confirmed the index-path resolver is robust for identically-structured rebuilds, so
it is the automatic middle tier; `focusKey` is the explicit override for screens that reshape on
rebuild. Warm-frame exact restore is the fixed ST-6a; the index-path/floor behavior is ST-6b.

### `location()` + codec (AR-9)

- `location()` is a reactive accessor over the top frame → `{ name, params }`, typed from `Routes`.
- `canGoBack()` is a reactive accessor over stack depth (`> 1`).
- Per-route `serialize`/`parse` are stored and used by a **designed-but-not-wired** path string; the
  actual `restore(path)` + browser URL sync land with GH #19. v1 ships the accessors + codec only.

## Error isolation (AR-13)

`build(ctx)` is called inside a `try/catch`; on throw the router reports via the app logger seam and
**aborts** the navigation (the current top stays mounted, chrome unchanged) — mirroring the render
root's per-view draw-error isolation.

## Files (target ≤500 lines each)

| File | Purpose |
|---|---|
| `router/types.ts` | `Route`/`ScreenBundle`/`RouteContext`/`RouterLocation`/`ChromeHost`/`ChromeHostAware` |
| `router/stack.ts` | pure stack model + navigation reducers (push/back/replace/reset), view-free — the de-risk-friendly unit |
| `router/router.ts` | `createRouter` — the `Group` body + API + keep-alive mount/dispose + focus restore + ChromeHost drive |
| `router/index.ts` | barrel; re-exported explicitly from `src/index.ts` (AR-15) |

`withBase` (AR-4) lives with the chrome-contribution helpers — see [03-03](03-03-chrome-contributions.md).
