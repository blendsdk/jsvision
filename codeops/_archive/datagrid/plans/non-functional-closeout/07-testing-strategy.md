# Testing Strategy — non-functional-closeout

> **CodeOps Skills Version**: 3.9.0 · **Verify**: `yarn verify` (AR-10)

Specification-first ordering (non-negotiable): write the `*.spec.test.ts` oracle → red → implement →
green → add `*.impl.test.ts` edges → verify. Test-only components (golden, bench, bytes) have their
spec test *as* the deliverable — a red there is a real product gap, not a test to relax. All new
specs are `*.spec.test.ts` in the `unit` project (AR-8). Expectations derive from RD-14's ACs and
core's oracle contract, never from running the code first.

## Specification test cases

| ST | File | Oracle | Traces to |
|----|------|--------|-----------|
| **ST-1** | `test/golden-screen.spec.test.ts` | For each depth ∈ {truecolor,256,16,mono}, the cell bearing each grid role (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`) reads back with the depth-correct color **mode** (rgb / palette / palette∈0..15 / default). | RD-14 AC-3; core `golden-screen.spec.test.ts:38-46` |
| **ST-2** | `test/a11y-golden.spec.test.ts` | Under mono/`NO_COLOR` (default theme), every role cell emits **no color** (`fg.mode==='default'`, `bg.mode==='default'`) and the render path stays intact. **No `reverseState()` assertion** — the default roles convey state by color, not `Attr.reverse`, so mono-collapse is expected (PF-001); AC-3 requires only "render correctly". | RD-14 AC-3; core `a11y-golden.spec.test.ts:25-49` |
| **ST-3** | `test/a11y-golden.spec.test.ts` | Under `glyphs:{boxDrawing:false, ambiguousWide:true}` (the ASCII floor), border chrome degrades to ASCII (`┌→'+'`, `─→'-'`, `│→'|'`) and the ambiguous-width decorative glyphs degrade (`•→'*'`, `▲→'^'`, `▼→'v'`); no chrome cell holds a non-ASCII glyph (`codePointAt(0) ≤ 0x7f`). Fixture excludes funnel `▽`/ellipsis `…` (no core fallback — PF-003). User data text excluded (AR-11). | RD-14 AC-3; core `a11y-golden.spec.test.ts:52-69` |
| **ST-4** | `test/perf-grid-bench.spec.test.ts` | A 60×22 representative editable grid's compose+diff **median ≤ 16 ms** off-CI; under `CI`/`TUI_SKIP_PERF` the assertion is skipped and median+p95 are logged. | RD-14 AC-1; core `perf-budget.spec.test.ts:33-40` |
| **ST-5** | `test/render-bytes-damage.spec.test.ts` | A single-cell edit's `rr.serialize()` diff emits `>0` bytes and `< full-first-paint/10` (∝ damage, not area). | RD-14 AC-2; core `render-bytes-damage.spec.test.ts:32-42` |
| **ST-6** | `test/callback-isolation.spec.test.ts` | A throwing on-screen **formatter** degrades its one cell to the value's `String()` form; the rest of the frame renders. | RD-14 Should-Have; extends AC-7 (`cell-draw.ts:120`) |
| **ST-7** | `test/callback-isolation.spec.test.ts` | A throwing custom **comparator** does not crash: `sortRowsMulti` returns all rows in default-comparator order, and a header-click sort on the bad column renders without throwing. | RD-14 Should-Have; extends AC-7 |

## Red-phase expectations

- **ST-1/ST-2/ST-3** — expected green (the oracles are reframed to the mechanisms the grid actually
  uses: depth-correct color **mode**; mono color-collapse under the **default** theme; the
  `{boxDrawing:false, ambiguousWide:true}` ASCII floor). The byte-freeze guards only *stored color
  bytes*, so the emulator round-trip is a *stronger* oracle on attrs-under-mono and glyph fallback —
  a red on a depth/mode value or a box/ambiguous-glyph fallback is a real product defect (fix the
  grid/role, not the oracle).
- **ST-4/ST-5** — green (measure existing render); a red = a genuine perf/proportionality regression.
- **ST-6/ST-7** — **red before green** (the guards at `column.ts:247` / `sort.ts:63` do not exist yet).

## Implementation / edge tests (hardening)

- `test/callback-isolation.impl.test.ts` — formatter guard: throws on some rows only (not all);
  export-path formatter regression still degrades (`grid.ts:1004`). Comparator guard: throws under a
  **multi-key** sort (falls back on the bad key, honors the others); `nulls` handling still applies
  (the guard sits below the nil short-circuit at `sort.ts:57-62`).
- Bench/bytes edges (optional, `*.impl.test.ts`): the local timing helper's warm-up discards; the
  bytes oracle holds on an unchanged frame (0 bytes, mirroring core ST-20).

## Security & governance checks (existing gates, must stay green)

- `yarn check:deps` — zero native runtime deps after adding `@xterm/headless` (a **dev** dep; the
  guard scans runtime deps only).
- `yarn check:docs` — no new public export lacks an `@example` (this plan adds tests + two internal
  guards + a CHANGELOG edit; no new public API surface).
- `test/kitchen-sink.smoke.spec.test.ts` — unchanged and green (no new visual component).
