# Core Safety, Capability & Host Hardening: Runtime Hardening (RD-13)

> **Document**: 03-03-core-safety-capability-host.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-06, HR-07, HR-15, HR-26
> **Files**: `packages/core/src/engine/safety/logger.ts`, `capability/env.ts`, `host/host.ts`,
> demo mains under `packages/examples/{kitchen-sink,controls-live,tvision-demo}/`

## Implementation Details

### HR-06 — Logger device-identity guard (Major) *(Decision per PA-6)*

**Defect** (`logger.ts:176-189`): the stderr sink's UI guard compares **fd numbers** (`2 === uiFd`);
interactively stdout (fd 1) and stderr (fd 2) are the same terminal device, so `BLENDTUI_DEBUG=1`
with the `'auto'` sink scribbles every log line over the raw-mode alt-screen.

**Fix spec (PA-6).** The stderr sink stats its target and compares `{dev, ino}` **device identity**
against the UI stream — the same mechanism the file path already uses (`assertFileNotUiStream`).
Behavior splits by intent:

- Sink resolved via **`'auto'`** and stderr shares the UI device → **silently degrade to the ring
  sink** (logs still captured and dumpable; the TUI is never touched).
- **Explicit `sink:'stderr'`** sharing the UI device → **throw `LoggerConfigError`** (mirrors the
  file sink's contract).
- Distinct devices (e.g. `2>/tmp/err`) → stderr sink allowed, unchanged.

Testable with a fake runtime whose fds share/differ in `{dev,ino}` (the safety tests' existing
injection pattern).

### HR-07 — UTF-8 locale implies glyphs (Major) *(Decision per PA-9)*

**Defect** (`capability/defaults.ts:30` all-false glyphs; **no** layer ever enables them —
verified: `env.ts` sets only `unicode.utf8`/`multiplexer`): every terminal degrades `┌─│` → `+-|`,
and all three live demos hand-override caps to compensate.

**Fix spec (PA-9).** In `readEnv` (`env.ts`), a detected UTF-8 locale additionally asserts
`glyphs: { boxDrawing: true, halfBlocks: true }` (via the same `DeepPartial` profile it already
returns). `ambiguousWide` **stays false** (conservative, per the DEF-23 glyph-auto-swap design —
the width probe owns that upgrade). `table.ts` is untouched. Non-UTF-8 / `TERM=dumb` environments
keep all-false. Then **all three demos** (kitchen-sink `main.ts:32`, controls-live `main.ts:72`,
tvision-demo `main.ts:128`) drop their manual glyph overrides; their rendered frames must keep
box-drawing (AC-2/AC-10).

### HR-15 — Host restart resets the diff baseline

**Defect** (`host/host.ts:79-81`): `stop()`→`start()` never resets `prev`/`lastBuffer`/
`decoderState`; the first post-restart frame diffs against the stale baseline and paints garbage
onto the fresh alt-screen.

**Fix spec.** `start()` resets the render baseline (`prev`/`lastBuffer` → "unknown screen", forcing
a full first paint) and the decoder carry/state. Chosen at `start()` (not `stop()`) so a crash
between the two can't leave a half-reset; behaviorally identical either way for the oracle
(start→render→stop→start→render → full repaint).

### HR-26 — `JSVISION_*` env branding *(Decision per PA-4)*

**Defect**: `logger.ts:47,53,172,182,195,200,217` gates on `BLENDTUI_DEBUG`/`BLENDTUI_LOG`;
`host.ts:72` (+ `width-probe.ts`, `host/types.ts`) uses `JSVISION_ASCII`.

**Fix spec (PA-4).** Rename to **`JSVISION_DEBUG`** / **`JSVISION_LOG`** — code, JSDoc, error
message text (`logger.ts:182`), tests, and any docs mentions. **No back-compat alias** (publish is
deferred per DEF-1; no external consumers). `JSVISION_ASCII` is already correct.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| `'auto'` sink resolves to stderr on the UI device | degrade to ring sink, no output to the TUI | **PA-6** |
| Explicit `sink:'stderr'` on the UI device | throw `LoggerConfigError` | **PA-6** |
| `fstat` on fd 2 fails (exotic runtime) | treat as same-device (safe default: degrade/throw per intent) | **PA-6** (conservative reading) |
| Non-UTF-8 locale | glyphs stay all-false | **PA-9** |

## Testing Requirements

- Spec oracles ST-2.3, ST-2.4, ST-5.a,l ([07-testing-strategy.md](07-testing-strategy.md)).
- HR-07 also asserts one demo golden frame post-override-removal (AC-2) and the kitchen-sink smoke
  stays green (AC-10).
- Impl tests: fake-runtime fd permutations for HR-06; restart repaint byte comparison for HR-15;
  a grep-style guard that no `BLENDTUI_` reference remains (HR-26).
