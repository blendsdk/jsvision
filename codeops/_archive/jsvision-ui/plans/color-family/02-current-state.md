# Current State: Color family

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

RD-21 composes shipped facilities and adds a new `src/color/` subsystem. This document records the
exact reuse points (verified `file:line`) so the plan builds on real code, plus the one gap PF-002
identified (the missing core re-exports) and the popup dependency that RD-20 already satisfied.

## Reuse points (verified)

### Core color model — `@jsvision/core`

| Symbol | Location | Public today? | RD-21 use |
|--------|----------|---------------|-----------|
| `Color` type | `packages/core/src/engine/render/types.ts:33` | ✅ exported | The swatch/picker `value` type; `colors: Color[]`. |
| `ANSI16_ORDER` | `packages/core/src/engine/color/palette.ts:43` | ❌ **not re-exported** | The DOS-16 default palette (16 names). **PA-3 adds the re-export.** |
| `toRgb(color)` | `packages/core/src/engine/color/color.ts:42` | ❌ **not re-exported** (barrel omits it) | The hex/color validation boundary (throws `InvalidColorError`). **PA-3 adds the re-export.** |
| `HEX_RE` | `packages/core/src/engine/color/color.ts:32` | ❌ bare `const`, unexported | **Stays private** (PA-3); the hex field uses `filter` + `toRgb()`. |
| `PALETTE` | `packages/core/src/engine/color/palette.ts:100` | ✅ exported | `PALETTE.black`/`.lightGray` back the `colorMarker` role byte. |
| `encode()` downsampling | `packages/core/src/engine/color/` | ✅ (via `serialize`) | Truecolor cells auto-downsample on lower-depth caps — no widget handling. |
| `InvalidColorError` | `color.ts:29` | ✅ exported | Caught around `toRgb()` in the hex field. |

The additive re-exports slot into the existing color block at `engine/index.ts:146-157` (currently
`encode, encodeStyle, styleKey, nearest256, nearest16, InvalidColorError, PALETTE, defaultTheme`) and
`color/index.ts` (currently re-exports `PALETTE`, `defaultTheme`, the encoders). Both edits are
**additive**; `check:deps` is unaffected.

### Theme role pattern — `@jsvision/core`

`theme.ts` defines each role as `readonly <name>: ThemeRole;` on the `Theme` interface with a JSDoc
citing its decode, plus a `defaultTheme` entry `<name>: { fg: PALETTE.x, bg: PALETTE.y }`. The
`calendar*` roles (`theme.ts:263-291,402-407`) are the template — e.g. `calendarCursor: { fg:
PALETTE.black, bg: PALETTE.white }` (`0xF0`). The `colorMarker` role follows: `{ fg: PALETTE.black,
bg: PALETTE.lightGray }` = `0x70`. **PA-14 guard note:** three closed-set theme guards must list
`colorMarker` — `tabs-theme.spec` (`TAB_ROLES`, ST-30), `feedback-theme.spec` (`FEEDBACK_ROLES`,
ST-11), and `date-theme.spec` (the six `calendar*` roles, "ONLY new keys"). `table-theme.spec` is
**not** closed-set (no edit). Run `grep -rn "LATER_ADDITIVE_ROLES\|additive\|ONLY"
packages/ui/test/*theme*` before implementing as the backstop (date-family extended tabs+feedback+date;
re-check the current set).

### Drawing — RD-03 `DrawContext`

`makeDrawContext` (`packages/ui/src/view/draw-context.ts`) hands `View.draw(ctx)`: `ctx.text(x, y,
str, style)`, `ctx.fillRect(x, y, w, h, char, style)`, `ctx.fill(char, style)` — all take a **raw
`Style { fg, bg }`**, so a swatch cell is painted with the cell's own `Color` (`ctx.fillRect(cellX, y,
3, 1, '█', { fg: cellColor, bg: PALETTE.black })`), **no theme role** (AR-217). `ctx.color(role)` /
`ctx.role(role)` resolve theme roles for the marker/chip/frame paths. Every write routes through
`ScreenBuffer` + `sanitize` (the injection boundary, AC-13). `ctx.caps` is available if an ASCII glyph
fallback is ever needed (the swatch glyphs `█`/`◘` are BMP; no fallback required).

**Width assumption (PF-005):** both `█` (U+2588) and the marker `◘` (U+25D8) are East-Asian
**Ambiguous** and measure **width 1** under the renderer's default `wcwidth` mode (`render/width.ts` —
Ambiguous is width 1 unless caps request `ambiguous-wide`), so the 3-wide cell math and the centered
`◘` at `cellX+1` hold. This matches the existing project-wide `█` usage (buttons/progress/scrollbars).
The geometry assumes the default `wcwidth` width mode; GATE-2 asserts `charWidth('◘') === 1` (and
`'█'`) under the swatch's caps so a mis-measured marker can't push a continuation cell into its
neighbor. (The `directive`'s East-Asian-width caution is thus recorded, not merely BMP-checked.)

### Focus / keys / mouse — RD-04

`ColorSwatch` is a focusable `View` (`focusable`/`state.focused`); wrap-around arrows + Enter/Space
arrive via `onEvent(ev: DispatchEvent)` (`ev.event.type === 'key'`); mouse down/move/up arrive as
`{ type: 'mouse', kind: 'down'|'move'|'up' }` with view-local `ev.local` (RD-04 hit-test normalizes
1-based→0-based). Drag tracking uses the same down→move→up sequence TV loops over.

### Anchored popup — RD-14 generalized by RD-20 (the AR-204 dependency, DONE)

`openAnchoredPopup` (`packages/ui/src/dropdown/popup.ts:216`) already hosts an **arbitrary fixed-size
`View`** via `buildContent(commit)` / `contentSize { width?, height }` / `focusTarget(content)` /
`onDismiss` (`popup.ts:59-88`). It injects a `commit` trigger, mounts a framed popup + outside-click
catcher into the overlay, focuses the target, and dismisses on Esc / outside-down / focus-loss. RD-21
**consumes** it exactly as `DatePicker` does (`date-picker.ts:167-190`) — **no edit to `dropdown/`**
(AC-9). `absoluteRect(view)` (`popup.ts:180`) computes the anchor; `drawDropdownIcon(ctx, x)`
(`popup.ts:41`) draws the shared `▐↓▌` button so the picker's trigger button is byte-identical to
ComboBox/DatePicker.

### Hex field — RD-06 `Input` + `filter`

`Input` (`packages/ui/src/controls/`) binds a two-way `Signal<string>`; the `filter` validator
(`controls/validators/`) live-rejects characters outside a charset. The hex field uses `filter('#'
+ hex digits)` for live reject + `toRgb()` (catching `InvalidColorError`) for the final parse — the
`ComboBox`/`DatePicker` two-way value⟷text bind idiom (`date-picker.ts:131-144`), each direction
reading only the other signal (no feedback loop).

### Reactivity — RD-01

`signal`/`computed`/`effect`; `View.bind(read, write)` for the value⟷cursor / value⟷text binds;
`invalidate()` repaints on cursor/value change.

## The mirror: `DatePicker`

`ColorPicker` mirrors `DatePicker` (`date-picker.ts`) one-for-one: a `Group` of `[ field/chip (fr) |
▐↓▌ button (3) ]`, `open(ev)` guarded by `ev.popupHost === undefined` (headless no-op), the field
focused first, then `openAnchoredPopup` hosting the grid whose activation calls the injected
`commit()`. The differences: the leading element is a **color chip** (not a masked field) when
`allowCustom` is off, or a **chip + hex `Input`** stack when on; and the hosted content is a
`ColorSwatch` (+ optional hex `Input` row) rather than a `Calendar`.

## Gaps to close (this plan)

1. **Core re-exports** — `ANSI16_ORDER` + `toRgb` are not public (PF-002/PA-3). Additive fix in
   `color/index.ts` + `engine/index.ts`.
2. **`colorMarker` role** — the `0x70` forced-contrast byte needs a role (PA-1). Additive in
   `theme.ts` + `defaultTheme` + the guard allowlists (PA-14).
3. **The `src/color/` subsystem** — new (`color-grid.ts`, `color-swatch.ts`, `color-picker.ts`,
   `index.ts`, PA-4) + explicit re-exports in `packages/ui/src/index.ts`.
4. **Examples** — two kitchen-sink stories + `color-demo/` + its e2e.
