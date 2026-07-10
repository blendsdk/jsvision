# 03-01 — Workstream A: Play resize (terminal-driven) + wheel-leak + GridRows H-scroll golden

> Bugs #1, #3, wheel-leak · AR-2, AR-6, AR-8, AR-10, AR-11 · Phase 1 (AR-7 order).

## A1 — Terminal-driven viewport (bug #1)

**Root cause** (02-current-state §Play layer): the app is composed at a hardcoded preset `size`
while the terminal is `fit`-sized to a container the CSS caps at `95vw/90vh`; on the 100×30 toggle
the container can't grow, so app-frame vs terminal-grid desync and input hit-tests miss.

**Fix — make the terminal the single source of viewport truth.**

### `packages/docs-site/src/play/play-controller.ts`

- Extend the structural `TerminalLike` with `readonly cols: number; readonly rows: number` (both
  `@xterm/xterm` and `@xterm/headless` expose them; the harness terminal — `test/helpers/play-harness.ts`
  `HarnessTerminal` / `headlessFactory` — delegates `cols/rows` + a `resize` to its real emulator).
- Reorder `open()`: **create the terminal first**, then read its post-fit dimensions, then build the
  app at those dimensions:
  ```
  const term = opts.createTerminal(el);          // createTerminal runs fit.fit() internally
  const dims = { width: term.cols, height: term.rows };  // the terminal's REAL size, CSS-min-floored
  const def = (await opts.entry.load()).default;
  const caps = buildBrowserCaps({ colorDepth: depth });
  const app = demoShell({ content: def.build({ ...dims, caps }), caps, viewport: dims, chrome, onDepthChange });
  mounted = mountApp({ element: el, app, caps, term });
  ```
  (`opts.size` is retained only as a fallback when a terminal reports no `cols/rows` — never the
  default when a real fit size is available.)
- `remount()` is unchanged in shape (`close()` → `open()`); because `open()` now reads the terminal's
  fit size, **Reset preserves the user's current size and resets only example state** — the desired
  behaviour.

### `packages/docs-site/.vitepress/theme/components/PlayExample.vue`

- Make the terminal container resizable: a wrapper around `.play-term` gets `resize: both; overflow:
  hidden; min-width: <40 cols>; min-height: <12 rows>` (AR-10 min clamp enforced in CSS so `fit`
  never yields < 40×12; the app then always matches the terminal).
- Create a `ResizeObserver` in `open()` (disposed in `close()`) that calls `fit.fit()` on a
  `requestAnimationFrame` when the container resizes. `fit.fit()` fires the terminal's `onResize`,
  which `mountApp` already routes to `loop.resize` (`packages/web/src/mount.ts:101`) — **live, no
  remount**.
- Repurpose the size button: instead of `remount({ size })`, it sizes the container to a preset
  pixel box (computed from the measured cell size after first fit) → the `ResizeObserver` re-fits →
  `onResize` → `loop.resize`. If the cell size can't be measured, fall back to `term.resize(cols,
  rows)` directly (also fires `onResize`). Either way: no remount, no desync.

## A2 — Wheel-leak (mouse-wheel over the terminal scrolls/zooms the page)

Observed during reproduction: wheeling over the open terminal scrolled the underlying doc page. In
`createTerminal` (or `open`), attach a non-passive `wheel` listener on the terminal host element that
`preventDefault()`s while the terminal is focused; remove it on close. DOM-only (AR-11); no engine
change. The terminal's own wheel handling (grid scroll → app) is unaffected.

## A3 — GridRows horizontal-scroll golden + fix (bug #3, AR-8)

**Gap** (02-current-state §DataGrid): `test/datagrid.spec.test.ts` ST-10 asserts the `indent`
*signal* only; no test inspects the **rendered buffer** at `indent>0`. The docs example can't
H-scroll (City `1fr` → `maxIndent 0`), so the browser garble was not this path — but the path is
untested and a real risk for any overflow grid.

**New spec test** — `packages/ui/test/datagrid.hscroll.spec.test.ts` (immutable oracle):

- **Overflow render at `indent>0`.** Three fixed width-12 columns in a 24-wide grid (`totalWidth`
  39). Drive `indent` to a mid value, render to a `ScreenBuffer`, and assert, cell-by-cell:
  - the visible cells are the correct left-panned substrings of each column's aligned cell;
  - each `│` divider sits at its column's right edge (`starts[c]+widths[c]−indent`);
  - the left clip boundary has no stray/duplicated cell (the partially-scrolled leftmost column
    shows only its visible tail).
- **Wide-glyph straddle.** A cell whose text contains a wide (2-col) glyph positioned so its lead
  cell falls at `x = −1` (just left of the clip). Assert the visible column-0 cell is a blank/space
  (no orphaned continuation cell) — the canonical wide-glyph left-clip invariant.
- **Header lockstep.** `GridHeader` at the same `indent` pans its titles + sort arrow identically to
  the rows (shared geometry).

**Fix** (only if the golden goes red): correct `GridRows.draw` / `GridHeader.draw`
(`packages/ui/src/table/grid-rows.ts`) so negative-`x` cells and wide-glyph continuations clip
cleanly. **Preflight confirmed** `draw-context.ts` `text()` already drops cells with `absX < clip.x`
and drops a wide glyph whose lead sits at `x=−1` whole (`draw-context.ts:91-92`) — so the golden is
**expected green as written** (regression coverage, no `grid-rows.ts` fix expected). That makes #3's
fix effectively A1/A2; the manual browser check **M4 is the real gate for #3** and must explicitly
re-confirm no garble after Phase 1 (07 §Manual).

Spec-first ordering: write the golden → run (red or green) → fix if red → green → impl edge tests.

## Verification (AR-6)

- **Headless (deterministic):** a play-controller test drives the harness terminal's real-emulator
  `resize(cols, rows)` and asserts `app.loop`'s viewport tracks it, and that after `open()` the app
  viewport equals the terminal's `cols/rows` (FR-A1/A2). The GridRows golden (FR-A4).
- **Manual browser (recorded checklist, 07 §Manual):** open the DataGrid Play, drag-resize the
  modal, confirm the grid stays aligned + input works at several sizes; confirm the wheel no longer
  scrolls the page; confirm the DataGrid does not garble.
