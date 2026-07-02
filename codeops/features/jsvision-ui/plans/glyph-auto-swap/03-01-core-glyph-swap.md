# Core Glyph Swap: Glyph Auto-Swap Fallback

> **Document**: 03-01-core-glyph-swap.md
> **Parent**: [Index](00-index.md)

## Overview

One component doc covers the whole slice (AR-1: compact plan): the capability flag, the
fallback map, the two-group probe, the host effective-caps wiring + `JSVISION_ASCII`, the
warning variants, and the ui option threading. No TV-fidelity gate applies — this is a
degradation path, not TV chrome (the faithful glyphs stay the default).

## Architecture

### Current
`host.start()` → probe (aggregate) → warn → discard. `serialize(next, prev, { caps })` uses
the app-resolved caps verbatim (`host.ts:239`); `fallbackGlyph` has no entries for the 8
arrow/geometric chrome glyphs.

### Proposed
```
createHost(options)
  caps            = options.caps                       (unchanged, feeds decode/modes/restore)
  effectiveCaps   = asciiForced(env) ? degradeAll(caps) : caps     ← serialize-only view
start()  [isTTY]
  if (warn || adapt) && !asciiSafe(effectiveCaps):
      result = probeAmbiguousWidth(query)              ← two groups, one timeout
      if adapt:  effectiveCaps = degradeForWidth(effectiveCaps, result)
      if warn && (result.arrows.wide || result.boxes.wide): warn(variant per adapt)
render() → serialize(next, prev, { caps: effectiveCaps })
resume (SIGCONT) → serialize(last, null, { caps: getSerializeCaps() })   ← signals repaint
```
Decode, mode strings, and restore keep the original `caps` — glyph flags play no role there.
The signals **resume repaint** does NOT: `signals.ts:118` re-serializes the last buffer on
SIGCONT, so `installSignals` gains a `getSerializeCaps: () => effectiveCaps` seam (mirroring
the existing `getLastBuffer` getter) and the repaint uses it — otherwise one suspend/resume
would repaint un-swapped wide glyphs, and since `render()`'s `prev` holds the same *logical*
chars the shear would persist until those cells change (PF-001). The probe still runs in the
raw-mode → pre-alt-screen window (**Decision per AR-4**).

## Implementation Details

### 1. Capability flag — `capability/profile.ts`, `capability/defaults.ts`

```ts
/** Line/box glyph rendering capabilities. */
export interface GlyphCaps {
  readonly boxDrawing: boolean;
  readonly halfBlocks: boolean;
  /**
   * True when the terminal renders the fallback-prone arrow/geometric chrome
   * glyphs (▲▼◄►•↑↕× — mostly East-Asian-Ambiguous; ◄► are EAW-Neutral but
   * equally font-fallback-prone, PF-007) double-width — the serializer then
   * swaps them to ASCII (see render/glyphs.ts AMBIGUOUS_FALLBACK). Default
   * false. (AR-5)
   */
  readonly ambiguousWide: boolean;
}
```
`CONSERVATIVE_DEFAULTS.glyphs` becomes `{ boxDrawing: false, halfBlocks: false,
ambiguousWide: false }` — defect polarity keeps the all-false convention and existing
`override.glyphs` app code deep-merges unchanged (**Decision per AR-5**). Grouped under the
existing `glyphs` reason — `CapabilityReasons` is untouched.

### 2. Fallback map — `render/glyphs.ts`

```ts
/**
 * Fallback-prone (mostly EAW-Ambiguous, PF-007) chrome glyphs → ASCII when
 * `glyphs.ambiguousWide` is set — the ncurses-ACS-style degradations (AR-7).
 * Disjoint from BOX_FALLBACK and BLOCK_SHADE (verified:
 * U+25B2/25BC/25C4/25BA/2022/2191/2195/00D7).
 */
const AMBIGUOUS_FALLBACK: ReadonlyMap<string, string> = new Map([
  ['▲', '^'], ['▼', 'v'],   // ▲ ▼ scroll arrows
  ['◄', '<'], ['►', '>'],   // ◄ ► scroll/input arrows, submenu
  ['•', '*'],                    // • radio mark
  ['↑', '^'], ['↕', 'v'],   // ↑ ↕ zoom / restore icons
  ['×', 'x'],                    // × close icon
]);
```
`fallbackGlyph` checks this map **first** (most specific; no key collides with the other
tables), before the existing `boxDrawing` / `halfBlocks` / `utf8` steps
(**Decision per AR-7**; ordering is collision-free so purely stylistic).

### 3. Two-group probe — `host/width-probe.ts` (amended in place, AR-16)

```ts
/** Group 1: the arrow/geometric chrome set — flips `ambiguousWide` when wide. (AR-6) */
export const AMBIGUOUS_PROBE_GLYPHS = '▲▼◄►•↑↕×'; // ▲▼◄►•↑↕×
/** Group 2: box-drawing + shade sample — flips `boxDrawing`/`halfBlocks` when wide. (AR-6) */
export const BOX_PROBE_GLYPHS = '┌┐└┘─│▒█'; // ┌┐└┘─│▒█

/** Per-group measurement. */
export interface WidthProbeGroupResult {
  readonly expectedWidth: number;          // code-point count
  readonly measuredWidth: number | null;   // null when unanswered
  readonly wide: boolean;                  // measured > expected
}
/** Amended outcome (AR-16 in-place evolution of the 217f9ea shape). */
export interface WidthProbeResult {
  readonly probed: boolean;                // both groups answered with usable CPRs
  readonly arrows: WidthProbeGroupResult;  // group 1
  readonly boxes: WidthProbeGroupResult;   // group 2
}
```
Probe sequence (one pass, one shared `timeoutMs` budget, same untrusted-response posture —
byte cap, digit cap, parse-as-data):
`\r` + group 1 + `ESC[6n` → read CPR → `\r` + group 2 + `ESC[6n` → read CPR → `\r ESC[2K`
cleanup. The CPR parser is extended to consume two sequential `ESC[<row>;<col>R` replies from
the same byte stream. Any failure (timeout, cap, malformed) → `probed: false`, both groups
`measuredWidth: null`, `wide: false` — never throws (existing contract preserved, AR-12
non-goal 6).

```ts
/** Pure: apply a probe outcome to caps — downgrade only, never upgrade. (AR-6) */
export function degradeCapsForWidth(caps: CapabilityProfile, result: WidthProbeResult): CapabilityProfile;
// arrows.wide → glyphs.ambiguousWide = true
// boxes.wide  → glyphs.boxDrawing = false, glyphs.halfBlocks = false

/** Pure: fully ASCII-safe caps — the JSVISION_ASCII / degradeAll shape. (AR-15) */
export function degradeCapsFully(caps: CapabilityProfile): CapabilityProfile;

/** Pure: nothing left to probe or swap? (AR-13, PF-003) */
export function isAsciiSafe(caps: CapabilityProfile): boolean;
// = !unicode.utf8 || (!glyphs.boxDrawing && !glyphs.halfBlocks && glyphs.ambiguousWide)
// utf8 off ⇒ every glyph above U+007F already emits '?' (render/glyphs.ts:76-79),
// so output is fully ASCII regardless of the glyph flags — probing would write raw
// UTF-8 bytes to a non-UTF-8 terminal (mojibake + a false "wide") for zero gain.
```

`WidthProbeOptions` is amended in the same AR-16 pass (PF-004): the single probe-string
override `glyphs?: string` is replaced by `arrowGlyphs?: string` / `boxGlyphs?: string`
(each defaulting to its exported constant), preserving the test-injection purpose under the
grouped contract.
`warnIfAmbiguousWide(query, options)` keeps its signature; `WidthWarnOptions` gains
`adapted?: boolean` selecting the message variant (**Decision per AR-10/16**). It returns the
`WidthProbeResult` so the host reuses the single probe run for both warn and adapt (AR-9).

### Warning messages (exact texts, AR-10)

```ts
export const WIDTH_ADAPTED_MESSAGE =
  'jsvision: this terminal renders box/scroll glyphs at double width; ' +
  'ASCII-safe glyphs enabled automatically. For full fidelity use a ' +
  'monospaced font with full Unicode coverage.';

export const WIDTH_WARNING_MESSAGE =
  'jsvision: this terminal renders box/scroll glyphs at double width ' +
  '(font fallback or CJK/ambiguous-width locale). TUI alignment may shift. ' +
  'Fix: use a monospaced font with full Unicode coverage, or set JSVISION_ASCII=1.';
```

### 4. Host wiring — `host/types.ts`, `host/host.ts`, `host/signals.ts`

```ts
// HostOptions (additive, AR-9/15):
/** Adapt effective serialize caps when the probe measures wide chrome. Default false. (AR-9) */
readonly adaptAmbiguousWidth?: boolean;
/** Environment for the JSVISION_ASCII force switch. Default process.env. Injected for tests. (AR-15) */
readonly env?: NodeJS.ProcessEnv;
```
`host.ts`: `let effectiveCaps = (options.env ?? process.env).JSVISION_ASCII !== undefined ?
degradeCapsFully(caps) : caps` at creation (presence = on, any value including `''` —
NO_COLOR-style, AR-8). `render()` serializes with `effectiveCaps`. In `start()`, the probe
block becomes: run when `isTTY && (warnAmbiguousWidth || adaptAmbiguousWidth) &&
!isAsciiSafe(effectiveCaps)` (**Decision per AR-13** — skip covers the env-forced,
already-degraded, and utf8-off cases, PF-003); on a wide result, adapt first (when enabled),
then warn once with the variant matching whether adaptation ran. `installSignals` (called
after the probe block, `host.ts:186`) additionally receives
`getSerializeCaps: () => effectiveCaps`, and the SIGCONT resume repaint in `signals.ts:118`
switches from `ctx.caps` to `ctx.getSerializeCaps()` — the only other frame-content serialize
site (PF-001; verified by sweep — restore/modes/decode emit no buffer-derived output).
Best-effort posture unchanged: a probe throw can neither block nor crash startup
(`host.ts:140` contract).

### 5. ui threading — `packages/ui/src/app/{run,application}.ts` (AR-9/17)

`RunContext`/`ApplicationOptions` gain `adaptAmbiguousWidth?: boolean`; `runApplication`
passes `ctx.adaptAmbiguousWidth ?? true` to `createHost` — character-for-character the
`warnAmbiguousWidth` pattern (`run.ts:36-37,59`). No other ui change (AR-17 fence: no
rendering/widget/chrome edits).

### 6. Exports — `host/index.ts`, `engine/index.ts`

Re-export `BOX_PROBE_GLYPHS`, `WIDTH_ADAPTED_MESSAGE`, `WidthProbeGroupResult`,
`degradeCapsForWidth`, `degradeCapsFully`, `isAsciiSafe` alongside the existing probe symbols
(`index.ts:90` block). Governance suites need **no** expectation edits: `api-stability.spec.test.ts`
asserts only CHANGELOG/README doc headings (its lines 24–35) — satisfied by the Phase-4
CHANGELOG entry — and no test enumerates the export surface (PF-002).

## Integration Points

- `serialize()`/`fallbackGlyph`: consumes the new flag; no signature change.
- `resolveCapabilities`: only the type/defaults change — no new detection layer (AR-15
  evidence: glyph caps have no positive layer; apps override).
- The kitchen-sink/demos: unchanged code; `JSVISION_ASCII=1 demo:kitchen` is the documented
  manual showcase (AR-12).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| CPR timeout / malformed / over byte-cap (either group) | `probed: false`, no flag changes, no warning | AR-6 (existing contract) |
| Probe throws mid-`start()` | Caught; startup proceeds un-adapted (existing `host.ts:140` posture) | AR-4 |
| `JSVISION_ASCII` set to any value incl. `''` | Presence = on; value never parsed or logged | AR-8/15 |
| Caps already fully ASCII-safe | Probe skipped, no warning, no CPR bytes written | AR-13 |
| Non-TTY / silent terminal | Identical to today: no probe effects | AR-12 |
| Both groups wide | Both degradations apply; single adapted warning | AR-6/10 |
| Suspend/resume after adaptation | Resume repaint serializes with `getSerializeCaps()` — identical bytes to `render()` | PF-001 |
| `unicode.utf8: false` | Counts as ASCII-safe: probe skipped, no warning (output already all-ASCII via `?`) | PF-003 |

## Testing Requirements

Spec oracles ST-01…ST-16 in [07-testing-strategy.md](07-testing-strategy.md); amended
width-probe oracles cite AR-16. Impl tests: sequential-CPR parsing, timeout sharing, byte-cap
across two replies, `degradeCapsForWidth` purity/immutability (frozen-caps safety), env
injection.
