# Testing Strategy: Color family

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
|-----------|--------|
| Pure grid math (`color-grid.ts`: dims, hit, wrap-around nav, near-black) | 90% |
| `ColorSwatch` draw + nav + drag | 85% |
| `ColorPicker` glue (open/commit/cancel, hex) | 80% |
| Stories / demo | 60% |

- Test names state behavior: `should [expected] when [condition]`.
- Render-through-loop idiom (the `calendar.spec`/`tab-strip.spec` pattern): mount via `createEventLoop`
  + `mount`, dispatch synthetic key/mouse events, assert the **pre-`serialize` buffer** cell-by-cell for
  the fidelity oracles (ST-2 geometry, ST-3 marker).
- `ColorSwatch` fidelity ST-cases (ST-2 geometry, ST-3 marker, ST-4 nav, ST-5 drag) diff against the
  `TColorSelector` decode pinned at GATE-1 (03-01); the extension ST-cases encode
  generic-palette/hex/picker behavior.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from `01-requirements.md`, the `03-*` specs, the `colorsel.cpp` decode, and the
> register. Immutable oracles — if the implementation disagrees, the **implementation** is wrong (for
> the TV-derived `ColorSwatch`, a spec oracle that disagrees with a faithful `colorsel.cpp` decode is
> the defect, per the CLAUDE.md TV-fidelity exception). ST-n ↔ AC-n (RD-21).

### Color model + binding

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `ColorSwatch` over `ANSI16_ORDER`, `value = signal('brightCyan')`; then set `value` to a member; then to `'#123456'` (truecolor); then render on a 16-color cap | Cell = `value` marked; setting a member re-marks; the truecolor value accepted, **no marker** (∉ names), renders via `encode()`→nearest-16 without throwing | AC-1 / AR-211 / PA-9 |

### `ColorSwatch` — grid, marker, nav (faithful)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-2 | `ColorSwatch` with `columns: 4`, `ANSI16_ORDER` | **12-col** grid: each cell `█`×3 at col `j*3` in that cell's `Color` (`fg=cellColor`, `bg=black`), `ceil(16/4)=4` rows — asserted pre-`serialize`, matched to `colorsel.cpp:124-141` | AC-2 / PA-5/6/7 |
| ST-3 | `value` a member color; then `value = 'black'` (near-black) | The `value` cell shows `◘` (U+25D8) at its **centre** (`cellX+1`); a near-black cell's `◘` uses the `colorMarker` role (`0x70` black-on-lightGray); no other cell shows a marker | AC-3 / PA-1/PA-2 |
| ST-4 | From a focused swatch: `→` from the last cell; `←` from the first; `↓`/`↑` at edges; Enter/Space | `→`+1 wraps last→first; `←`−1 wraps first→last; `↑`/`↓` ∓/±`columns` with the edge-wrap decode; Enter/Space commits `colors[cursor]` to `value`; plain arrows do **not** leave the swatch | AC-4 / PA-8 |
| ST-5 | Mouse down on a cell; drag across cells; drag **outside** the grid; drag **inside** past the last cell of a partial final row | Down/move set cursor to `row*columns + floor(localX/3)`; drag outside the grid reverts to the **pre-drag** cell (`colorsel.cpp:167-173`); overshoot inside a partial row clamps to `colors.length-1` | AC-5 / PA-10 |

### Generic palette + state model

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-6 | `colors: [8 truecolor hex]`, `columns: 8`; then defaults (no `colors`/`columns`) | One row of 8 three-wide cells (width 24); defaults render `ANSI16_ORDER` as 4×4 | AC-6 / AR-212 |
| ST-7 | `value ∉ colors` (a truecolor), then `→`/`↑` then Enter/Space; then set `value` to a member | No cell marked; nav works from the cursor's current index; Enter/Space commits `colors[cursor]` (replacing the off-palette value); setting a member re-homes the cursor to its index | AC-15 / PA-9 |

### `ColorPicker`

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-8 | `ColorPicker`; Down/Alt+Down or `▐↓▌`-click (with + without a `PopupHost`); a swatch mouse-up over a cell; a mouse-**down** then drag then release; Enter on the cursor; Esc / outside mouse-down | Chip shows `value` as a block; open (a **no-op with no host**); commit **on release** over a cell — down-then-drag previews (cursor tracks) and does **not** close, releasing over a cell sets `value` **and closes**; Enter also commits+closes; Esc/outside closes **without** changing `value` | AC-7 / PA-11 |
| ST-9 | `allowCustom: true` (default): type `#12ab34` + Enter; type incomplete/invalid hex; `allowCustom: false` | A complete valid `#rrggbb` sets `value` (truecolor, via `toRgb()`) + closes; invalid rejected by `filter`/`toRgb`, `value` unchanged; `allowCustom:false` shows the grid only (no hex row) | AC-8 / AR-213 |

### Popup generalization + theme + packaging + showcase + security + edges

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-10 | `ColorPicker` hosting the `ColorSwatch` via `openAnchoredPopup`; the RD-14 `History`/`ComboBox` + RD-20 `DatePicker` suites | The swatch is hosted + focused + commits; **existing dropdown/date-picker tests stay green**; no `dropdown/` public export changes | AC-9 / PA-(dep) |
| ST-11 | `defaultTheme` + `encode()` | The `colorMarker` role exists (`0x70`); `encode()` of it does not throw; **no existing role changed**; guard allowlists still assert every existing byte | AC-10 / PA-1 |
| ST-12 | Package layout | `packages/ui/src/color/` with explicit named re-exports from `src/index.ts`; `ANSI16_ORDER` + `toRgb` present on the public `@jsvision/core` entry; **no existing core export changed**; `check:deps` passes; every `color/` file ≤ 500 | AC-11 / PA-3/PA-4 |
| ST-13 | Kitchen-sink `color/color-swatch` + `color/color-picker` stories (category `Color`); `demo:color` | Both stories pass smoke (mount + paint + unique id + metadata); `demo:color` runs headless with an ASCII frame per step | AC-12 / PA-14 |
| ST-14 | Malformed hex + all glyphs + all grid/cell/drag indexing | Every block/marker/caption sanitized; the hex field `filter`-gated + parsed by `toRgb()` (invalid never commits); all indexing bounds-checked for any palette size, `columns`, empty set, or drag beyond the grid edge | AC-13 / security |
| ST-15 | `colors: []`; `colors: [one]` | Empty grid, no marker, no crash / no out-of-range index; single color renders one cell, arrow-nav is a no-op (no infinite wrap) | AC-14 / edge |

> **⚠️ AUTHORING RULE:** expectations come from the specs + the `colorsel.cpp` decode — never from
> imagined implementation output. If an expectation can't be determined from the spec, it's an
> ambiguity → register it and resolve with the user before writing the test.

## Test Categories

### Specification Tests (from ST-cases) — written BEFORE implementation

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `color-grid.spec.test.ts` | ST-4 (nav), ST-5 (hit), ST-15 (edges) | Pure grid math |
| `color-swatch.spec.test.ts` | ST-1…ST-7 | `ColorSwatch` view |
| `color-picker.spec.test.ts` | ST-8, ST-9 | `ColorPicker` + hex |
| `color-popup.spec.test.ts` (or folded into `color-picker.spec`) | ST-10 | Popup consumption + RD-14/20 green |
| `color-theme.spec.test.ts` | ST-11 | `colorMarker` role |
| `color.packaging.spec.test.ts` | ST-12 | Re-exports / deps / line budget |
| `kitchen-sink.smoke.spec.test.ts` (extend) | ST-13 | Stories |
| (security + edge assertions folded into the above) | ST-14, ST-15 | Security / edges |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
|-----------|-------------|----------|
| `color-grid.impl.test.ts` | `navUp`/`navDown` edge-wrap branches, `hitCell` partial-row + outside, `isNearBlack` threshold, `gridDims` for `columns≤0`/`n=0` | High |
| `color-swatch.impl.test.ts` | cursor init/clamp, `value ∉ colors` re-home, drag revert vs clamp, `select()`/`onChange`, near-black marker style | High |
| `color-picker.impl.test.ts` | no-host guard, open→pick→close, commit-on-release vs drag-preview, hex parse commit + reject, `allowCustom:false`, chip caption via `nameFor` | Med |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| `demo:color` walkthrough | render → arrow-nav → pick → open picker → hex → commit | ASCII frame per step; `value` set; `color-demo.e2e.test.ts` green |
| RD-14/RD-20 regression | run `history.*` + `combo-box.*` + `date-picker.*` after wiring the picker | All green, unchanged (AC-9) |

## Test Data

### Fixtures Needed
- `ANSI16_ORDER` (16 named colors) for the 4×4 fidelity oracles; a small truecolor `Color[]` (e.g. 8
  `#rrggbb`) for the generic-palette + hex oracles; a near-black color (`'black'`, `'#010101'`) for the
  forced-contrast marker.
- A Unicode-capable caps profile (default; `█`/`◘` are BMP) + a 16-color cap for the ST-1 downsample.

### Mock Requirements
- A fake `PopupHost` for the picker open/commit path (the ComboBox/DatePicker test idiom), or the
  app-shell overlay. No other mocks — real signals/views.

## Verification Checklist
- [ ] All ST-1…ST-15 defined with concrete input/output pairs
- [ ] Every ST traces to an AC / spec / decode / AR entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red)
- [ ] All spec tests pass after implementation (green); implementation fixed on any failure, never the test
- [ ] GATE-2 AFTER-diff of `ColorSwatch` vs `colorsel.cpp` recorded (geometry + marker + nav + drag)
- [ ] Glyph width guard (PF-005): assert `charWidth('◘') === 1` and `charWidth('█') === 1` under the
      swatch's default (`wcwidth`) caps, so the ambiguous-width marker/cell can't corrupt the 3-wide math
- [ ] Impl tests written for edges/internals; RD-14/RD-20 suites still green
- [ ] `yarn verify` + `yarn check:deps` clean; no regressions
