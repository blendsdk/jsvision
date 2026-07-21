<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Core essentials

Capabilities, input, keymaps, and style re-exported from `@jsvision/core`.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## Attr

Attribute bit constants.

```ts
const Attr: {
    readonly none: 0;
    readonly bold: number;
    readonly dim: number;
    readonly italic: number;
    readonly underline: number;
    readonly blink: number;
    readonly reverse: number;
    readonly strike: number;
}
```

## CapabilityProfile

The immutable, detected description of the running terminal.

```ts
interface CapabilityProfile {
  colorDepth: ColorDepth;
  mouse: MouseCaps;
  unicode: UnicodeCaps;
  osc: OscCaps;
  sync2026: boolean;
  altScreen: boolean;
  bracketedPaste: boolean;
  keyboard: KeyboardCaps;
  glyphs: GlyphCaps;
  platform: Platform;
  multiplexer: boolean;   // True when running under tmux/screen; consumers apply passthrough policy.
}
```

## ChromeHost

The chrome seam an application hands to a router-style body so each screen can define its own status line and menu.

```ts
interface ChromeHost {
  setStatus(items: View[] | null): void;   // Replace the status line's items with `items`; pass `null` to restore the application's base status line (whatever `createApplication({ statusLine })` was given). Swapped-in command items are re-wired so their greyed/enabled state stays correct.
  setMenu(items: MenuItem[] | null): void;   // Replace the menu bar's top-level items with `items`, rebuilding its navigation controller; pass `null` to restore the application's base menu.
}
```

## ChromeHostAware

Implemented by an application body (e.g. a router) that wants to drive the shared chrome.

```ts
interface ChromeHostAware {
  attachChromeHost(host: ChromeHost): void;   // Receive the application's chrome seam. Called once by `createApplication` after the menu/status bars are attached.
}
```

## createKeymap

Build a keymap from chord→name bindings.

```ts
createKeymap(bindings: Readonly<Record<string, string>>): Keymap
```

## createRouter

Create a navigation / screen router — a full-screen screen stack that mounts as an application's `content` body.

```ts
createRouter<R>(opts: RouterOptions<R>): Router<R>
```

## FocusHost

The focus seam an application hands to a router-style body so it can save and restore keyboard focus across navigation — restoring the exact field a warm screen had focused, or the same-position field of a rebuilt one.

```ts
interface FocusHost {
  focusView(view: View): void;   // Move keyboard focus to `view` (a no-op if the view is not currently mounted).
  getFocused(): View | null;   // The currently focused view, or `null` when nothing holds focus.
}
```

## FocusHostAware

Implemented by an application body (e.g. a router) that saves/restores focus across navigation.

```ts
interface FocusHostAware {
  attachFocusHost(host: FocusHost): void;   // Receive the application's focus seam. Called once by `createApplication` after the loop is built.
}
```

## InitialRoute

The initial route for a router: a route name plus its params.

```ts
type InitialRoute<R> = {
  [K in keyof R]: { name: K } & (R[K] extends void ? { params?: undefined } : { params: R[K] });
}[keyof R]
```

## Keymap

A compiled keymap: a pure lookup from a decoded KeyEvent to a bound name.

```ts
interface Keymap {
  lookup(event: KeyEvent): string | undefined;   // Return the bound name for the event's chord, or `undefined` if unbound.
}
```

## NavArgs

The trailing arguments of a navigation call for a route with param type `P`: none for a `void` route, exactly `[params]` otherwise.

```ts
type NavArgs<P> = P extends void ? [] : [params: P]
```

## resolveCapabilities

Detect the running terminal's capabilities **synchronously** from environment variables and the known-terminal table.

```ts
resolveCapabilities(options?: SyncResolveOptions): CapabilityResolution
```

## resolveCapabilitiesAsync

Detect the running terminal's capabilities **asynchronously**, additionally probing the terminal live when you pass a TerminalQuery seam (the most accurate detection available).

```ts
resolveCapabilitiesAsync(options?: ResolveOptions): Promise<CapabilityResolution>
```

## Route

A route definition: how to build the screen for a set of params, plus optional keep-alive, focus, and (de)serialization behavior.

```ts
interface Route<P> {
  build: (ctx: RouteContext<P>) => ScreenBundle;   // Build this route's screen bundle for the given params. Called on each activation unless kept alive.
  keepAlive?: boolean;   // Keep the screen mounted-but-hidden when navigating away, so its state survives a round-trip. Default off.
  focusKey?: (view: View) => string;   // Optional exact-restore key: derive a stable key from the focused view so focus survives a rebuild.
  serialize?: (params: P) => string;   // Optional codec: serialize this route's params to a string (designed for deep-linking).
  parse?: (s: string) => P;   // Optional codec: parse this route's params back from a string.
}
```

## RouteContext

The context a route's `build` receives: the typed params the screen was navigated to.

```ts
interface RouteContext<P> {
  params: P;   // The params the route was entered with.
}
```

## RouteMap

The route table: one Route per key of the `Routes` map, typed to that route's params.

```ts
type RouteMap<R> = { [K in keyof R]: Route<R[K]> }
```

## Router

A navigation / screen router.

```ts
new Router<R>(opts: RouterOptions<R>)   // extends Group
// methods & signals:
push(name: K, ...args: NavArgs<R[K]>): void
replace(name: K, ...args: NavArgs<R[K]>): void
reset(name: K, ...args: NavArgs<R[K]>): void
back(): boolean
location(): RouterLocation<R>
canGoBack(): boolean
```

## RouterLocation

The reactive current location: the top route's name and the params it was entered with.

```ts
interface RouterLocation<R> {
  name: keyof R;   // The current route name.
  params: R[keyof R];   // The current params.
}
```

## RouterOptions

Options for `createRouter`.

```ts
interface RouterOptions<R> {
  initial: InitialRoute<R>;   // The route to show first (structured + typed, so it can carry params).
  routes: RouteMap<R>;   // The route table.
  logger?: Logger;   // Optional logger for isolated `build` errors; defaults to the framework's screen-safe logger.
}
```

## ScreenBundle

What a route's `build` returns: the screen view plus its optional per-screen chrome.

```ts
interface ScreenBundle {
  view: View;   // The full-screen view for this screen.
  status?: View[];   // Optional status-line items for this screen; omit to keep the app base.
  menu?: MenuItem[];   // Optional menu-bar items for this screen; omit to keep the app base.
}
```

## Style

A foreground/background/attribute style; used by every drawing helper.

```ts
interface Style {
  fg: Color;
  bg: Color;
  attrs?: AttrMask;   // Attribute bitmask; defaults to `Attr.none`.
}
```

## VERSION

The package version of `@jsvision/ui`.

```ts
const VERSION: "0.2.0"
```

## withBase

Compose a chrome contribution from a base list plus per-screen extras: `[...base, ...extra]`.

```ts
withBase<T extends View | { readonly kind: string }>(base: readonly T[], extra: readonly T[]): T[]
```
