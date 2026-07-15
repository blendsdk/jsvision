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

## createKeymap

Build a keymap from chord→name bindings.

```ts
createKeymap(bindings: Readonly<Record<string, string>>): Keymap
```

## Keymap

A compiled keymap: a pure lookup from a decoded KeyEvent to a bound name.

```ts
interface Keymap {
  lookup(event: KeyEvent): string | undefined;   // Return the bound name for the event's chord, or `undefined` if unbound.
}
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
