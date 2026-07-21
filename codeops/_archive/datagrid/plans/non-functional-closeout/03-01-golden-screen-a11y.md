# Component: Golden-screen & Accessibility (AC-3)

> **Implements**: RD-14 AC-3 · **Tests**: ST-1, ST-2, ST-3 · **Decisions**: AR-2, AR-4, AR-5, AR-8, AR-11
> **CodeOps Skills Version**: 3.9.0

The bulk of RD-14's remaining work. Renders one representative grid through `@xterm/headless` and
asserts correctness across the color-depth and degradation matrix. Non-visual test tier — **no new
kitchen-sink story** (nothing new is drawn; the smoke test must stay green).

## Files

- **New**: `packages/datagrid/test/golden-screen.spec.test.ts` (ST-1) and
  `packages/datagrid/test/a11y-golden.spec.test.ts` (ST-2, ST-3).
- **New (shared)**: a tiny fixture builder — inline in the spec or `test/fixtures/golden-grid.ts` —
  that returns a grid pre-seeded into the four role states (below). Keep it small.
- **Edit**: `packages/datagrid/package.json` — add `@xterm/headless: "^6.0.0"` to `devDependencies`
  (AR-5), then `yarn install`.

## Harness reuse (AR-4)

Import core's helpers by workspace-relative, NodeNext-style specifier from
`packages/datagrid/test/`:

```ts
import { feed, makeTerm, readCell, reverseState } from '../../core/test/golden-screen-helpers.js';
import type { CellColor } from '../../core/test/golden-screen-helpers.js';
```

The `.js` extension resolves to the `.ts` source under vitest/tsx (NodeNext). `golden-screen-
helpers.ts` imports `@xterm/headless` (now a datagrid dev-dep) and core internals by paths relative
to *its own* location, so it loads correctly regardless of which package's test run pulls it in.

> **Typecheck caveat (PF-002) — this import resolves at runtime but does NOT typecheck as-is.**
> Unlike core (whose `typecheck` is `tsc --noEmit` over `include:["src"]` — it never typechecks its
> own `test/`), datagrid's `tsconfig.typecheck.json` includes `test/` under `rootDir:"."` with no
> `allowJs`. A cross-package `.ts` import from `../../core/test/` raises **`TS6059`** (file not under
> `rootDir`); the `.mjs` bench import raises **`TS7016`** (no declaration). Both fail `yarn verify`.
> **Fix:** exclude the three cross-package-importing specs (`golden-screen`, `a11y-golden`,
> `perf-grid-bench`) from `tsconfig.typecheck.json` (Phase 0, task 0.2), mirroring core's posture —
> they stay covered by vitest at run time. `render-bytes-damage` and `callback-isolation` specs
> import nothing cross-package and remain typechecked.

## The fixture grid

One small grid (fits comfortably in the emulator, e.g. ~30×8) mounted via the smoke-test path:

```ts
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth } }).profile;
const rr = createRenderRoot({ width: W, height: H }, { caps });
createRoot((dispose) => {
  rr.mount(at(buildGoldenGrid({ caps, width: W, height: H }), 0, 0, W, H));
  // drive it into the four role states via the grid's PUBLIC api (not raw event replay where avoidable):
  //   focused cell   -> gridCursor
  //   edited cell    -> gridDirty
  //   selected row   -> gridSelectedRow
  //   invalid cell   -> gridInvalid
  dispose();
});
```

Establish the states through public seams the existing specs already use (selection API, focus API,
an edit-commit to create a dirty cell, an invalid value to trigger `gridInvalid` via the validator).
The exact calls are discovered during exec by reading the relevant spec tests (`row-gate`,
`validation-pipeline`, `rows-selection`) — do not invent an API.

> **Fixture constraint (PF-006) — place the four role cells so they do not overlap.** The overpaints
> have precedence `cursor > gridInvalid > gridDirty` (`editable-grid-rows.ts:927`), so a cell that is
> both focused and dirty renders the cursor and masks `gridDirty` from ST-1's read. Put each role on
> a distinct cell. Note the heterogeneous mechanisms: `gridInvalid` needs a column validator + a
> committed failing value; `gridDirty` is a **fg-only** `•` marker over the row background
> (`:1070`) — ST-1 reads it on the **fg** channel, not as a full bg band like `gridCursor`/
> `gridSelectedRow`/`gridInvalid`.

Then feed the emulator and read cells back:

```ts
const term = makeTerm(W, H);
await feed(term, rr.serialize()); // first serialize after mount == full paint
// assert per the matrix below via readCell / reverseState
```

## The matrix

Mirror core's `optsFor` + `COLOR_CONTRACT` (`golden-screen.spec.test.ts:28-46`):

- **ST-1 — color depths** (`for (const depth of ['truecolor','256','16','mono'])`): the cell bearing
  each grid role renders with the depth-correct color **mode**:
  truecolor→`rgb`, 256→`palette`, 16→`palette` with value ∈ 0..15, mono→`default`. Read the role
  cell's `fg`/`bg` via `readCell` and apply the same per-depth contract assertion core uses.
- **ST-2 — NO_COLOR / mono** (pin `colorDepth:'mono'` — the resolved path for `NO_COLOR`, per
  `a11y-golden.spec.test.ts:26-27`; default theme): every role cell's `fg.mode`/`bg.mode` is
  `'default'` (**no color emitted**) and the render path stays intact (chars present, no crash).
  **Do NOT assert `reverseState()` here** (PF-001): the default grid roles convey state by **color**,
  not by `Attr.reverse`, so under mono they collapse to default — this is expected, not a defect, and
  AC-3 requires only "render correctly" under NO_COLOR. (The color-free `monochromeTheme` producer is
  what distinguishes state without color — via *mixed* attributes: `reverse` for
  `gridCursor`/`gridInvalid`, **bold** for `gridSelectedRow`/`gridDirty`; testing that producer is an
  optional follow-on, not part of this AC-3 closeout.)
- **ST-3 — ASCII-only caps** (`override: { glyphs: { boxDrawing: false, ambiguousWide: true } }`):
  the ASCII floor. `boxDrawing:false` degrades box borders (`┌→'+'`, `─→'-'`, `│→'|'`, mirroring
  `a11y-golden.spec.test.ts:63-68`); `ambiguousWide:true` degrades the grid's ambiguous-width
  decorative glyphs via core's `fallbackGlyph` (`•→'*'`, `▲→'^'`, `▼→'v'`). Assert the frame
  corner/edge cells, then scan the chrome region asserting **no cell holds a non-ASCII glyph** (every
  `char.codePointAt(0) <= 0x7f`). **Keep the ST-3 fixture free of the funnel `▽` and the unloaded
  `…`** — core has no ASCII fallback for those (PF-003), so including them would red the scan on a
  genuine gap, not a test-framing issue. User data text is out of scope (AR-11). Note: the
  conservative *default* profile does **not** work as the lever — it resolves `ambiguousWide:false`
  (`defaults.ts:31`); enable it explicitly.

## Notes & risks

- The byte-freeze (`grid-theme.spec.test.ts`) guards only the roles' **stored color bytes** — it
  says nothing about *attributes under mono* (PF-001) or *glyph fallback* (PF-003). The live
  emulator round-trip is a genuinely *stronger* oracle on exactly those axes. With ST-2/ST-3
  reframed to the mechanisms the grid actually uses (color-collapse under mono; the
  `{boxDrawing:false, ambiguousWide:true}` ASCII floor), ST-1/ST-2/ST-3 are expected green — but a
  red on a *depth/mode* value or a box/ambiguous-glyph fallback is still a real product finding: fix
  the grid/role, not the oracle.
- The funnel `▽` (`sort-header.ts:29`, U+25BD) and the unloaded-row `…` (U+2026) are in **none** of
  core's `fallbackGlyph` maps (`glyphs.ts:49-58`), so no glyph capability turns them into ASCII
  (only `utf8:false` would, blunt-mapping to `?`). This closeout keeps them out of the ST-3 fixture
  and records the gap as a known limitation; giving them a real ASCII fallback (extend core's
  `AMBIGUOUS_FALLBACK`, or a grid-local fallback) is a separate, out-of-scope decision — surface it,
  don't invent it.
