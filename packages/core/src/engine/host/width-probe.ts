/**
 * Startup probe that detects when the terminal renders the SDK's box/scroll
 * chrome glyphs at double width, and helpers to warn or adapt when it does.
 *
 * The chrome glyphs the SDK draws — scroll arrows/thumbs and box-drawing frames —
 * render one cell wide on most terminals but TWO cells when the emulator falls
 * back to a wide font for a missing glyph, or under a CJK/ambiguous-width locale.
 * A double-wide glyph shears the layout. There is no way to query a terminal's
 * font, so this measures the only thing that matters: how many columns the glyphs
 * actually advance.
 *
 * The technique is a Cursor-Position-Report probe: home the cursor to column 1,
 * print the probe glyphs, ask the terminal where the cursor is now, and read its
 * `ESC[<row>;<col>R` reply. The advance is `col - 1`; if it exceeds the number of
 * glyphs printed, at least one rendered wide.
 *
 * Two groups are measured in one pass, each re-homed to column 1 so their
 * advances are independent: the fallback-prone arrow/geometric set (which, when
 * wide, turns on the `ambiguousWide` glyph flag) and a box-drawing + shade sample
 * (which turns `boxDrawing`/`halfBlocks` off).
 *
 * This runs over the same injectable {@link TerminalQuery} the async capability
 * detection uses, so it is fully testable without a real terminal, and it is
 * robust to a hostile or silent terminal: replies are parsed as data only, under
 * a byte cap and a single timeout, and any failure degrades to "not probed"
 * rather than throwing.
 *
 * Run it on a real interactive TTY in raw mode, BEFORE entering the alternate
 * screen, so the probe glyphs and their erase land on the normal screen and never
 * corrupt your UI. On a non-TTY or silent terminal it simply reports
 * `probed: false` and emits no warning. (The host does all this for you when you
 * pass `warnAmbiguousWidth` / `adaptAmbiguousWidth`.)
 */
import type { CapabilityProfile, TerminalQuery } from '../capability/profile.js';

/** ESC (`\x1b`) and the CSI/CPR grammar bytes, as numeric code points. */
const BYTE_ESC = 0x1b;
const BYTE_BRACKET = 0x5b; // '['
const BYTE_SEMI = 0x3b; // ';'
const BYTE_R = 0x52; // 'R'
const BYTE_ZERO = 0x30;
const BYTE_NINE = 0x39;

/** Default whole-probe timeout in milliseconds (mirrors the layer-2 query budget). */
export const DEFAULT_WIDTH_PROBE_TIMEOUT_MS = 200;

/** Maximum retained CPR-reply bytes before giving up (untrusted-response cap, spans both replies). */
const CPR_BUFFER_CAP = 256;

/** Maximum digits accepted for a CPR row/col field (overflow guard). */
const MAX_CPR_DIGITS = 6;

/** Request the cursor position (DSR 6 → the terminal replies with a CPR). */
const CPR_REQUEST = '\x1b[6n';

/** Move the cursor to column 1 of the current line (deterministic probe origin). */
const HOME_COLUMN = '\r';

/** Erase the probe artifact: return to column 1 and clear the whole line. */
const CLEANUP = '\r\x1b[2K';

/**
 * The arrow/geometric probe group: the fallback-prone chrome the SDK draws
 * (scroll arrows, submenu/input arrows, radio mark, zoom/restore/close icons).
 * When this group renders wide, the `ambiguousWide` glyph flag is turned on.
 */
export const AMBIGUOUS_PROBE_GLYPHS = '▲▼◄►•↑↕×';

/**
 * The box-drawing + shade probe group (corners, edges, shades). When this group
 * renders wide, the `boxDrawing` and `halfBlocks` glyph flags are turned off.
 */
export const BOX_PROBE_GLYPHS = '┌┐└┘─│▒█';

/** The one-line console warning emitted when a wide group is found but NOT adapted. */
export const WIDTH_WARNING_MESSAGE =
  'jsvision: this terminal renders box/scroll glyphs at double width ' +
  '(font fallback or CJK/ambiguous-width locale). TUI alignment may shift. ' +
  'Fix: use a monospaced font with full Unicode coverage, or set JSVISION_ASCII=1.';

/** The one-line console notice emitted when a wide group is found AND auto-adapted. */
export const WIDTH_ADAPTED_MESSAGE =
  'jsvision: this terminal renders box/scroll glyphs at double width; ' +
  'ASCII-safe glyphs enabled automatically. For full fidelity use a ' +
  'monospaced font with full Unicode coverage.';

/** A parsed Cursor-Position-Report: 1-based row and column, as the terminal reports them. */
export interface CursorPosition {
  readonly row: number;
  readonly col: number;
}

/** Per-group width measurement (arrows or boxes). */
export interface WidthProbeGroupResult {
  /** The group's code-point count — the advance a narrow-rendering terminal produces. */
  readonly expectedWidth: number;
  /** The measured column advance for this group, or `null` when the terminal did not answer. */
  readonly measuredWidth: number | null;
  /** True iff the measured advance exceeds {@link expectedWidth} (this group renders wide). */
  readonly wide: boolean;
}

/** The outcome of a two-group ambiguous-width probe. */
export interface WidthProbeResult {
  /** True only when the terminal answered BOTH groups with usable position reports. */
  readonly probed: boolean;
  /** The arrow/geometric chrome group. */
  readonly arrows: WidthProbeGroupResult;
  /** The box-drawing + shade group. */
  readonly boxes: WidthProbeGroupResult;
}

/** Options for {@link probeAmbiguousWidth}. */
export interface WidthProbeOptions {
  /** Group-1 probe string (default {@link AMBIGUOUS_PROBE_GLYPHS}); measured by code-point count. */
  readonly arrowGlyphs?: string;
  /** Group-2 probe string (default {@link BOX_PROBE_GLYPHS}); measured by code-point count. */
  readonly boxGlyphs?: string;
  /** Whole-probe timeout in ms (default {@link DEFAULT_WIDTH_PROBE_TIMEOUT_MS}), shared by both groups. */
  readonly timeoutMs?: number;
}

/** Options for {@link warnIfAmbiguousWide}: the probe options plus a warning sink + variant. */
export interface WidthWarnOptions extends WidthProbeOptions {
  /** Warning sink (default: a single line to `process.stderr`). Injected for tests. */
  readonly warn?: (message: string) => void;
  /** When true, the emitted message reports automatic adaptation ({@link WIDTH_ADAPTED_MESSAGE}). */
  readonly adapted?: boolean;
}

/**
 * Find the first well-formed Cursor-Position-Report `ESC [ <row> ; <col> R` at or
 * after `from`, returning both the parsed position and the index past its `R`.
 *
 * Untrusted-safe: it only scans, never executes; row/col are bounded to
 * {@link MAX_CPR_DIGITS} digits so a malicious flood cannot build a huge number.
 */
function findCursorPosition(buf: Uint8Array, from: number): { position: CursorPosition; end: number } | null {
  for (let i = from; i + 1 < buf.length; i += 1) {
    if (buf[i] !== BYTE_ESC || buf[i + 1] !== BYTE_BRACKET) continue;
    let j = i + 2;
    const row = readNumber(buf, j);
    if (row === null || buf[row.end] !== BYTE_SEMI) continue;
    j = row.end + 1;
    const col = readNumber(buf, j);
    if (col === null || buf[col.end] !== BYTE_R) continue;
    return { position: { row: row.value, col: col.value }, end: col.end + 1 };
  }
  return null;
}

/**
 * Parse the first Cursor-Position-Report (`ESC [ <row> ; <col> R`) out of a byte
 * buffer, ignoring any surrounding bytes. Rows and columns are 1-based, as the
 * terminal reports them.
 *
 * @param buf Raw bytes received from the terminal.
 * @returns The parsed 1-based {@link CursorPosition}, or `null` if none is present.
 * @example
 * import { parseCursorPosition } from '@jsvision/core';
 *
 * const reply = new TextEncoder().encode('\x1b[12;40R');
 * parseCursorPosition(reply); // => { row: 12, col: 40 }
 * parseCursorPosition(new TextEncoder().encode('no report here')); // => null
 */
export function parseCursorPosition(buf: Uint8Array): CursorPosition | null {
  const found = findCursorPosition(buf, 0);
  return found === null ? null : found.position;
}

/** Parse two sequential CPRs from one buffer; `null` unless BOTH are present. */
function parseTwoCursorPositions(buf: Uint8Array): [CursorPosition, CursorPosition] | null {
  const first = findCursorPosition(buf, 0);
  if (first === null) return null;
  const second = findCursorPosition(buf, first.end);
  if (second === null) return null;
  return [first.position, second.position];
}

/** Read a bounded run of ASCII digits starting at `start`; `null` if none. */
function readNumber(buf: Uint8Array, start: number): { value: number; end: number } | null {
  let value = 0;
  let end = start;
  while (end < buf.length && buf[end] >= BYTE_ZERO && buf[end] <= BYTE_NINE) {
    if (end - start >= MAX_CPR_DIGITS) return null; // overflow guard
    value = value * 10 + (buf[end] - BYTE_ZERO);
    end += 1;
  }
  return end === start ? null : { value, end };
}

/** Build a per-group result from expected/measured advances. */
function groupResult(expectedWidth: number, measuredWidth: number): WidthProbeGroupResult {
  return { expectedWidth, measuredWidth, wide: measuredWidth > expectedWidth };
}

/** The "not probed" degrade shape: both groups unmeasured, nothing wide. */
function notProbed(arrowsExpected: number, boxesExpected: number): WidthProbeResult {
  return {
    probed: false,
    arrows: { expectedWidth: arrowsExpected, measuredWidth: null, wide: false },
    boxes: { expectedWidth: boxesExpected, measuredWidth: null, wide: false },
  };
}

/**
 * Measure how many columns each probe group advances on the live terminal.
 *
 * Writes `CR + arrows + DSR + CR + boxes + DSR`, reads both CPR replies under one
 * bounded timeout, then erases the probe artifact. Always resolves, never rejects:
 * a throwing `write`/`read`, a silent terminal (timeout), a single-group reply, or
 * an oversized reply all yield `probed:false` with both groups unmeasured.
 *
 * @param query The terminal to probe (a real TTY-backed query or a test double).
 * @param options Per-group probe strings + shared timeout overrides.
 * @returns The {@link WidthProbeResult}; `probed: false` if the terminal did not answer.
 * @example
 * import { createTerminalQuery, probeAmbiguousWidth } from '@jsvision/core';
 *
 * // On a real TTY in raw mode, before entering the alternate screen:
 * const query = createTerminalQuery();
 * try {
 *   const result = await probeAmbiguousWidth(query);
 *   if (result.probed && (result.arrows.wide || result.boxes.wide)) {
 *     console.error('terminal renders chrome glyphs double-width');
 *   }
 * } finally {
 *   query.close();
 * }
 */
export async function probeAmbiguousWidth(
  query: TerminalQuery,
  options: WidthProbeOptions = {},
): Promise<WidthProbeResult> {
  const arrowGlyphs = options.arrowGlyphs ?? AMBIGUOUS_PROBE_GLYPHS;
  const boxGlyphs = options.boxGlyphs ?? BOX_PROBE_GLYPHS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_WIDTH_PROBE_TIMEOUT_MS;
  const arrowsExpected = [...arrowGlyphs].length; // code points, not UTF-16 units
  const boxesExpected = [...boxGlyphs].length;

  try {
    // Both groups re-home to column 1, so each advance is measured independently.
    query.write(HOME_COLUMN + arrowGlyphs + CPR_REQUEST + HOME_COLUMN + boxGlyphs + CPR_REQUEST);
  } catch {
    // Cannot even issue the probe (e.g. closed stream) → not probed.
    return notProbed(arrowsExpected, boxesExpected);
  }

  let pair: [CursorPosition, CursorPosition] | null = null;
  try {
    pair = await readBothCprs(query, timeoutMs);
  } catch {
    pair = null;
  }

  // Always erase the probe glyphs, even if the read failed, so the primary
  // screen is left clean before the app starts.
  try {
    query.write(CLEANUP);
  } catch {
    // Best-effort cleanup; a failing write here is non-fatal.
  }

  if (pair === null) {
    return notProbed(arrowsExpected, boxesExpected);
  }
  // Each group homed to column 1, so its advance is the reported column minus 1.
  const arrowsMeasured = Math.max(0, pair[0].col - 1);
  const boxesMeasured = Math.max(0, pair[1].col - 1);
  return {
    probed: true,
    arrows: groupResult(arrowsExpected, arrowsMeasured),
    boxes: groupResult(boxesExpected, boxesMeasured),
  };
}

/**
 * Read the terminal's two CPR replies under a single bounded timeout, into a
 * length-capped buffer, returning as soon as both are parsed.
 *
 * @returns The parsed `[arrows, boxes]` positions, or `null` on timeout/overflow/
 *   end/error or when only one reply arrived.
 */
async function readBothCprs(query: TerminalQuery, timeoutMs: number): Promise<[CursorPosition, CursorPosition] | null> {
  const collected: number[] = [];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  const readLoop: Promise<[CursorPosition, CursorPosition] | null> = (async () => {
    try {
      for await (const chunk of query.read()) {
        for (const byte of chunk) {
          collected.push(byte);
          if (collected.length > CPR_BUFFER_CAP) return null; // oversized → give up
        }
        const pair = parseTwoCursorPositions(Uint8Array.from(collected));
        if (pair !== null) return pair; // early exit — both CPRs arrived
      }
      return null; // stream ended without both CPRs
    } catch {
      return null; // a throwing stream degrades to no measurement
    }
  })();

  try {
    const outcome = await Promise.race([readLoop, timeout]);
    return outcome === 'timeout' || outcome === null ? null : outcome;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Apply a probe outcome to a capability profile — downgrade only, never upgrade.
 * A wide arrow group turns `ambiguousWide` on; a wide box group turns
 * `boxDrawing` and `halfBlocks` off. Returns the same object reference when
 * nothing changed. Pure.
 *
 * @param caps The capability profile to degrade.
 * @param result A completed {@link WidthProbeResult}.
 * @returns A new profile with the affected glyph flags degraded, or `caps` unchanged.
 * @example
 * import { createTerminalQuery, probeAmbiguousWidth, degradeCapsForWidth, resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const query = createTerminalQuery();
 *
 * // Adapt your render caps so every subsequent frame emits aligned chrome.
 * const result = await probeAmbiguousWidth(query);
 * const renderCaps = degradeCapsForWidth(caps, result);
 * // ... serialize(frame, prev, { caps: renderCaps }) ...
 */
export function degradeCapsForWidth(caps: CapabilityProfile, result: WidthProbeResult): CapabilityProfile {
  let glyphs = caps.glyphs;
  if (result.arrows.wide) glyphs = { ...glyphs, ambiguousWide: true };
  if (result.boxes.wide) glyphs = { ...glyphs, boxDrawing: false, halfBlocks: false };
  return glyphs === caps.glyphs ? caps : { ...caps, glyphs };
}

/**
 * Force a capability profile fully ASCII-safe: box-drawing and half-blocks off,
 * ambiguous-wide on, so every chrome glyph maps to plain ASCII when rendered.
 * This is the shape the host uses when `JSVISION_ASCII` is set. Pure.
 *
 * @param caps The capability profile to degrade.
 * @returns A new profile with all three glyph flags at their ASCII-safe setting.
 * @example
 * import { resolveCapabilities, degradeCapsFully, serialize } from '@jsvision/core';
 *
 * const caps = degradeCapsFully(resolveCapabilities().profile);
 * // serialize(frame, prev, { caps }) now emits ASCII box/scroll chrome.
 */
export function degradeCapsFully(caps: CapabilityProfile): CapabilityProfile {
  return { ...caps, glyphs: { ...caps.glyphs, boxDrawing: false, halfBlocks: false, ambiguousWide: true } };
}

/**
 * Whether a capability profile already renders as pure ASCII, so the width probe
 * can be skipped with nothing to learn or swap. Pure.
 *
 * True when UTF-8 output is off (every glyph above U+007F already becomes `?`,
 * and probing would only write raw UTF-8 to a non-UTF-8 terminal), or when the
 * glyph flags are already fully degraded (box/half off, ambiguous-wide on).
 *
 * @param caps The capability profile to test.
 * @returns True when the probe can be skipped with no loss of fidelity.
 * @example
 * import { resolveCapabilities, isAsciiSafe, degradeCapsFully } from '@jsvision/core';
 *
 * isAsciiSafe(resolveCapabilities().profile);         // typically false on a UTF-8 terminal
 * isAsciiSafe(degradeCapsFully(resolveCapabilities().profile)); // => true
 */
export function isAsciiSafe(caps: CapabilityProfile): boolean {
  return !caps.unicode.utf8 || (!caps.glyphs.boxDrawing && !caps.glyphs.halfBlocks && caps.glyphs.ambiguousWide);
}

/** The default warning sink: one newline-terminated line to stderr (never the UI stream). */
function defaultWarn(message: string): void {
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
}

/**
 * Probe the terminal for double-width chrome glyphs and, if a group is wide, emit
 * one warning line. Meant to run once at startup on a real TTY in raw mode,
 * before entering the alternate screen. A silent or non-TTY terminal produces no
 * warning. Returns the probe result too, so you can also adapt your render caps.
 *
 * @param query The terminal to probe.
 * @param options Probe overrides, an optional `warn` sink (default: one line to stderr),
 *   and the `adapted` flag, which selects the "adapted automatically" wording.
 * @returns The {@link WidthProbeResult}.
 * @example
 * import { createTerminalQuery, warnIfAmbiguousWide, degradeCapsForWidth, resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const query = createTerminalQuery();
 * try {
 *   // Warn the user, and adapt render caps in one probe run.
 *   const result = await warnIfAmbiguousWide(query, { adapted: true });
 *   const renderCaps = degradeCapsForWidth(caps, result);
 * } finally {
 *   query.close();
 * }
 */
export async function warnIfAmbiguousWide(
  query: TerminalQuery,
  options: WidthWarnOptions = {},
): Promise<WidthProbeResult> {
  const warn = options.warn ?? defaultWarn;
  const result = await probeAmbiguousWidth(query, options);
  if (result.arrows.wide || result.boxes.wide) {
    warn(options.adapted ? WIDTH_ADAPTED_MESSAGE : WIDTH_WARNING_MESSAGE);
  }
  return result;
}
