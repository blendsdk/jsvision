/**
 * The opt-in input diagnostics report — a troubleshooting aid for "the app runs
 * but nothing responds" situations, most often a Windows executable started by a
 * double-click.
 *
 * Set `JSVISION_INPUT_DIAG` (any value) to have the host write a plain-text
 * report the moment it starts: which runtime and platform it is on, whether it
 * sees an interactive TTY, whether raw mode actually engaged, the resolved
 * capabilities, and — as you press keys — whether input bytes are arriving at
 * all. Because a double-clicked console window vanishes on exit, the report goes
 * to a file (the flag's value is the path, or a default under the home
 * directory) so it survives. The report only echoes a curated allowlist of
 * terminal-related environment keys, never arbitrary environment values.
 *
 * When the flag is unset this module does nothing and costs nothing.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityProfile } from '../capability/profile.js';

/** Environment variable that turns the input diagnostics on (presence = on; value = output path). */
export const INPUT_DIAG_ENV = 'JSVISION_INPUT_DIAG';

/** Flag values that mean "on, use the default path" rather than "on, write here". */
const BARE_ON_VALUES: ReadonlySet<string> = new Set(['1', 'true', 'on', 'yes']);

/**
 * Terminal-related environment keys the report may surface. `value: true` echoes
 * the key's value (safe terminal identifiers); otherwise only its set/unset state
 * is reported (identifiers we treat as opaque, e.g. the `WT_SESSION` GUID).
 */
const REPORTED_ENV_KEYS: ReadonlyArray<{ key: string; value: boolean }> = [
  { key: 'WT_SESSION', value: false },
  { key: 'WT_PROFILE_ID', value: false },
  { key: 'TERM', value: true },
  { key: 'TERM_PROGRAM', value: true },
  { key: 'COLORTERM', value: true },
  { key: 'NO_COLOR', value: false },
  { key: 'FORCE_COLOR', value: true },
  { key: 'JSVISION_ASCII', value: false },
];

/** The captured facts a report is built from — all data, so the builder stays pure and testable. */
export interface InputDiagSnapshot {
  /** Environment to read the allowlisted keys from. */
  readonly env: NodeJS.ProcessEnv;
  /** Host platform (`process.platform` shape). */
  readonly platform: NodeJS.Platform;
  /** Runtime label, e.g. `bun 1.1.0` or `node v22.14.0`. */
  readonly runtime: string;
  /** Whether the bound input stream reports itself as a TTY. */
  readonly inputIsTTY: boolean;
  /** Whether the bound output stream reports itself as a TTY. */
  readonly outputIsTTY: boolean;
  /** The host's combined TTY verdict (both ends). */
  readonly hostIsTTY: boolean;
  /** Whether the input stream exposes a `setRawMode` function at all. */
  readonly hasSetRawMode: boolean;
  /** The input stream's `isRaw` after the host tried to enter raw mode (`undefined` if not exposed). */
  readonly isRaw: boolean | undefined;
  /** The resolved capabilities, so a rendering fallback shows up in the same report. */
  readonly caps: CapabilityProfile;
}

/** A live diagnostics handle: records the first real input arrival (or its absence). */
export interface InputDiagnostics {
  /** Append the first input chunk's size/bytes to the report; later chunks are ignored. */
  noteInput(chunk: Uint8Array | string): void;
}

/**
 * Resolve where (and whether) to write the input diagnostics from the environment.
 *
 * @param env The environment to read {@link INPUT_DIAG_ENV} from.
 * @returns The output file path, or `null` when the flag is unset (diagnostics off).
 */
export function resolveInputDiagPath(env: NodeJS.ProcessEnv): string | null {
  const raw = env[INPUT_DIAG_ENV];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  // A bare on-switch (or empty string) picks the default file; any other value is
  // treated as the caller's chosen output path.
  if (trimmed === '' || BARE_ON_VALUES.has(trimmed.toLowerCase())) {
    return join(homedir(), 'jsvision-input-diag.txt');
  }
  return trimmed;
}

/** Format an allowlisted env key as either its value or a set/unset flag. */
function formatEnvKey(env: NodeJS.ProcessEnv, key: string, showValue: boolean): string {
  const present = env[key] !== undefined;
  if (!present) return `${key}: unset`;
  return showValue ? `${key}: ${env[key]}` : `${key}: set`;
}

/**
 * Build the plain-text diagnostics report from a captured snapshot. Pure: given
 * the same snapshot it always returns the same text, and it reads nothing beyond
 * the allowlisted environment keys.
 *
 * @param snap The captured host/stream/capability facts.
 * @returns The multi-line report body.
 */
export function collectInputDiagnostics(snap: InputDiagSnapshot): string {
  const { caps } = snap;
  const lines: string[] = [
    'jsvision input diagnostics',
    `runtime: ${snap.runtime}`,
    `platform: ${snap.platform}`,
    '',
    '--- environment ---',
    ...REPORTED_ENV_KEYS.map(({ key, value }) => formatEnvKey(snap.env, key, value)),
    '',
    '--- streams ---',
    `stdin.isTTY: ${snap.inputIsTTY}`,
    `stdout.isTTY: ${snap.outputIsTTY}`,
    `host isTTY (both): ${snap.hostIsTTY}`,
    `stdin.setRawMode present: ${snap.hasSetRawMode}`,
    `stdin.isRaw: ${snap.isRaw === undefined ? 'unknown' : snap.isRaw}`,
    '',
    '--- resolved capabilities ---',
    `colorDepth: ${caps.colorDepth}`,
    `unicode.utf8: ${caps.unicode.utf8}`,
    `glyphs.boxDrawing: ${caps.glyphs.boxDrawing}`,
    `mouse.sgr: ${caps.mouse.sgr}`,
    `altScreen: ${caps.altScreen}`,
    `bracketedPaste: ${caps.bracketedPaste}`,
    '',
    '--- input liveness ---',
    'press keys now; the first arrival is appended below.',
    'if nothing appears here, input is not reaching the process.',
  ];
  return `${lines.join('\n')}\n`;
}

/** Identify the JavaScript runtime for the report (Bun is distinguished from Node). */
function detectRuntime(): string {
  const bun = (globalThis as { Bun?: { version?: string } }).Bun;
  if (bun !== undefined) return `bun ${bun.version ?? 'unknown'}`;
  return `node ${process.versions.node ?? 'unknown'}`;
}

/** Read a stream's optional `isRaw` flag without asserting it exists on the type. */
function readIsRaw(input: NodeJS.ReadStream): boolean | undefined {
  return (input as { isRaw?: boolean }).isRaw;
}

/** Render a byte sequence as space-separated two-digit hex for the report. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Start the input diagnostics if {@link INPUT_DIAG_ENV} is set, writing the
 * opening snapshot to its file immediately and returning a handle that records
 * the first input arrival. Returns `null` when the flag is off, so callers gate
 * on the result. Every file operation is best-effort and swallows its errors — a
 * diagnostic must never disrupt the app it is diagnosing.
 *
 * @param params The environment, bound streams, host TTY verdict, and resolved caps.
 * @returns A live {@link InputDiagnostics} handle, or `null` when disabled.
 */
export function createInputDiagnostics(params: {
  env: NodeJS.ProcessEnv;
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
  hostIsTTY: boolean;
  caps: CapabilityProfile;
}): InputDiagnostics | null {
  const path = resolveInputDiagPath(params.env);
  if (path === null) return null;

  const snapshot: InputDiagSnapshot = {
    env: params.env,
    platform: process.platform,
    runtime: detectRuntime(),
    inputIsTTY: Boolean(params.input.isTTY),
    outputIsTTY: Boolean(params.output.isTTY),
    hostIsTTY: params.hostIsTTY,
    hasSetRawMode: typeof params.input.setRawMode === 'function',
    isRaw: readIsRaw(params.input),
    caps: params.caps,
  };

  try {
    writeFileSync(path, collectInputDiagnostics(snapshot));
  } catch {
    // Cannot open the report file (permissions, bad path) — disable silently.
    return null;
  }

  let logged = false;
  return {
    noteInput(chunk: Uint8Array | string): void {
      if (logged) return;
      logged = true;
      try {
        const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
        appendFileSync(path, `\ninput received: ${bytes.length} byte(s): ${toHex(bytes)}\n`);
      } catch {
        // Best-effort: never let a diagnostic write disrupt the input pump.
      }
    },
  };
}
