/**
 * Ambiguous-width startup probe & warning (RD-11 follow-up).
 *
 * The chrome glyphs jsvision draws — scroll arrows/thumbs (`▲▼◄►■▒▓`) and, more
 * broadly, any East-Asian *Ambiguous* code point — render one cell on most
 * terminals but TWO cells when the emulator falls back to a wide font for a
 * missing glyph, or under a CJK/ambiguous-width locale. There is no way to query
 * a terminal's font, so this measures the only thing that matters: how many
 * columns the glyphs actually advance.
 *
 * The technique is a Cursor-Position-Report (CPR) probe: home the cursor to
 * column 1, print the probe glyphs, request the cursor position (DSR `ESC[6n`),
 * and read the terminal's `ESC[<row>;<col>R` reply. The advance is `col - 1`; if
 * it exceeds the probe's code-point count, at least one glyph rendered wide.
 *
 * This runs over the same injectable {@link TerminalQuery} seam the layer-2
 * capability probe uses (`capability/query.ts`), so it is fully testable without a
 * real terminal and shares the bounded-timeout, untrusted-response posture: the
 * reply is parsed as data only (no code execution), under a byte cap and a single
 * timeout, and any failure degrades to "not probed" rather than throwing.
 *
 * The caller must run this on a real interactive TTY in raw mode, BEFORE entering
 * the alternate screen (so the probe glyph + its erase happen on the normal
 * screen and never corrupt the UI). On a non-TTY / silent terminal the probe
 * simply reports `probed:false` and no warning is emitted.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { TerminalQuery } from '../capability/profile.js';

/** ESC (`\x1b`) and the CSI/CPR grammar bytes, as numeric code points. */
const BYTE_ESC = 0x1b;
const BYTE_BRACKET = 0x5b; // '['
const BYTE_SEMI = 0x3b; // ';'
const BYTE_R = 0x52; // 'R'
const BYTE_ZERO = 0x30;
const BYTE_NINE = 0x39;

/** Default whole-probe timeout in milliseconds (mirrors the layer-2 query budget). */
export const DEFAULT_WIDTH_PROBE_TIMEOUT_MS = 200;

/** Maximum retained CPR-reply bytes before giving up (untrusted-response cap). */
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
 * The default probe string: the East-Asian *Ambiguous* chrome glyphs jsvision
 * draws (scroll arrows, thumb, shades). Each is a single code point expected to
 * advance one column; a wider total means the terminal renders them double-width.
 */
export const AMBIGUOUS_PROBE_GLYPHS = '\u25B2\u25BC\u25C4\u25BA\u25A0\u2592\u2593'; // ▲▼◄►■▒▓

/** The one-line console warning emitted when the probe finds double-width chrome. */
export const WIDTH_WARNING_MESSAGE =
  'jsvision: this terminal renders box/scroll glyphs at double width ' +
  '(likely a font fallback for missing glyphs, or a CJK/ambiguous-width locale). ' +
  'TUI alignment may shift. Fix: use a monospaced font with full Unicode coverage, ' +
  'or enable ASCII-safe glyphs.';

/** A parsed Cursor-Position-Report: 1-based row and column, as the terminal reports them. */
export interface CursorPosition {
  readonly row: number;
  readonly col: number;
}

/** The outcome of an ambiguous-width probe. */
export interface WidthProbeResult {
  /** True iff the terminal answered with a usable CPR (a measurement was obtained). */
  readonly probed: boolean;
  /** The probe's code-point count — the column advance a narrow-rendering terminal produces. */
  readonly expectedWidth: number;
  /** The measured column advance, or `null` when the terminal did not answer. */
  readonly measuredWidth: number | null;
  /** True iff the measured advance exceeds {@link expectedWidth} (glyphs render wide). */
  readonly ambiguousWide: boolean;
}

/** Options for {@link probeAmbiguousWidth}. */
export interface WidthProbeOptions {
  /** Probe string (default {@link AMBIGUOUS_PROBE_GLYPHS}); measured by code-point count. */
  readonly glyphs?: string;
  /** Whole-probe timeout in ms (default {@link DEFAULT_WIDTH_PROBE_TIMEOUT_MS}). */
  readonly timeoutMs?: number;
}

/** Options for {@link warnIfAmbiguousWide}: the probe options plus a warning sink. */
export interface WidthWarnOptions extends WidthProbeOptions {
  /** Warning sink (default: a single line to `process.stderr`). Injected for tests. */
  readonly warn?: (message: string) => void;
}

/**
 * Parse the first well-formed Cursor-Position-Report `ESC [ <row> ; <col> R` out
 * of a byte buffer, ignoring any surrounding bytes.
 *
 * Untrusted-safe: it only scans, never executes; row/col are bounded to
 * {@link MAX_CPR_DIGITS} digits so a malicious flood cannot build a huge number.
 *
 * @param buf Raw bytes received from the terminal.
 * @returns The parsed 1-based {@link CursorPosition}, or `null` if none is present.
 */
export function parseCursorPosition(buf: Uint8Array): CursorPosition | null {
  for (let i = 0; i + 1 < buf.length; i += 1) {
    if (buf[i] !== BYTE_ESC || buf[i + 1] !== BYTE_BRACKET) continue;
    let j = i + 2;
    const row = readNumber(buf, j);
    if (row === null || buf[row.end] !== BYTE_SEMI) continue;
    j = row.end + 1;
    const col = readNumber(buf, j);
    if (col === null || buf[col.end] !== BYTE_R) continue;
    return { row: row.value, col: col.value };
  }
  return null;
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

/**
 * Measure how many columns the probe glyphs advance on the live terminal.
 *
 * Writes `CR + glyphs + DSR(6n)`, reads the CPR reply under a bounded timeout,
 * then erases the probe artifact. Always resolves, never rejects: a throwing
 * `write`/`read`, a silent terminal (timeout), or an oversized reply all yield
 * `probed:false`.
 *
 * @param query The injected terminal stream seam (real TTY or a test double).
 * @param options Probe string + timeout overrides.
 * @returns The {@link WidthProbeResult}.
 */
export async function probeAmbiguousWidth(
  query: TerminalQuery,
  options: WidthProbeOptions = {},
): Promise<WidthProbeResult> {
  const glyphs = options.glyphs ?? AMBIGUOUS_PROBE_GLYPHS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_WIDTH_PROBE_TIMEOUT_MS;
  const expectedWidth = [...glyphs].length; // code points, not UTF-16 units

  try {
    query.write(HOME_COLUMN + glyphs + CPR_REQUEST);
  } catch {
    // Cannot even issue the probe (e.g. closed stream) → not probed.
    return { probed: false, expectedWidth, measuredWidth: null, ambiguousWide: false };
  }

  let position: CursorPosition | null = null;
  try {
    position = await readCpr(query, timeoutMs);
  } catch {
    position = null;
  }

  // Always erase the probe glyphs, even if the read failed, so the primary
  // screen is left clean before the app starts.
  try {
    query.write(CLEANUP);
  } catch {
    // Best-effort cleanup; a failing write here is non-fatal.
  }

  if (position === null) {
    return { probed: false, expectedWidth, measuredWidth: null, ambiguousWide: false };
  }
  // Homed to column 1, so the advance is the reported column minus 1.
  const measuredWidth = Math.max(0, position.col - 1);
  return { probed: true, expectedWidth, measuredWidth, ambiguousWide: measuredWidth > expectedWidth };
}

/**
 * Read the terminal's CPR reply under a single bounded timeout, into a
 * length-capped buffer, returning as soon as a complete CPR is parsed.
 *
 * @returns The parsed {@link CursorPosition}, or `null` on timeout/overflow/end/error.
 */
async function readCpr(query: TerminalQuery, timeoutMs: number): Promise<CursorPosition | null> {
  const collected: number[] = [];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  const readLoop: Promise<CursorPosition | null> = (async () => {
    try {
      for await (const chunk of query.read()) {
        for (const byte of chunk) {
          collected.push(byte);
          if (collected.length > CPR_BUFFER_CAP) return null; // oversized → give up
        }
        const parsed = parseCursorPosition(Uint8Array.from(collected));
        if (parsed !== null) return parsed; // early exit — a full CPR arrived
      }
      return null; // stream ended without a CPR
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

/** The default warning sink: one newline-terminated line to stderr (never the UI stream). */
function defaultWarn(message: string): void {
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
}

/**
 * Probe the terminal for double-width chrome glyphs and, if found, emit a single
 * warning. Intended to run once at startup (real TTY, raw mode, before the
 * alternate screen). Silent/non-TTY terminals produce no warning.
 *
 * @param query The injected terminal stream seam.
 * @param options Probe overrides plus an optional `warn` sink (default: stderr).
 * @returns The {@link WidthProbeResult} (so the caller can also act on it).
 */
export async function warnIfAmbiguousWide(
  query: TerminalQuery,
  options: WidthWarnOptions = {},
): Promise<WidthProbeResult> {
  const warn = options.warn ?? defaultWarn;
  const result = await probeAmbiguousWidth(query, options);
  if (result.ambiguousWide) {
    warn(WIDTH_WARNING_MESSAGE);
  }
  return result;
}
