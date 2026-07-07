/**
 * The essentials gate — decides whether the SDK may start on the current
 * terminal, and reports which non-essential capabilities are missing so the app
 * can run in a reduced mode instead of stopping.
 *
 * The single hard requirement is an interactive TTY (which also implies raw-mode
 * keyboard input; cursor addressing and screen clear are universal on any
 * VT/ANSI terminal). Everything else — mouse, color, the alternate screen — is a
 * *degradation*, not a stop: without it the SDK runs keyboard-only / monochrome /
 * inline rather than refusing to start.
 *
 * Typical use: call {@link assertEssentials} before starting the host (it throws
 * when the terminal is unusable), or {@link evaluateEssentials} / {@link essentialsMet}
 * to inspect the situation without throwing.
 */
import type { CapabilityProfile } from '../capability/profile.js';

import { EssentialsNotMetError } from './errors.js';
import type { Logger } from './logger.js';

/** A non-essential capability gap the SDK runs around in a reduced mode instead of stopping. */
export interface Degradation {
  /** The missing capability. */
  readonly cap: 'mouse' | 'color' | 'altScreen';
  /** The reduced mode the SDK runs in for this gap. */
  readonly mode: 'keyboard-only' | 'monochrome' | 'inline';
  /** A short, screen-safe human notice (no secrets). */
  readonly message: string;
}

/** The outcome of evaluating the runtime essentials against a capability profile + TTY facts. */
export interface EssentialsReport {
  /** True when every essential is satisfied (the SDK may start). */
  readonly met: boolean;
  /** Names of the unmet essentials (empty when `met`). */
  readonly missing: readonly string[];
  /** Non-essential gaps the SDK degrades around (may be present even when `met`). */
  readonly degradations: readonly Degradation[];
}

/**
 * The minimal TTY facts the gate reads. Supply these from `detectTty()` **before**
 * starting the host.
 *
 * A `Host` is structurally compatible with this shape, but `host.isTTY` is only
 * populated once `start()` has run — so do NOT pass an un-started host here. Use
 * `detectTty()` for the pre-start check instead.
 */
export interface HostFacts {
  readonly isTTY: boolean;
}

/** The name reported for the single runtime essential when it is unmet. */
const TTY_ESSENTIAL = 'interactive TTY (raw-mode keyboard input)';

/**
 * Build the deterministic degradation list for a profile, always in mouse →
 * color → altScreen order. Color is intentionally not treated as essential:
 * a monochrome terminal is usable, so "no color" degrades rather than stops.
 */
function collectDegradations(caps: CapabilityProfile): Degradation[] {
  const degradations: Degradation[] = [];
  if (!caps.mouse.sgr) {
    degradations.push({ cap: 'mouse', mode: 'keyboard-only', message: 'Mouse unavailable: keyboard-only mode.' });
  }
  if (caps.colorDepth === 'mono') {
    degradations.push({ cap: 'color', mode: 'monochrome', message: 'No color: monochrome rendering.' });
  }
  if (!caps.altScreen) {
    degradations.push({ cap: 'altScreen', mode: 'inline', message: 'No alternate screen: inline fallback.' });
  }
  return degradations;
}

/**
 * Evaluate the runtime essentials against a capability profile and TTY facts,
 * without throwing. Pure — no I/O — so it is safe to call anywhere.
 *
 * The only essential is an interactive TTY (`facts.isTTY`). Missing
 * non-essentials appear in `degradations` (no mouse → keyboard-only; monochrome →
 * monochrome; no alternate screen → inline fallback) but never make `met` false.
 *
 * @param caps Resolved capability profile (from `resolveCapabilities()`).
 * @param facts TTY facts from `detectTty()`; do not pass an un-started `Host`.
 * @returns The report: the `met` flag, the `missing` essentials, and the `degradations`.
 * @example
 * import { evaluateEssentials, resolveCapabilities, detectTty } from '@jsvision/core';
 *
 * const report = evaluateEssentials(resolveCapabilities().profile, { isTTY: detectTty() });
 * if (!report.met) console.error('unusable terminal:', report.missing);
 * for (const d of report.degradations) console.warn(d.message);
 */
export function evaluateEssentials(caps: CapabilityProfile, facts: HostFacts): EssentialsReport {
  const missing: string[] = [];
  if (!facts.isTTY) missing.push(TTY_ESSENTIAL);
  return { met: missing.length === 0, missing, degradations: collectDegradations(caps) };
}

/**
 * Convenience boolean — true when every essential is satisfied. Shorthand for
 * `evaluateEssentials(caps, facts).met`.
 *
 * @param caps Resolved capability profile.
 * @param facts TTY facts from `detectTty()`.
 * @returns true when the terminal is usable (the app may start).
 * @example
 * import { essentialsMet, resolveCapabilities, detectTty } from '@jsvision/core';
 *
 * if (!essentialsMet(resolveCapabilities().profile, { isTTY: detectTty() })) {
 *   process.exit(1);
 * }
 */
export function essentialsMet(caps: CapabilityProfile, facts: HostFacts): boolean {
  return evaluateEssentials(caps, facts).met;
}

/**
 * Assert the essentials before starting: throws {@link EssentialsNotMetError}
 * when the terminal is unusable, otherwise returns the report. Use this as the
 * gate right before you create and start the host.
 *
 * If you pass a `logger`, each degradation is written **once** at `info` level
 * (a screen-safe notice — never to the terminal). This function does not touch or
 * restore the terminal itself.
 *
 * @param caps Resolved capability profile.
 * @param facts TTY facts from `detectTty()`; do not pass an un-started `Host`.
 * @param options Optional `{ logger }` to emit the one-time degradation notices.
 * @returns The `EssentialsReport` (including any degradations) when essentials are met.
 * @throws EssentialsNotMetError when the terminal lacks an essential capability.
 * @example
 * import { assertEssentials, resolveCapabilities, detectTty, createHost } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * assertEssentials(caps, { isTTY: detectTty() }); // throws on a non-TTY
 * const host = createHost({ caps });
 * await host.start();
 */
export function assertEssentials(
  caps: CapabilityProfile,
  facts: HostFacts,
  options?: { readonly logger?: Logger },
): EssentialsReport {
  const report = evaluateEssentials(caps, facts);
  if (!report.met) throw new EssentialsNotMetError(report.missing);
  const logger = options?.logger;
  if (logger) {
    for (const degradation of report.degradations) {
      logger.info('gate', degradation.message, { cap: degradation.cap, mode: degradation.mode });
    }
  }
  return report;
}
