/**
 * Terminal capability detection: figure out what the running terminal can do
 * (color depth, mouse, Unicode, OSC features, …) so the rest of the SDK can
 * auto-configure itself.
 *
 * Two resolvers:
 * - {@link resolveCapabilities} — **synchronous**. Detects from environment
 *   variables and a known-terminal table, and caches the result per process.
 *   Cannot ask the terminal live questions.
 * - {@link resolveCapabilitiesAsync} — **asynchronous**. Additionally probes the
 *   terminal at runtime when you pass a {@link TerminalQuery}, for the highest
 *   accuracy.
 *
 * Both return an immutable {@link CapabilityResolution} — `{ profile, reasons }`,
 * where `profile` is the detected capabilities and `reasons` records which layer
 * decided each field. Any fields you pass in `override` win over detection.
 */
import type {
  CapabilityProfile,
  CapabilityReasons,
  CapabilityResolution,
  DeepPartial,
  Platform,
  ReasonLayer,
  ResolveOptions,
} from './profile.js';
import { detectBase, deepMerge } from './detect.js';
import { lookupTable } from './table.js';
import { runQueries, DEFAULT_QUERY_TIMEOUT_MS } from './query.js';

export type {
  CapabilityProfile,
  CapabilityReasons,
  CapabilityResolution,
  ColorDepth,
  DeepPartial,
  GlyphCaps,
  KeyboardCaps,
  MouseCaps,
  OscCaps,
  Platform,
  ReasonLayer,
  ResolveOptions,
  TerminalQuery,
  UnicodeCaps,
} from './profile.js';

/**
 * Options for the synchronous {@link resolveCapabilities}. The live-query fields
 * (`query`/`timeoutMs`) are excluded because a live probe is asynchronous —
 * passing a query here is a compile error; use {@link resolveCapabilitiesAsync}.
 */
export type SyncResolveOptions = Omit<ResolveOptions, 'query' | 'timeoutMs'>;

/**
 * Per-process cache of the plain (no-options) resolution. Only a call with no
 * `override`/`env`/`platform` is cached; any call that passes inputs bypasses the
 * cache entirely, so it can never be poisoned.
 */
let ambientCache: CapabilityResolution | undefined;

/**
 * Detect the running terminal's capabilities **synchronously** from environment
 * variables and the known-terminal table.
 *
 * With no options, the result is computed once and cached for the process; pass
 * `refresh: true` to recompute. Every input is injectable (`env`, `platform`,
 * `override`) so you can force a specific configuration or keep tests hermetic.
 * For the most accurate detection (a live terminal probe), use
 * {@link resolveCapabilitiesAsync}.
 *
 * @param options Optional `override` (force fields), injected `env`/`platform`,
 *   and a `refresh` flag to bypass the cache.
 * @returns A deep-frozen `{ profile, reasons }`. Read `.profile` for the caps.
 * @example
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * // Ambient detection (cached per process):
 * const caps = resolveCapabilities().profile;
 * if (caps.colorDepth === 'truecolor') { ... }
 *
 * // Force a configuration (e.g. for a test or a screenshot):
 * const forced = resolveCapabilities({
 *   override: { colorDepth: 'truecolor', altScreen: true },
 * }).profile;
 */
export function resolveCapabilities(options: SyncResolveOptions = {}): CapabilityResolution {
  const isAmbient = options.override === undefined && options.env === undefined && options.platform === undefined;

  if (isAmbient && options.refresh !== true && ambientCache !== undefined) {
    return ambientCache;
  }

  const env = options.env ?? process.env;
  const platform = options.platform ?? toPlatform(process.platform);
  const result = composeResolution({ env, platform, override: options.override });

  if (isAmbient) {
    // Cache (or, on refresh, replace) the ambient resolution only.
    ambientCache = result;
  }
  return result;
}

/**
 * Detect the running terminal's capabilities **asynchronously**, additionally
 * probing the terminal live when you pass a {@link TerminalQuery} seam (the most
 * accurate detection available).
 *
 * Always resolves, never rejects: a terminal that stays silent, replies with too
 * much data, or sends garbage simply falls back to environment/table detection.
 * This path never touches the sync cache — a live probe is always a fresh, per-call
 * result.
 *
 * If the probe captured bytes the user typed while it was in flight, they are
 * returned as `resolution.passthrough` — feed those into your input decoder first,
 * before reading further stdin, so no keystrokes are lost.
 *
 * @param options `override`, injected `env`/`platform`, the live-query `query`
 *   seam, and `timeoutMs` (the probe's whole-step timeout).
 * @returns A promise of a deep-frozen `{ profile, reasons }` (plus optional
 *   `passthrough`).
 * @example
 * import { resolveCapabilitiesAsync, createTerminalQuery } from '@jsvision/core';
 *
 * // Requires the input stream in raw mode and flowing.
 * const query = createTerminalQuery(); // defaults to process std streams
 * try {
 *   const { profile } = await resolveCapabilitiesAsync({ query, timeoutMs: 200 });
 *   if (profile.sync2026) { ... } // terminal supports synchronized output
 * } finally {
 *   query.close();
 * }
 */
export async function resolveCapabilitiesAsync(options: ResolveOptions = {}): Promise<CapabilityResolution> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? toPlatform(process.platform);

  let runtime: DeepPartial<CapabilityProfile> | undefined;
  let passthrough: Uint8Array | undefined;
  if (options.query !== undefined) {
    const { parsed, passthrough: bytes } = await runQueries(
      options.query,
      options.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS,
    );
    runtime = parsed;
    // Keep the bytes that were not part of a terminal response — these are real
    // keystrokes typed during detection, which the caller re-injects into the decoder.
    passthrough = bytes;
  }

  return composeResolution({ env, platform, runtime, passthrough, override: options.override });
}

/**
 * Shared resolution core for both entry points: run layered detection via
 * {@link detectBase}, apply the caller's `override`, and deep-freeze the result.
 */
function composeResolution(params: {
  env: NodeJS.ProcessEnv;
  platform: Platform;
  runtime?: DeepPartial<CapabilityProfile>;
  passthrough?: Uint8Array;
  override?: ResolveOptions['override'];
}): CapabilityResolution {
  const table = lookupTable(params.env);
  const base = detectBase({
    env: params.env,
    platform: params.platform,
    table,
    runtime: params.runtime,
  });
  const merged = applyOverride(base, params.override);
  return freezeResolution(merged, params.passthrough);
}

/**
 * Apply the caller's `override`: deep-merge it over the detected profile and mark
 * every overridden top-level field's reason as `'override'`.
 */
function applyOverride(
  base: { profile: CapabilityProfile; reasons: CapabilityReasons },
  override: ResolveOptions['override'],
): { profile: CapabilityProfile; reasons: CapabilityReasons } {
  if (override === undefined) {
    return base;
  }

  const profile = deepMerge(base.profile, override);
  const reasons: Record<keyof CapabilityReasons, ReasonLayer> = { ...base.reasons };

  // `keyof CapabilityReasons` === `keyof CapabilityProfile`; both share the
  // same top-level field names, so an override key maps to a reason key.
  for (const key of Object.keys(reasons) as (keyof CapabilityReasons)[]) {
    if (override[key] !== undefined) {
      reasons[key] = 'override';
    }
  }

  return { profile, reasons };
}

/**
 * Deep-freeze both halves of the resolution before returning. When async
 * detection captured real input bytes, attach them as `passthrough` — the buffer
 * stays unfrozen because it is meant to be consumed by the decoder.
 */
function freezeResolution(
  resolution: {
    profile: CapabilityProfile;
    reasons: CapabilityReasons;
  },
  passthrough?: Uint8Array,
): CapabilityResolution {
  const frozen: CapabilityResolution = {
    profile: deepFreeze(resolution.profile),
    reasons: deepFreeze(resolution.reasons),
  };
  if (passthrough !== undefined && passthrough.length > 0) {
    return { ...frozen, passthrough };
  }
  return frozen;
}

/**
 * Recursively `Object.freeze` an object graph. Untouched field groups may share
 * a reference with the (immutable) conservative defaults; freezing those is a
 * harmless no-op since the defaults are constants.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

/** Narrow `process.platform` to the supported {@link Platform} set (anything else → `'linux'`). */
function toPlatform(platform: NodeJS.Platform): Platform {
  return platform === 'darwin' || platform === 'win32' ? platform : 'linux';
}
