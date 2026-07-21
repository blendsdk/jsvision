# Component: Representative perf bench & bytes ∝ damage (AC-1, AC-2)

> **Implements**: RD-14 AC-1, AC-2 (2nd half) · **Tests**: ST-4, ST-5 · **Decisions**: AR-4, AR-6, AR-7, AR-8
> **CodeOps Skills Version**: 3.9.0

## Files

- **New**: `packages/datagrid/test/perf-grid-bench.spec.test.ts` (ST-4).
- **New**: `packages/datagrid/test/render-bytes-damage.spec.test.ts` (ST-5).
- No product-source changes expected — both measure the *existing* render path.

## Shared fixture: a 60×22 representative grid

An **eager** in-memory grid (AR-6/AR-7) so measurement reflects render cost, not async paging:

```ts
import { signal } from '@jsvision/ui';
import { EditableDataGrid, column, fromRows } from '../src/index.js';
// ~5 columns reusing the data-at-scale / columns-layout model; enough rows to fill 22 visible.
const rows = signal<Rec[]>([ /* … */ ]);
// `fromRows` takes a Signal<T[]> and a required { rowKey } (data-source.ts:93) — NOT a bare array
// (PF-004). The columns-layout story is the reference: `fromRows(signal(rows), { rowKey })`.
const grid = new EditableDataGrid({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), zebra: true });
const rr = createRenderRoot({ width: 60, height: 22 }, { caps });
```

## ST-4 — perf bench (AC-1)

Reuse core's **pure** helpers; write datagrid's **own** timing loop (core's `measureComposeDiff` is
hardwired to its synthetic 200×50 frame — not a grid):

```ts
import { median, p95, perfBudgetMode } from '../../core/bench/frame-bench.mjs';

const BUDGET_MS = 16;   // RD-14 AC-1, same ceiling core asserts for 200x50
const ITER = 200;

function sampleGridComposeDiff(): number[] {
  // Build the grid + render root ONCE, outside the loop — AC-1's metric is "compose+diff", NOT view
  // construction/layout, so grid construction stays OUTSIDE the timed region (PF-005). Warm up
  // (~20 iters, discarded), then per iter time only compose + `rr.serialize()` (re-serialize the same
  // mounted grid), mirroring core's frame-bench.mjs sample() discipline (which times compose+diff,
  // not setup). Fold serialize().length into a sink to defeat DCE.
}

test('ST-4: 60x22 representative grid compose+diff median within the 16ms budget', () => {
  const xs = sampleGridComposeDiff();
  const med = median(xs);
  if (perfBudgetMode(process.env) === 'log') {
    console.log(`perf (informational): 60x22 grid median ${med.toFixed(3)}ms p95 ${p95(xs).toFixed(3)}ms`);
    return;
  }
  expect(med <= BUDGET_MS).toBeTruthy();
});
```

> **Typecheck caveat (PF-002).** The `../../core/bench/frame-bench.mjs` import **resolves at runtime
> but does not typecheck** — it is a declaration-less `.mjs` and datagrid's `tsconfig.typecheck.json`
> typechecks `test/` (raises `TS7016`). Phase 0 (task 0.2) excludes this spec (`perf-grid-bench`)
> from `tsconfig.typecheck.json`, mirroring core's src-only typecheck. Full note in
> [`03-01` §Harness reuse](03-01-golden-screen-a11y.md).

- **Median** is the Must-Have gate; **p95** is logged (Should-Have, AR-3). Off-CI asserts; under
  `CI`/`TUI_SKIP_PERF`, `perfBudgetMode` returns `'log'` → log both, no assert (AR-7).
- If the grid genuinely exceeds 16 ms off-CI that is a real finding — investigate the render path,
  don't relax the budget silently.

## ST-5 — bytes ∝ damage (AC-2 second half)

Mirror core's ratio oracle (`render-bytes-damage.spec.test.ts:32-42`) at the **grid** level via
`rr.serialize()` (the damage-diff escape bytes):

```ts
test('ST-5: a single-cell edit re-serializes only the damaged region', () => {
  // mount the 60x22 grid; first serialize() == full first paint
  const full = rr.serialize().length;
  // commit a single-cell edit through the grid's public edit/commit seam
  const diff = rr.serialize().length; // damage diff for just the changed region
  expect(diff > 0).toBeTruthy();
  expect(diff < full / 10).toBeTruthy();  // ∝ damage, not screen area (same /10 core uses)
});
```

- The ratio (not an absolute byte count) keeps the oracle deterministic and machine-independent
  (AR-6). A grid edit may touch the dirty-marker + the cell (a localized row region, ≪ 22 rows), so
  `< full/10` holds comfortably; if a red shows the edit repaints far more than its region, that is a
  real proportionality regression — surface it.
- Use `String.length` (code units) to match core's oracle exactly, not `Buffer.byteLength`.
