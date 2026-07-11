/**
 * The capability data model — the immutable description of a terminal that the
 * rest of the SDK (color, input, rendering, host) reads to auto-configure.
 *
 * Defines {@link CapabilityProfile} (the detected capabilities), the per-field
 * {@link CapabilityReasons} trace (which detection layer decided each field), the
 * {@link ResolveOptions} you pass to the resolvers, and the frozen
 * {@link CapabilityResolution} they return.
 *
 * Every field is `readonly`, and {@link CapabilityResolution} is additionally
 * deep-frozen at runtime, so mutation fails at both compile time and run time —
 * treat a resolved profile as read-only.
 */

/** Color rendering depth, coarsest to richest. */
export type ColorDepth = 'mono' | '16' | '256' | 'truecolor';

/**
 * Which detection layer decided a given field, from highest precedence to
 * lowest: an explicit `override`, a live `runtime` probe, an `env` variable, the
 * known-terminal `table`, or the `default` baseline. The `default` baseline is
 * platform-aware — on Windows it is the modern-console baseline (24-bit color,
 * Unicode, mouse, alternate screen), not the bare conservative fallback — so a
 * field can read `'default'` yet still carry a rich value on that platform.
 */
export type ReasonLayer = 'override' | 'runtime' | 'env' | 'table' | 'default';

/** Mouse-reporting capabilities. */
export interface MouseCaps {
  readonly sgr: boolean;
  readonly drag: boolean;
  readonly wheel: boolean;
}

/** Unicode rendering capabilities. */
export interface UnicodeCaps {
  readonly utf8: boolean;
  readonly widthMode: 'wcwidth' | 'ambiguous-wide';
  readonly emoji: 'narrow' | 'wide' | 'unknown';
}

/** OSC (Operating System Command) escape-sequence capabilities. */
export interface OscCaps {
  readonly hyperlink8: boolean;
  readonly clipboard52: boolean;
  readonly title: boolean;
  readonly notify9: boolean;
  readonly notify777: boolean;
  readonly notify99: boolean;
  readonly progress9_4: boolean;
}

/** Keyboard-protocol capabilities. */
export interface KeyboardCaps {
  readonly kittyFlags: boolean;
  readonly modifyOtherKeys: boolean;
}

/** Line/box glyph rendering capabilities. */
export interface GlyphCaps {
  readonly boxDrawing: boolean;
  readonly halfBlocks: boolean;
  /**
   * True when the terminal renders the fallback-prone arrow/geometric chrome
   * glyphs (`▲▼◄►•↑↕×`) as double-width. When true, the renderer swaps those
   * glyphs for ASCII equivalents so the layout stays intact. Default `false`.
   */
  readonly ambiguousWide: boolean;
}

/** Host platform, mirroring the supported values of `process.platform`. */
export type Platform = 'linux' | 'darwin' | 'win32';

/** The immutable, detected description of the running terminal. */
export interface CapabilityProfile {
  readonly colorDepth: ColorDepth;
  readonly mouse: MouseCaps;
  readonly unicode: UnicodeCaps;
  readonly osc: OscCaps;
  readonly sync2026: boolean;
  readonly altScreen: boolean;
  readonly bracketedPaste: boolean;
  readonly keyboard: KeyboardCaps;
  readonly glyphs: GlyphCaps;
  readonly platform: Platform;
  /** True when running under tmux/screen; consumers apply passthrough policy. */
  readonly multiplexer: boolean;
}

/**
 * Which detection layer decided each capability — one {@link ReasonLayer} per
 * top-level field of {@link CapabilityProfile} (per field group, not per nested
 * boolean). Useful for debugging why a capability came out the way it did.
 */
export interface CapabilityReasons {
  readonly colorDepth: ReasonLayer;
  readonly mouse: ReasonLayer;
  readonly unicode: ReasonLayer;
  readonly osc: ReasonLayer;
  readonly sync2026: ReasonLayer;
  readonly altScreen: ReasonLayer;
  readonly bracketedPaste: ReasonLayer;
  readonly keyboard: ReasonLayer;
  readonly glyphs: ReasonLayer;
  readonly platform: ReasonLayer;
  readonly multiplexer: ReasonLayer;
}

/** Recursive partial: every field (nested included) becomes optional. Used by the `override` API. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * A minimal byte-stream seam for probing the terminal at runtime. Pass an
 * implementation as `options.query` to {@link resolveCapabilitiesAsync} to enable
 * live detection; omit it and the probe is skipped. Use `createTerminalQuery()`
 * for a ready-made adapter over Node streams.
 */
export interface TerminalQuery {
  /** Write a query request (e.g. a DA request) to the terminal. */
  write(data: string): void;
  /** Async iterator of raw bytes received from the terminal. */
  read(): AsyncIterable<Uint8Array>;
}

/** Options for the capability resolvers; every input is injectable. */
export interface ResolveOptions {
  /** Force any subset of fields, bypassing detection (deep-merged over the result). */
  readonly override?: DeepPartial<CapabilityProfile>;
  /** Environment to read from; defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Platform to assume; defaults to `process.platform`. */
  readonly platform?: Platform;
  /** Live-query seam for runtime probing; when absent, the live probe is skipped. */
  readonly query?: TerminalQuery;
  /** Live-query timeout in milliseconds (default 200). */
  readonly timeoutMs?: number;
  /** Force re-detection, ignoring the per-process cache. */
  readonly refresh?: boolean;
}

/** The frozen result returned by the capability resolvers. */
export interface CapabilityResolution {
  /** The detected capabilities. */
  readonly profile: CapabilityProfile;
  /** Which detection layer decided each field of {@link profile}. */
  readonly reasons: CapabilityReasons;
  /**
   * Real input bytes the user typed while a live probe was in flight (not part of
   * any terminal response). Present only on {@link resolveCapabilitiesAsync} runs
   * that issued a query and captured such bytes. If you detect before starting
   * your input loop, feed these into the decoder **first**, ahead of further
   * stdin, so the keystrokes surface as events in arrival order. Omitted on the
   * sync path and whenever nothing was captured.
   */
  readonly passthrough?: Uint8Array;
}
