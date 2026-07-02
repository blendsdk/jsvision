# Current State: Glyph Auto-Swap Fallback

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All facts below were verified against the working tree on 2026-07-02 (post-`217f9ea`).
Paths are relative to `packages/core/src/engine/` unless stated otherwise.

## Existing Implementation

### What Exists

1. **The CPR width probe** (`host/width-probe.ts`, shipped `217f9ea`): homes to column 1,
   prints one aggregate probe string `AMBIGUOUS_PROBE_GLYPHS = '▲▼◄►■▒▓'` (line 62), requests
   a Cursor-Position-Report (`ESC[6n`), and reports `WidthProbeResult { probed, expectedWidth,
   measuredWidth, ambiguousWide }`. Untrusted-response posture: 256-byte cap, 6-digit field cap,
   single 200 ms timeout, failure → `probed: false`. `warnIfAmbiguousWide` wraps it and emits
   `WIDTH_WARNING_MESSAGE` (line 65) — whose advice "enable ASCII-safe glyphs" currently has
   **no switch to enable**.
2. **Host wiring, warn-only** (`host/host.ts`): `probeWidthAndWarn` (142–151) runs inside
   `start()` in the raw-mode → pre-alt-screen window (176–183), gated by
   `HostOptions.warnAmbiguousWidth` (default off; `host/types.ts:64`). The probe result is
   **discarded** after the warning. `const caps = options.caps` is captured once (line 62) and
   feeds decode (98), modes (161–162), restore (169), signals (190), and `serialize(next, prev,
   { caps })` (239). The signals module uses its `caps` for exactly one thing: the SIGCONT
   **resume full-repaint** `serialize(last, null, { caps: ctx.caps })` (`signals.ts:118`) — the
   second (and only other) frame-content serialize site in the host (PF-001).
3. **Serialize-time glyph fallback** (`render/glyphs.ts`): `fallbackGlyph` (line 66) substitutes
   per emitted glyph — `BOX_FALLBACK` (box drawing → `+-|`, gated `!glyphs.boxDrawing`),
   `BLOCK_SHADE` (`█▀▄▌▐░▒▓` → `#`, gated `!glyphs.halfBlocks`), then a `>U+007F → '?'`
   catch-all gated `!unicode.utf8`. Called per cell from `render/serialize.ts:92`. The
   `ScreenBuffer` always stores the real Unicode glyph (buffer/serialize split, RD-04).
4. **ui default-on threading precedent**: `warnAmbiguousWidth` defaults off in core, and ui's
   `runApplication` passes `ctx.warnAmbiguousWidth ?? true` (`packages/ui/src/app/run.ts:59`),
   surfaced on `createApplication` options (`app/application.ts:52`).
5. **Prior de-risking**: the scroll thumb already deviates from TV's `■` (East-Asian Ambiguous)
   to `█` FULL BLOCK (`packages/ui/src/scroll/scroll-bar.ts:56`, user-approved in `217f9ea`).

### The ambiguous chrome glyph inventory (ui, verified)

| Glyph | Code point | Drawn by | Covered by `fallbackGlyph` today? |
| ----- | ---------- | -------- | --------------------------------- |
| `▲` `▼` | U+25B2/25BC | `scroll/scroll-bar.ts:49-50` | ❌ |
| `◄` `►` | U+25C4/25BA | `scroll-bar.ts:52-53`, `controls/input.ts:21-22`, `menu/popup.ts:19` | ❌ |
| `•` | U+2022 | `controls/radio-group.ts:43` | ❌ |
| `↑` `↕` | U+2191/2195 | `window/frame.ts:64-65` | ❌ |
| `×` | U+00D7 | `window/frame.ts:63` | ❌ |
| `▒` `▓` | U+2592/2593 | `scroll-bar.ts:55,57` | ✅ `#` via `halfBlocks` |
| `█` `▀` `▄` | U+2588/2580/2584 | `scroll-bar.ts:56`, `controls/button.ts:110,121` | ✅ `#` via `halfBlocks` |
| box drawing | U+2500–2518 etc. | `frame.ts:79-93`, `popup.ts:26-32`, `view/draw-context.ts:29` | ✅ `+-\|` via `boxDrawing` |

Box-drawing and block/shade code points are East-Asian Ambiguous too — under an
ambiguous-wide locale, frames shear the same way arrows do (the AR-6 rationale for group 2).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `capability/profile.ts` | `GlyphCaps` (54–57) | Add `ambiguousWide: boolean` (AR-5) |
| `capability/defaults.ts` | `CONSERVATIVE_DEFAULTS.glyphs` (30) | Add `ambiguousWide: false` |
| `render/glyphs.ts` | `fallbackGlyph` | Add gated 8-entry `AMBIGUOUS_FALLBACK` map (AR-7) |
| `host/width-probe.ts` | Single aggregate probe | Two-group probe, amended result shape, second message, degrade helper (AR-6/10/16) |
| `host/types.ts` | `HostOptions` | Add `adaptAmbiguousWidth?`, `env?` (AR-9/15) |
| `host/host.ts` | Warn-only wiring; `serialize` at 239 | Effective-caps derivation; probe-skip; adapt path; pass `getSerializeCaps` to `installSignals` (AR-4/13, PF-001) |
| `host/signals.ts` | SIGCONT resume repaint serializes the last buffer with `ctx.caps` (118) | Repaint with `ctx.getSerializeCaps()` (PF-001) |
| `host/index.ts` + `index.ts` | Public exports (`index.ts:90`) | Export amended/new symbols |
| `packages/ui/src/app/run.ts` + `application.ts` | `warnAmbiguousWidth` threading | Mirror-thread `adaptAmbiguousWidth` default `true` (AR-9/17) |

## Gaps Identified

### Gap 1: Probe result unused beyond a warning
**Current:** `probeWidthAndWarn` discards the measurement; a wide terminal renders sheared.
**Required:** Adapt effective serialize caps so output is aligned (FR-4).
**Fix:** Host-side effective caps (AR-4).

### Gap 2: No ASCII fallback for 8 chrome glyphs
**Current:** `▲▼◄►•↑↕×` pass through `fallbackGlyph` untouched under every flag combination.
**Required:** The AR-7 map, gated by the new flag (FR-1/2).

### Gap 3: Probe is blind to box-drawing width
**Current:** One aggregate string of geometric/shade glyphs; a frame-shearing ambiguous-wide
locale is indistinguishable from a shapes-only font-fallback problem.
**Required:** Two-group measurement with selective flag flips (FR-3, AR-6).

### Gap 4: The warning's advice dangles
**Current:** "…or enable ASCII-safe glyphs" names a switch that does not exist.
**Required:** `JSVISION_ASCII` host-level force switch + updated texts (FR-5/7, AR-10/15).

### Gap 5: Follow-ups untracked
**Current:** Both `217f9ea` follow-ups live only in the commit message.
**Required:** DEF-23/24 + roadmap row (FR-9, AR-11).

## Dependencies

### Internal
- RD-04 buffer/serialize split (real glyph in buffer, substitution at emit) — the property
  that makes the whole plan ui-free.
- The `TerminalQuery` seam (`capability/profile.ts:107`) the probe already runs over.
- `warnAmbiguousWidth` threading pattern (`types.ts:64` → `run.ts:59`).

### External
- None (zero-runtime-deps policy unchanged).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Second CPR read overruns slow terminals' reply budget | Low | Low | Both reads share the one 200 ms timeout; any shortfall → `probed: false`, no flips (existing degrade contract) |
| Existing width-probe spec oracles must change | Certain | Medium | AR-16: explicit user approval recorded; updated oracles cite AR-16 |
| Suspend/resume repaint bypassing adaptation | Certain if unaddressed | High | PF-001: `getSerializeCaps` seam into `installSignals`; ST-15 oracle |
| Governance suites asserting the export surface | None — verified false | — | `api-stability.spec.test.ts:24-35` asserts CHANGELOG/README headings only (PF-002); the Phase-4 CHANGELOG entry keeps it green |
| App override interplay (`override.glyphs` deep-merge) | Low | Medium | New field defaults `false`; `DeepPartial` merge leaves existing overrides valid — covered by ST-04 + a packaging/type check |
| `↕→v` collides visually with `▼→v` | Accepted | Cosmetic | User-chosen map (AR-7); contexts differ (title bar vs scrollbar) |
