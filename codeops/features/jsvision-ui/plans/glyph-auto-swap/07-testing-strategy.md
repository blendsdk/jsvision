# Testing Strategy: Glyph Auto-Swap Fallback

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit: every new branch (map hit/miss, group flips, skip conditions, both message variants).
- Integration: host `start()`→probe→adapt→`render()` over an injected `TerminalQuery` +
  captured output writes (the existing width-probe/host-width-warn harness pattern).
- No new e2e: the probe's TTY window is already covered by `host-tier3.e2e`; nothing here
  changes exit/restore paths.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, `03-01-core-glyph-swap.md`, and the Ambiguity
> Register. IMMUTABLE ORACLE RULE applies. The pre-existing `width-probe.spec.test.ts` oracles
> are updated to the grouped contract **with explicit user approval recorded in AR-16** — the
> updated tests carry an `AR-16` traceability comment.

### Fallback map + capability flag

| #     | Input / Scenario | Expected Output / Behavior | Source |
| ----- | ---------------- | -------------------------- | ------ |
| ST-01 | `fallbackGlyph(g, caps)` with `ambiguousWide: false` (utf8/box/half all on) for each of `▲▼◄►•↑↕×` | Each glyph returned unchanged | FR-1 / AR-5 |
| ST-02 | Same calls with `ambiguousWide: true` | Exactly `^ v < > * ^ v x` respectively | FR-2 / AR-7 |
| ST-03 | `ambiguousWide: true`, `boxDrawing: true`, `halfBlocks: true`: `┌`, `█`, `▒` | All returned unchanged (map disjointness — group flags independent) | FR-2 / AR-6 |
| ST-04 | `CONSERVATIVE_DEFAULTS.glyphs` | Equals `{ boxDrawing: false, halfBlocks: false, ambiguousWide: false }`; an `override.glyphs: { boxDrawing: true, halfBlocks: true }` resolve yields `ambiguousWide: false` | FR-1 / AR-5 |

### Two-group probe (amends `width-probe.spec.test.ts`, AR-16)

| #     | Input / Scenario | Expected Output / Behavior | Source |
| ----- | ---------------- | -------------------------- | ------ |
| ST-05 | Stub query answers CPR col 17 after group 1 (8 code points), col 9 after group 2 | `{ probed: true, arrows: { expectedWidth: 8, measuredWidth: 16, wide: true }, boxes: { …, measuredWidth: 8, wide: false } }` | FR-3 / AR-6 |
| ST-06 | CPR col 9 after group 1, col 17 after group 2 | `arrows.wide: false`, `boxes.wide: true` | FR-3 / AR-6 |
| ST-07 | Query never answers (timeout) | `{ probed: false }`, both `measuredWidth: null`, both `wide: false`; `warnIfAmbiguousWide` emits nothing | FR-3 / AC-5 |

### Host adaptation + JSVISION_ASCII (new `host-width-adapt.spec.test.ts`)

| #     | Input / Scenario | Expected Output / Behavior | Source |
| ----- | ---------------- | -------------------------- | ------ |
| ST-08 | Host `adaptAmbiguousWidth: true`, TTY, query answers arrows-wide only; buffer holds `▲` and `┌` | Rendered output contains `^`, still contains `┌` (selective flip) | FR-4 / AC-1 |
| ST-09 | Same but boxes-wide only; buffer holds `▲`, `┌`, `▒` | Output contains `▲`, `+`, `#` | FR-4 / AC-2 |
| ST-10 | `adaptAmbiguousWidth: true`, `warnAmbiguousWidth: true`, any group wide | Warn sink receives `WIDTH_ADAPTED_MESSAGE`, exactly once | FR-7 / AR-10 / AC-4 |
| ST-11 | `adaptAmbiguousWidth: false`, `warnAmbiguousWidth: true`, wide | Warn sink receives the warn-only message containing `JSVISION_ASCII=1` | FR-7 / AR-10 / AC-4 |
| ST-12 | `env: { JSVISION_ASCII: '' }` (empty string), buffer holds `▲┌▒` | Output fully ASCII (`^ + #`); **zero bytes written to the query** (probe skipped) | FR-5/6 / AR-8/13/15 / AC-3 |
| ST-13 | Caps already `{ boxDrawing: false, halfBlocks: false, ambiguousWide: true }`, warn+adapt on | Zero bytes written to the query; no warning | FR-6 / AR-13 |
| ST-15 | `adaptAmbiguousWidth: true`, arrows-wide CPR scripted, buffer with `▲` rendered; then drive the runtime adapter's `'continue'` (SIGCONT) signal | The resume full-repaint output contains `^`, never `▲` — the signals repaint uses the effective serialize caps | FR-4 / PF-001 |
| ST-16 | Caps `unicode.utf8: false` (boxDrawing/halfBlocks on), warn+adapt on | Zero probe bytes written; no warning (output already fully ASCII via the `?` catch-all) | FR-6 / PF-003 |

### ui threading (new `packages/ui/test/app-shell.adapt.spec.test.ts`)

| #     | Input / Scenario | Expected Output / Behavior | Source |
| ----- | ---------------- | -------------------------- | ------ |
| ST-14 | `createApplication` + `run()` with `warnAmbiguousWidth: false`, injected TTY-true `FakeInput` + `CaptureStream` + `FakeRuntimeAdapter`, a scripted CPR reply (so the probe never waits out its 200 ms budget) | Adapt unset (default `true`) ⇒ the CPR request `\x1b[6n` appears in the captured output (the probe ran ⇒ the host received `adaptAmbiguousWidth: true`); explicit `adaptAmbiguousWidth: false` ⇒ **no** probe bytes. (Concrete observable specified per PF-005 — no prior ui test observes host-option threading, and `run()` does not thread `onWidthWarning`.) | FR-8 / AR-9/17 / AC-6 |

> **⚠️ AUTHORING RULE:** Expectations above come from the AR decisions and FRs — not from any
> implementation. If an expected value cannot be derived from the spec, it goes back to the
> register first.

## Test Categories

### Specification Tests (before implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/core/test/glyph-swap.spec.test.ts` (new) | ST-01…ST-04 | flag + map |
| `packages/core/test/width-probe.spec.test.ts` (amended, AR-16 cited) | ST-05…ST-07 | probe |
| `packages/core/test/host-width-adapt.spec.test.ts` (new) | ST-08…ST-13, ST-15, ST-16 | host wiring (incl. resume repaint + utf8-off skip) |
| `packages/ui/test/app-shell.adapt.spec.test.ts` (new) | ST-14 | ui threading |

### Implementation Tests (after implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/core/test/glyph-swap.impl.test.ts` | Map/flag interplay with `utf8: false` catch-all; continuation-cell `''` passthrough; every existing `render-glyphs.impl` case still green | High |
| `packages/core/test/width-probe.impl.test.ts` (amended) | Sequential dual-CPR parsing (split/coalesced chunks), shared timeout, byte/digit caps spanning two replies, cleanup write always emitted | High |
| `packages/core/test/host-width-adapt.impl.test.ts` | `degradeCapsForWidth`/`degradeCapsFully`/`isAsciiSafe` purity + frozen-caps safety; both-groups-wide; adapt with warn off (silent adapt); probe-throw → un-adapted startup | High |
| `packages/core/test/host-width-warn.impl.test.ts` (amended) | Existing 4 cases against the grouped probe + new message texts | Med |

### Integration / governance

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `api-stability.spec.test.ts` (existing) | governance docs | **No expectation edits needed** — it asserts CHANGELOG/README doc headings only (PF-002); stays green via the Phase-4 CHANGELOG entry |
| Existing golden/serialize suites | render | Must stay green untouched (default `ambiguousWide: false` is behavior-neutral) |

## Test Data

### Fixtures
Stub `TerminalQuery` scripts (write-log + scripted CPR replies) — reuse the existing
width-probe test helper pattern; no new fixture files.

### Mocks
None beyond the injected `TerminalQuery`, streams, and `env` object (all existing seams —
real objects elsewhere).

## Verification Checklist
- [ ] ST-01…ST-16 defined with concrete input/output pairs, each traced to FR/AR (ST-15/16 added by preflight PF-001/PF-003)
- [ ] Spec tests written BEFORE implementation and verified RED
- [ ] Green phase: implementation satisfies every ST unchanged
- [ ] Impl tests added after green
- [ ] Full `yarn verify` + `yarn workspace @jsvision/core test:e2e` + `yarn gate` pass
- [ ] No regressions in the 80 core + ui suites
