# Component: Application Shell + ChromeHost

> **Document**: 03-01-application-shell-chromehost.md
> **Parent**: [Index](00-index.md)
> **Covers**: R-1, R-7, R-8 · AR-2, AR-10, AR-11, AR-21

The additive changes to the app shell (`packages/ui/src/app/`) and the core command registry
(`packages/ui/src/event/` + `@jsvision/core`) that let a router be the app body and drive the shared
chrome. Everything here is **additive** and preserves existing Desktop apps byte-for-byte.

## 1. Body slot (AR-2)

`ApplicationOptions` gains an optional `content`:

```ts
interface ApplicationOptions {
  /** The app body. Defaults to a Desktop window manager. Pass a router (or any View) for a
   *  full-screen, non-windowed app. */
  content?: View;
  // …existing options unchanged…
}
```

`createApplication` (`app/application.ts`) changes:

- `const body = opts.content ?? new Desktop();` — replaces the hardcoded `new Desktop()` (`:212`).
- The `fr:1` layout + column insertion (`:213, :233`) apply to `body`.
- `desktop.attachLoop(loop)` (`:254`) runs **only when `body instanceof Desktop`**.

## 2. Command gating + `app.desktop` (AR-10)

```ts
const isDesktop = body instanceof Desktop;
// register tile/cascade/next/prev/number ONLY when isDesktop
// app.desktop = isDesktop ? body : undefined
```

- `Application.desktop` widens to `readonly desktop: Desktop | undefined` (`:88`) — additive; a
  no-`content` app still gets a `Desktop`.
- Window-management commands (the `Desktop`-handled subset of `Commands`) are registered only for a
  Desktop body. A router body leaves them unregistered, so a router app never shows a live-looking
  `Tile`/`Cascade`.

## 3. The `ChromeHost` seam (AR-21)

The router never touches `StatusLine`/`MenuBar` internals. `createApplication` implements a minimal
seam and passes it to the content when the content wants it (structural, opt-in — a `Desktop`
ignores it):

```ts
interface ChromeHost {
  /** Swap the status line to `items`; `null` restores the app's base status line. */
  setStatus(items: View[] | null): void;
  /** Swap the menu bar to `items` (rebuilding its controller); `null` restores the base menu. */
  setMenu(items: MenuItem[] | null): void;
}
```

Wiring: after the bars are attached, `createApplication` builds a `ChromeHost` closure over the real
`StatusLine`/`MenuBar` (the **base** = whatever `opts.statusLine`/`opts.menuBar` were) and, when
`content` implements a `ChromeHostAware` seam (`attachChromeHost(host)`), calls it. The router
implements `ChromeHostAware`.

### `setStatus` implementation

- `items === null` → restore the base `StatusLine` children (the originally-passed items).
- `items` → replace the line's children with `items`, then **re-run the `isEnabled` wiring**
  (`statusline.ts:92-97`) over the new command items so greying is correct. Activation already flows
  through the line seam (`:161`), so swapped items emit correctly with no further wiring.

### `setMenu` implementation

- Add `MenuBar.setItems(items: MenuItem[])` (new): assign `this.items`, close any open menu, and
  rebuild `this.controller = createMenuController(items, overlay, seam)` using an `overlay`+`seam`
  reference retained at `attach` (`menubar.ts:59-61`). `draw()` already reads `items` live.
- `items === null` → `setItems(baseMenuItems)`.

## 4. Reactive command enablement (AR-11)

The command registry is **`@jsvision/ui`-internal** (`packages/ui/src/event/commands.ts`) — there is
**no** core-side registry. It currently sets a `Map` override with no repaint (`:56-57`). Make
enablement observable by importing `signal` from `../reactive/index.js` (the reactive core is
UI-internal — `view.ts:14` already imports `signal`/`computed` from there):

```ts
// createCommandRegistry (event/commands.ts):
import { signal } from '../reactive/index.js';
const version = signal(0);
const enable = (name, on) => { overrides.set(name, on); version.set(version() + 1); };
// expose version() as a readable accessor (e.g. EventLoop.commandsVersion)
```

- ⚠️ **The bars must `bind()` the version signal, not read it in `draw()`.** `render-root.ts:166`
  calls `view.draw(ctx)` with **no** tracking scope, so reading a signal inside `draw()` does not
  subscribe — that is exactly why greying is non-reactive today. `StatusLine` and `MenuBar` must
  `this.bind(() => loop.commandsVersion())` in `onMount`, so any enable/disable invalidates the bar
  and repaints. This mirrors the established reactive patterns: the live-label bind
  (`status-item.ts:77`) and `focusSignal` (`view.ts:126-134`).
- This is additive: existing greying keeps working, and now updates live — so the wizard's
  `effect(() => loop.enableCommand(Cmd.next, form.isValid()))` greys "Next" with no manual invalidate.
  Seeding (`createCommandRegistry`'s `seed` loop, `commands.ts:39-40`) uses `overrides.set` directly,
  not `enable`, so it does not spuriously bump the version.
- Exposed as it is today via `EventLoop.enableCommand`/`isCommandEnabled`; only the version accessor
  and the repaint behavior are new.

## Files touched

| File | Change | Approx. |
|---|---|---|
| `packages/ui/src/app/application.ts` | `content` option, body generalization, gating, `app.desktop` widen, ChromeHost wiring | +~40 lines |
| `packages/ui/src/menu/menubar.ts` | `setItems(items)` + retain `overlay`/`seam` at attach | +~20 lines |
| `packages/ui/src/status/statusline.ts` | re-run `isEnabled` wiring on swap (extract a helper reused by attach + setStatus) | +~10 lines |
| `packages/ui/src/event/commands.ts` (UI-internal registry — imports `signal` from `../reactive`) | version-signal on enable/disable + a readable `commandsVersion` accessor on the loop; bars `bind()` it | +~15 lines |
| `packages/ui/src/app/application.ts` (interface) | `Application.desktop: Desktop \| undefined`, `ChromeHost`/`ChromeHostAware` types | types |

## Constraints

- All existing app-shell + `@jsvision/ui` command-registry tests stay green (additive-only). AR-11
  touches no `@jsvision/core` code.
- No new core theme role. No new runtime dependency.
- Files stay ≤500 lines (application.ts is the one to watch — extract helpers if it approaches the cap).
