# Testing Strategy — widget-flex-adoption

## The shape of spec-first for a behavior-preserving refactor

There is no new behavior to specify. The oracle for "did this refactor change anything" is the
**existing** suite, which must stay green **and unedited** (NFR-1). Spec-first here means closing the
coverage gaps *before* touching source, so the conversion is falsifiable rather than merely
plausible.

Every witness is written against **unmodified** source and passes immediately. That is the point: a
green-first witness records what the system does today, so a later red proves the conversion moved
something.

**Non-vacuity is mandatory.** A witness that asserts "whatever it does today" passes even when it
targets the wrong view or an empty `children` array. Every characterization witness must therefore
also assert an exact **count** (children, ring length, band count) and that every captured rect has
non-zero width and height. Without that clause the Phase-1 baseline certifies nothing.

**Placement (AR-12).** ST-W1/W2/W3/W4/W7 are `*.spec.test.ts` — genuine behavioral contracts.
ST-W5/W6 are `*.impl.test.ts` — they capture internal composition, which later flex-elimination tiers
will legitimately change; freezing it in an immutable oracle would obstruct the feature's own
direction.

## Specification test cases

### ST-W1 — app-shell root composition (`app-shell.composition.spec.test.ts`)

| Input | Expected |
|-------|----------|
| `createApplication({ menuBar, content, statusLine })` | `root.children` is exactly `[menuBar, content, statusLine, overlay]` |
| same | `overlay.layout.position === 'absolute'`, `overlay` a **direct** child of `root` |
| same | `menuBar.bounds.height === 1` and `statusLine.bounds.height === 1` (the value of the module-private `CHROME_ROW_HEIGHT`, which a test cannot import) |
| `createApplication({ content })` | `root.children` is exactly `[content, overlay]` |
| `createApplication({ menuBar, content })` | `root.children` is exactly `[menuBar, content, overlay]` |
| `createApplication({})` | `root.children` is exactly `[desktop, overlay]` |

Reached via `app.desktop.parent` (or `content.parent`), the same handle the existing oracles use.
Closes the gap on `application.ts`'s conditional child assembly and pins the overlay-locator premise
four existing test files depend on. Traces to FR-4, AC-6.

### ST-W2 — app-shell tab order (same file)

| Input | Expected |
|-------|----------|
| a shell with two focusable views in `content` | the ordered focus ring, asserted as an explicit list of named views, plus its exact length |

Traces to FR-4, AC-6.

### ST-W3 — the TabView content clobber contract (`tabs.content-layout.spec.test.ts`)

| Input | Expected |
|-------|----------|
| a tab whose `content.layout = { padding: 2, size: { kind:'fixed', cells: 3 } }` is set **before** being passed to `TabView` | after mount, `content.layout` is exactly `{ size: { kind:'fr', weight: 1 } }` — the caller's `padding` **and** `size` are discarded |

**One of the three most important tests in the plan.** It pins the behavior AR-1 chose to preserve at
a public API boundary. Without it, a future reader sees a lone wholesale assignment surrounded by
taggers and "fixes" it — silently changing what a published API does. Traces to FR-3, AC-5.

### ST-W4 — the createApplication content clobber contract (same file as ST-W1)

| Input | Expected |
|-------|----------|
| `createApplication({ content })` where `content.layout = { padding: 1, direction: 'row' }` was set first | after mount, `content.layout` is exactly `{ size: { kind:'fr', weight: 1 } }` |

Traces to FR-3, AC-5.

### ST-W7 — the mountCellOverlay caller-layout contract (`overlay-contract.spec.test.ts`, datagrid)

| Input | Expected |
|-------|----------|
| a view passed to `mountCellOverlay` carrying `layout = { padding: 1, direction: 'col', position:'absolute', rect: {…} }` | after mount, `view.layout` is exactly `{ position:'absolute', rect: {…} }` — `padding` and `direction` are discarded, while the caller's `rect` **width/height are still honored** per `overlay.ts:106-108` |

Pins AR-11. This is the site preflight found the public-receiver rule had never been applied to, and
whose existing coverage (`filter-customization.spec.test.ts:105-106`) asserts only `rect` w/h — which
`at()` would have overwritten identically, so nothing would have caught the widening.
Traces to FR-3, AC-5.

## Implementation test cases

### ST-W5 — datagrid auxiliary composition (`aux-composition.impl.test.ts`)

| Input | Expected |
|-------|----------|
| `buttonRow([a, b], 10)` | row is `direction:'row'`, height `BUTTON_HEIGHT`; each button width 10; the cell centers |
| `grid-lifecycle` placeholder / spinner / error shells | the **children's** solved rects (stacked y-offsets), not just the shell's — this is what would catch `:76` losing `direction:'col'` |
| `ValueList` popup | solved rects of search label, input, scrollbar, list, status |

Reached through the exported `buttonRow`, `ValueList` and `createLifecycleController().placeholder()`.
Traces to AC-2.

### ST-W6 — grid-panels band geometry (`panel-bands.impl.test.ts`)

| Input | Expected |
|-------|----------|
| a grid with left/center/right freeze segments + footer + quick-filter + message band | `inner.children.length`, then the solved rect of each band and per-segment panel |

`GridBodyParts` exposes `inner`/`panels`/`headers`/`center` but **no band handles**, so this must walk
the tree. Assert via a test-local walk keyed on each band's distinguishing child type, with the band
name in every assertion message — not raw index chains — so a failure names what moved.
`golden-screen.spec` already guards the rendered result; this guards the structure underneath.
This is the most precision-sensitive artifact in the plan and is tagged **complex**. Traces to AC-2, AC-4.

## The zero-edit contract

| Rule | Enforcement |
|------|-------------|
| No geometry/golden assertion edited in any existing test | `git diff --stat` on `**/test/**` per phase; AC-3 |
| `golden-screen.spec` + `a11y-golden.spec` show **zero** diff | AC-4 |
| Security oracles green and untouched | AC-9, NFR-6 |
| No nesting change is expected, so a broken locator is a mis-transcription first | NFR-2 |
| ST-W1/W5/W6/W7 are exempt from the locator allowance — they are the detectors | NFR-2 |

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify` (AR-6). At close-out additionally: `yarn check:deps`, the
kitchen-sink smoke test (NFR-5), `yarn bench` under the 16 ms ceiling, the security oracles unedited
(NFR-6), and the grep audit against the residue allowlist (AC-8).

**Build-order rule (NFR-4):** rebuild `packages/ui` before running datagrid or examples tests after
any Phase-2 change.
