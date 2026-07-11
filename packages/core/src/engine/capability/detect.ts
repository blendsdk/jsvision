/**
 * Layered capability detection with a per-field reason trace.
 *
 * Combines the detection sources, from strongest to weakest: the live runtime
 * probe, environment variables, the known-terminal table, and the conservative
 * defaults. (The caller's `override` is applied on top of this, in `index.ts`.)
 * Each top-level field records the single strongest source that set it — the
 * reason trace. `colorDepth` uses a special precedence (see
 * {@link resolveColorDepth}); `platform` always comes straight from the input.
 *
 * The `runtime` and `table` sources are optional; when absent they contribute
 * nothing and fields fall through to the environment or the defaults.
 */
import type {
  CapabilityProfile,
  CapabilityReasons,
  ColorDepth,
  DeepPartial,
  Platform,
  ReasonLayer,
} from './profile.js';
import { CONSERVATIVE_DEFAULTS, platformDefaults } from './defaults.js';
import { readEnv, type ColorDepthSignal } from './env.js';

/** Inputs to {@link detectBase}: the ambient signals plus the optional runtime/table sources. */
export interface DetectInputs {
  /** Environment map to read (injected; never mutated or logged). */
  readonly env: NodeJS.ProcessEnv;
  /** Resolved host platform (always wins for the `platform` field). */
  readonly platform: Platform;
  /** Capabilities from a live runtime probe; absent → skipped. */
  readonly runtime?: DeepPartial<CapabilityProfile>;
  /** Capabilities from the known-terminal table; absent → skipped. */
  readonly table?: DeepPartial<CapabilityProfile>;
}

/** A precedence layer carrying a partial profile and the reason it stamps. */
interface OverlayLayer {
  readonly reason: ReasonLayer;
  readonly partial: DeepPartial<CapabilityProfile>;
}

/** A resolved field value paired with the layer that determined it. */
interface ResolvedField<T> {
  readonly value: T;
  readonly reason: ReasonLayer;
}

/**
 * Resolve the base profile (layers 2–5) and its reason trace, before the
 * caller applies the layer-1 override.
 *
 * @param inputs Ambient env/platform plus optional runtime/table layers.
 * @returns The composed `profile` and per-field `reasons`.
 */
export function detectBase(inputs: DetectInputs): {
  profile: CapabilityProfile;
  reasons: CapabilityReasons;
} {
  const envSignals = readEnv(inputs.env);

  // The base every field falls back to when no stronger signal (override, live
  // probe, environment, or known terminal) determines it: the conservative
  // defaults, raised by any better default the platform guarantees (e.g. a modern
  // Windows console's color/Unicode/mouse support). Off Windows this is exactly
  // the conservative defaults.
  const base: CapabilityProfile = deepMerge(CONSERVATIVE_DEFAULTS, platformDefaults(inputs.platform));

  // Overlay layers, ordered LOW → HIGH precedence (the base sits below all of
  // them; the override sits above all of them and is applied later).
  const overlays: ReadonlyArray<OverlayLayer> = [
    { reason: 'table', partial: inputs.table ?? {} },
    { reason: 'env', partial: envSignals.profile },
    { reason: 'runtime', partial: inputs.runtime ?? {} },
  ];

  const mouse = resolveField('mouse', base, overlays);
  const unicode = resolveField('unicode', base, overlays);
  const osc = resolveField('osc', base, overlays);
  const sync2026 = resolveField('sync2026', base, overlays);
  const altScreen = resolveField('altScreen', base, overlays);
  const bracketedPaste = resolveField('bracketedPaste', base, overlays);
  const keyboard = resolveField('keyboard', base, overlays);
  const glyphs = resolveField('glyphs', base, overlays);
  const multiplexer = resolveField('multiplexer', base, overlays);
  const colorDepth = resolveColorDepth(base.colorDepth, envSignals.colorDepth, inputs.runtime, inputs.table);

  const profile: CapabilityProfile = {
    colorDepth: colorDepth.value,
    mouse: mouse.value,
    unicode: unicode.value,
    osc: osc.value,
    sync2026: sync2026.value,
    altScreen: altScreen.value,
    bracketedPaste: bracketedPaste.value,
    keyboard: keyboard.value,
    glyphs: glyphs.value,
    platform: inputs.platform,
    multiplexer: multiplexer.value,
  };

  const reasons: CapabilityReasons = {
    colorDepth: colorDepth.reason,
    mouse: mouse.reason,
    unicode: unicode.reason,
    osc: osc.reason,
    sync2026: sync2026.reason,
    altScreen: altScreen.reason,
    bracketedPaste: bracketedPaste.reason,
    keyboard: keyboard.reason,
    glyphs: glyphs.reason,
    // platform is always actively sourced from the resolved platform input.
    platform: 'env',
    multiplexer: multiplexer.reason,
  };

  return { profile, reasons };
}

/**
 * Resolve a single non-colorDepth field by merging each overlay layer (in
 * ascending precedence) over the base default (conservative, plus any
 * platform-guaranteed baseline). The reason is the highest-precedence layer that
 * contributed any value, or `'default'` when only the base applies.
 */
function resolveField<K extends keyof CapabilityProfile>(
  field: K,
  base: CapabilityProfile,
  overlays: ReadonlyArray<OverlayLayer>,
): ResolvedField<CapabilityProfile[K]> {
  let value: CapabilityProfile[K] = base[field];
  let reason: ReasonLayer = 'default';

  for (const layer of overlays) {
    const part = layer.partial[field];
    if (part === undefined) continue;
    value = deepMerge(value, part);
    reason = layer.reason;
  }

  return { value, reason };
}

/**
 * Resolve `colorDepth` with its special precedence (the caller's override is
 * applied later, on top of this):
 * `NO_COLOR/FORCE_COLOR (forced) > runtime probe > COLORTERM/TERM (soft) >
 * table > base default`. The forced env signals deliberately outrank a live
 * probe, because a user setting `NO_COLOR` must always win; the base default is
 * the conservative floor raised by any platform baseline (e.g. truecolor on a
 * modern Windows console).
 */
function resolveColorDepth(
  baseColorDepth: ColorDepth,
  signal: ColorDepthSignal,
  runtime: DeepPartial<CapabilityProfile> | undefined,
  table: DeepPartial<CapabilityProfile> | undefined,
): ResolvedField<ColorDepth> {
  if (signal.forced !== undefined) {
    return { value: signal.forced, reason: 'env' };
  }
  if (runtime?.colorDepth !== undefined) {
    return { value: runtime.colorDepth, reason: 'runtime' };
  }
  if (signal.soft !== undefined) {
    return { value: signal.soft, reason: 'env' };
  }
  if (table?.colorDepth !== undefined) {
    return { value: table.colorDepth, reason: 'table' };
  }
  return { value: baseColorDepth, reason: 'default' };
}

/** Type guard for a plain (non-array) object, used by {@link deepMerge}. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Immutably deep-merge a {@link DeepPartial} over a full base value, leaf by
 * leaf. Plain objects recurse; every other value (primitive/array) is a leaf the
 * partial replaces when present. `undefined` partial values are ignored, so an
 * explicitly-absent key never clears a base value. Never mutates `base`.
 *
 * @param base Full base value (e.g. a resolved field or the whole profile).
 * @param partial Partial overlay whose set leaves win.
 * @returns A new value with the partial merged over the base.
 */
export function deepMerge<T>(base: T, partial: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(partial)) {
    // Leaf (or shape mismatch): the partial value wins when provided.
    return partial as T;
  }

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue;
    const baseValue = base[key];
    result[key] = isPlainObject(baseValue) && isPlainObject(value) ? deepMerge(baseValue, value) : value;
  }
  return result as T;
}
