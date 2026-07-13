# 07 — Testing Strategy (RD-11)

> **CodeOps Skills Version**: 3.1.0 · Spec-first: spec oracles (ST) RED → implement → GREEN → impl tests.
> Test dir: `packages/ui/test/` (unit) + `packages/examples/test/` (e2e). Naming: `*.spec.test.ts`
> (immutable oracle), `*.impl.test.ts` (edges), `*.e2e.test.ts`.

## Oracle source & the fidelity exception

Spec expectations derive from the RD-11 ACs and the **TV C++ decode** (the drawing oracle). Per the
fidelity directive, for these TV-derived components **the C++ source outranks a spec oracle** — if an ST
disagrees with a faithful decode, the ST is the defect (fix it against the `.cpp`, cite it). Buffer
assertions read cells **pre-`serialize`** (char + `fg`/`bg`) via a real `RenderRoot`/`ScreenBuffer` (no
mocks; caps fixed to truecolor for colour asserts, plus an ASCII-caps pass where glyph fallback matters).

## Specification test cases (ST-01 … ST-16 ↔ AC-1 … AC-15)

| ST | File (`packages/ui/test/`) | Oracle | AC |
|----|----------------------------|--------|-----|
| **ST-01** | `scrollbar.spec.test.ts` | Vertical bar: `▲`@0, `▼`@H-1, `▒` track, `■` thumb at `getPos()` for value=min/mid/max; `max==min` ⇒ all `▓`; colours `scrollBarControls`/`scrollBarPage`. | AC-1 |
| **ST-02** | `scrollbar.spec.test.ts` | Arrow-click ±`arrowStep`, page-click ±`pageStep`, clamp `[min,max]`; horizontal `◄`/`►`. | AC-1 |
| **ST-03** | `scroller.spec.test.ts` | Viewport clips oversized content; ↓/PgDn/thumb reveal + clamp at extent; owned bar `value` tracks `delta`; drag scrolls. | AC-2 |
| **ST-04** | `scroller.spec.test.ts` | `scrollbars:'vertical'` auto-creates+wires; `'none'`⇒none; `'both'`⇒H+V. | AC-3 |
| **ST-05** | `listview.spec.test.ts` | 1000 items ⇒ `getText` called ≪1000 (only visible); ↑↓ move `focused`, PgDn pages, focused stays visible, bar reflects; `listFocused` colour. | AC-4 |
| **ST-06** | `listview.spec.test.ts` | Enter/double-click emits `command`+`onSelect`+sets `selected`; row click focuses+selects (`listSelected`). | AC-5 |
| **ST-07** | `listview.spec.test.ts` | `sorted:true` ordered; `typeAhead:true` prefix jumps `focused` (case-insensitive); both off by default. | AC-6 |
| **ST-08** | `listbox.spec.test.ts` | `ListBox` over `Signal<string[]>` lists strings; signal update re-renders + clamps `focused`. | AC-7 |
| **ST-09** | `dialog.spec.test.ts` | `await execView(dlg)` resolves the terminating command; hosted `Input` signal holds data. | AC-8 |
| **ST-10** | `dialog.spec.test.ts` | `range(0,100)=150` ⇒ OK does not close, focus → that Input; `50`+OK ⇒ `ok`; Cancel/Esc ⇒ `cancel` regardless. (DEF-16) | AC-9 |
| **ST-11** | `dialog.spec.test.ts` | `desktop.add(dlg)` ⇒ normal non-blocking window. | AC-10 |
| **ST-12** | `dialog.spec.test.ts` | `okButton()`/`cancelButton()`/`yesButton()`/`noButton()` render TV faces + emit `ok`/`cancel`/`yes`/`no`; `Commands` has them. | AC-11 |
| **ST-13** | `theme-roles.spec.test.ts` (core) | `defaultTheme` exposes the six roles with the decoded colours; `encode()` non-throwing at every depth. | AC-12 |
| **ST-14** | `fidelity.spec.test.ts` | Cross-component geometry: scrollbar glyphs/thumb pos, list colours + single-col no-divider + no focus glyph, dialog frame in `dialog` role — vs the decode. | AC-13 |
| **ST-15** | `packaging.spec.test.ts` | `ScrollBar`/`Scroller`/`ListView`/`ListBox`/`Dialog` + button helpers + `Commands.*` importable from `@jsvision/ui`; `check:deps` clean; files ≤500 lines. | AC-14 |
| **ST-16** | `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (+ `containers-demo.e2e.test.ts`) | Each new story mounts/paints/unique/metadata; navigator sidebar renders a `ListBox`; `demo:containers` headless. | AC-15 |

## Implementation test cases (`*.impl.test.ts`) — edges & internals

- **ScrollBar** — `getPos` rounding at boundaries; `getSize` floor to 3; wheel `±3·arStep`; thumb-drag
  proportional mapping; disabled range hit-zones are no-ops.
- **Scroller** — content smaller than viewport ⇒ `max==min` disabled bar; `both` bars reserve two edges;
  `pageStep = viewport-1`; clamp at `extent-viewport`.
- **ListView/virtual** — `topItem` keep-visible up/down/Home/End; empty list `<empty>`; `focused` clamp on
  items shrink; type-ahead buffer reset on focus-move + Backspace shrink; sorted stability.
- **Dialog** — `execView` does **not** attach a modal host to a non-`ModalHostAware` view (PA-1 guard);
  `valid()` treats children without `valid()` as valid; nested modal LIFO; Esc==close==cancel bypass.
- **Theme** — the six roles downsample correctly truecolor→256→16→mono (no throw).

## Security tests (mandatory surfaces)

- List `getText` output + input strings route through `sanitize` (no raw escapes to the terminal) — assert
  an escape-laden item string renders inert.
- Scroll delta / `ScrollBar.value` clamped to range ⇒ no out-of-bounds `items[index]` (virtual-row access
  bounds-checked); assert a forced out-of-range `value` does not index past `items`.
- The `Dialog` `valid()` gate is the allowlist completion check (ST-10 covers the veto).

## Verify

Targeted during dev: `yarn workspace @jsvision/ui test -- <pattern>`. Full before done:
`yarn verify` + `yarn test:e2e` + `yarn check:deps` + `yarn lint` (+ `yarn gate` informational).
