# RD-21: Color family — ColorSwatch + ColorPicker (decode-first from `TColorSelector`)

> **Document**: RD-21-color-family.md
> **Status**: Draft
> **Created**: 2026-07-03 (`add_requirement` — date & color components; sibling 2 of 2)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done; `Group`/`View`/`DrawContext`, per-view focus, `bind`/`invalidate`), RD-04 (Event loop — done; focus chain, keymap/commands, mouse hit-test + drag), RD-01 (Reactive core — done; `Signal`/`computed` drive the grid + selected colour), RD-02 (Layout engine — done), RD-05 (App shell — done; `Window`/`Dialog` hosts, the overlay/`PopupHost` seam), RD-06 (Essential controls — done; `Input`, `filter` validator for the hex field), RD-14 (Input dropdowns — done; the anchored-popup primitive **generalized in RD-20 AR-204** to host a non-list view — the `ColorPicker` reuses that), RD-20 (Date family — the sibling that lands the AR-204 popup generalization this RD depends on), `@jsvision/core` (done; the **`Color` model** `color.ts`/`palette.ts` the swatch binds to; any additive `color*` theme role lands here at plan GATE-1)
> **Set**: Date & color components (AR-195…AR-224) — 2 sibling RDs; this is **RD-21 (Color family)**; **RD-20 (Date family)** is the sibling (and the AR-204 dependency).
> **CodeOps Skills Version**: 3.2.0

---

## Feature Overview

A **color family** for `@jsvision/ui`: a **`ColorSwatch`** grid view (pick a color from a palette of cells)
and a **`ColorPicker`** dropdown that shows the current color and opens that grid on demand (with an
optional hex field for arbitrary truecolor). Together they are the idiomatic way to choose a color in a
TUI — a theme accent, a syntax-highlight color, a drawing color.

**GATE-1 fidelity finding (`magiblot/tvision`).** Turbo Vision **does** have a color selector to decode —
**`TColorSelector`** in the core library (`source/tvision/colorsel.cpp:111-237`, header `colorsel.h`),
assembled (with `TColorGroupList`/`TColorItemList`/`TColorDisplay`/`TMonoSelector`) into the full
**`TColorDialog`** palette editor (`colorsel.cpp:694-749`, a 61×18 modal). So per the **NON-NEGOTIABLE
TV-fidelity directive** the `ColorSwatch`'s *drawing* is a **decode** of `TColorSelector::draw()`, not a
design. What TV does **not** have is a compact color *dropdown* — `TColorDialog` is a full-screen palette
*editor*, too heavy for a form field — so the `ColorPicker` **compresses** that idea into a swatch
dropdown (a **documented extension**, AR-210), the same latitude the RD-16 DataGrid / RD-20 DatePicker use.

Decoded facts from `TColorSelector::draw()` / `handleEvent()` (`colorsel.cpp:120-237`), to be re-verified
cell-by-cell at plan **GATE-1/GATE-2**:

| Piece | TV decode | `file:line` |
|-------|-----------|-------------|
| Grid shape | a **4-column** grid; foreground selector = **16 colours (4×4)**, background = **8 (2×4)** (`maxCol` 15 / 7) | `colorsel.cpp:124-141,161` |
| Cell width | **3 columns** per swatch, filled with the `icon` glyph in that colour attribute — `moveChar(j*3, icon, c, 3)` | `colorsel.cpp:131` |
| Selection marker | the selected cell's centre gets **CP437 `8`** (`◘`, `putChar(j*3+1, 8)`); when the colour is **black** (`c==0`) the marker cell is forced to attribute **`0x70`** so it stays visible | `colorsel.cpp:132-137` |
| Keyboard | arrows move the selection with **wrap-around** (`←→` ±1 within `[0,maxCol]`, `↑↓` ±`width`(4) with edge wrap) | `colorsel.cpp:179-217` |
| Mouse | **click / drag** picks the cell under the pointer (`color = mouse.y*4 + mouse.x/3`), tracking `evMouseMove` | `colorsel.cpp:165-177` |
| Framing | `ofFramed` (the selector draws a frame) | `colorsel.cpp:114` |

**Behavior may extend TV** (a generic `Color[]` palette, truecolor cells, a hex field, the dropdown) but
the **cell geometry (3-wide), the `◘` selection marker (+ the black-cell `0x70` rule), and wrap-around
navigation must match** `TColorSelector`, decoded/confirmed at plan GATE-1/GATE-2.

The components in scope:

| Component | Basis | Role |
|-----------|-------|------|
| `ColorSwatch` | **decode** — `TColorSelector` (`colorsel.cpp`) | A focusable `View` drawing a grid of **3-column** color cells over a **generic `Color[]`** set (DOS-16 default; any rows/cols), with the `◘` selection marker (+ the black-cell `0x70` rule), wrap-around arrow nav, and click/drag select. Binds a two-way `Signal<Color>`. |
| `ColorPicker` | **extension** — compresses `TColorDialog` (built on RD-14 popups) | A `Group`: a trigger **chip** showing the current color (+ optional label/hex text) + a `▼` that opens a `ColorSwatch` in the RD-14 anchored popup (generalized, AR-204), plus an **optional hex `Input`** for arbitrary `#rrggbb` truecolor. Single click on a swatch commits + closes; Esc cancels. |

---

## Functional Requirements

### Must Have

#### Color model — reuse `@jsvision/core` `Color` (AR-211)
- The family binds to the **existing core `Color`** type (`'default' | Ansi16Name | '#rgb'/'#rrggbb'`,
  `render/types.ts` + `color.ts`) — **no new color type**. A swatch set is a **`Color[]`**; the DOS-16
  default set is the shipped **`ANSI16_ORDER`** (`palette.ts:43`). Validation reuses **`toRgb()`**
  (`color.ts:42`), and truecolor cells **auto-downsample** on a lower-depth terminal via the existing
  `encode()` path (no special handling in the widget — a `#rrggbb` cell renders as its nearest 16-color
  on a 16-color terminal). Selection binds a two-way **`value: Signal<Color>`**.

#### `ColorSwatch` — the color grid view (AR-210/AR-212, decode of `TColorSelector`)
- A **focusable `View`** (`ofSelectable`) drawing a grid of color cells. **Single generic model
  (AR-212):** one reusable grid over a caller-supplied **`colors: Color[]`** (default `ANSI16_ORDER`),
  with a configurable **`columns`** (default **4**, matching `TColorSelector`); rows follow from
  `ceil(colors.length / columns)`. (TV's fg/bg-dual split is **not** built in — the fg-vs-bg distinction
  is an app concern; compose two `ColorSwatch`es if both are needed.)
- **Cell geometry (faithful):** each cell is **3 columns wide** (the `moveChar(j*3, …, 3)` decode),
  painted as a solid block **in that cell's own `Color`** (via a `DrawContext` custom style, not a theme
  role — the cells *are* the colors). Grid width = `columns * 3`.
- **Selection (faithful marker):** the selected cell (the one equal to `value`) gets the **`◘` marker**
  (U+25D8, the CP437 `8` decode) at its centre column; when the selected color is **black/dark** the
  marker is drawn in a **forced-contrast** style (the `0x70`-on-black decode) so it stays visible. `value`
  not present in `colors` ⇒ no marker drawn.
- **Keyboard (faithful wrap-around):** `←`/`→` move the selection ∓/±1 cell within `[0, colors.length-1]`
  with **wrap-around**; `↑`/`↓` move ∓/±`columns` with the edge-wrap decode (`colorsel.cpp:196-212`);
  **Enter/Space** commits the focused cell. Moving the selection updates the focused cell; **commit** sets
  `value` (and, in a `ColorPicker`, closes — AR-216).
- **Mouse (faithful):** a **click** on a cell selects it; **drag** (mouse-move while down) tracks the
  selection across cells (the `do…while(mouseEvent(evMouseMove))` decode, `colorsel.cpp:165-177`); a click
  in a `ColorPicker` also **commits + closes** (AR-216).
- **Framing:** the standalone `ColorSwatch` is a bare grid `View` (its host `Window`/`Dialog`/popup
  supplies any frame), matching how `TColorSelector` is a framed view inside `TColorDialog`; the grid
  itself draws only cells + marker.

#### `ColorPicker` — the swatch dropdown (AR-213/AR-216, extension)
- A **`Group`** composing a **trigger chip** (a small `View` showing the current `value` as a color block
  + an optional label or hex caption — TV's `TColorDisplay` idea, `colorsel.cpp:345-355`) + a trailing
  **`▼` button**, opening a **`ColorSwatch`** in the RD-14 **anchored popup** (`openAnchoredPopup`,
  **generalized in RD-20 AR-204** to host a non-list `View`).
- **Optional hex entry (AR-213):** when **`allowCustom: true`** (default `true`), the popup includes a
  **hex `Input`** below the grid — a `filter`-validated field (RD-06) accepting `#` + hex digits, parsed
  via **`toRgb()`**/`HEX_RE` (`color.ts`); a complete valid `#rrggbb` sets `value` (truecolor). Set
  `allowCustom: false` for a **pure indexed picker** (grid only). The picker binds one `Signal<Color>`.
- **Open / commit / cancel (mirrors `ComboBox`/`DatePicker`):** opens on the trigger's **Down/Alt+Down**
  or a **click on `▼`**; the popup takes focus; a **single click on a swatch** (or **Enter** on the
  focused cell, or a complete hex entry + Enter) **commits** the color **and closes**; **Esc**/outside
  mouse-down cancels (value unchanged); **no `PopupHost` ⇒ decline to open** (the headless guard).

#### Theme roles — minimal, mostly reused (AR-217)
- The swatch **cells are raw colors** (drawn in each cell's own `Color`), **not** theme roles — so RD-21
  adds **far fewer** roles than the other subsystems. The **frame** (popup frame is RD-14's), the **hex
  field** (reuses `input`/`inputSelection`), and the **chip caption** (reuses `staticText`/`label`) reuse
  existing roles. **If** the plan GATE-1 decode shows the **selection marker** needs its own role (the
  `0x70`-on-black contrast rule), add **one** additive `colorMarker` role pinned to the exact byte;
  otherwise no new core role. Additive, non-breaking — the AR-97/…/207 pattern. **Exact role count (0 or
  1) pinned at plan GATE-1.**

#### Kitchen-sink stories + headless demo (AR-219)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`ColorSwatch` story** and a
  **`ColorPicker` story** (category `Color`) — the swatch as a DOS-16 grid with a visible selected-color
  echo (name + hex), the picker as a chip opening the grid + a hex field — both passing the headless smoke
  test, plus a headless **`demo:color`** walkthrough (dispatch-driven, an ASCII frame per step: render →
  arrow-nav the grid → pick a swatch → open the picker popup → enter a hex color → commit), matching
  `demo:date`/`demo:tabs`/`demo:feedback`.

### Should Have
- **`ColorSwatch.select(color)`** convenience method (drives the same signal programmatically).
- **`onChange(color)`** callback fired when `value` changes.
- **Named swatches** — an optional `label` per cell surfaced in the chip caption / a tooltip-style echo
  (the swatch's own draw stays a color block; the name shows in the picker chip).

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- **All date components** (`Calendar`/`DatePicker`) — the sibling **RD-20**.
- **The full `TColorDialog` palette editor** (group list + item list + fg/bg dual selectors + text
  preview + OK/Cancel, `colorsel.cpp:694-749`) — a specialized theme-editing tool, reachable later on the
  RD-11 `Dialog`/`ListView` tier if wanted; RD-21 ships the compact picker, not the editor.
- **A built-in fg/bg dual selector** — the single generic grid is the model (AR-212); compose two.
- **HSV/RGB slider color mixing** — the hex field covers arbitrary truecolor; a slider mixer is a
  separate component.
- **Alpha / opacity** — the terminal color model has no alpha.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Recent-colors MRU strip (last-picked colors, reusing the History by-id store) | AR-214 (DEF-26) | later (post-set) | Needs its own global color-MRU store + persistence; a separable enhancement, like RD-14's `History` store. |
| Full `TColorDialog` palette editor (group/item lists + fg/bg + preview) | out-of-scope | later | A theme-editing tool built on RD-11 `Dialog`/`ListView`; distinct from a form-field picker. |
| HSV/RGB slider mixer | out-of-scope | later | A distinct color-mixing surface; the hex field covers arbitrary truecolor entry. |

---

## Technical Requirements

### New subsystem (AR-218)
- One new subsystem dir **`packages/ui/src/color/`** (dir-per-concern, AR-133/148/160/181/193/208):
  `color-swatch.ts` (the `ColorSwatch` `View` — grid draw over `Color[]`, marker, wrap-around nav,
  click/drag), `color-picker.ts` (the `ColorPicker` `Group` — trigger chip + `▼` + the generalized
  anchored popup + optional hex `Input`), one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named
  re-exports** from `src/index.ts` (the layout-convention rule). *(Exact file split confirmed at plan
  time.)*
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package + cross-RD edits (additive only)
- **`@jsvision/core`**: **0 or 1** additive theme role (`colorMarker`, only if the GATE-1 decode of the
  `0x70`-on-black marker rule needs it, AR-217) — pinned at plan GATE-1. No existing role changes; the
  swatch cells use raw `Color`s, not roles.
- **RD-14 popup generalization (AR-204):** **already landed by RD-20** — RD-21 **consumes** the
  generalized `openAnchoredPopup` (host an arbitrary fixed-size `View`); it does **not** re-touch
  `dropdown/`. (If RD-21 is somehow implemented before RD-20, this generalization is a shared prerequisite
  — noted as a dependency.)

### Reuse (no new engine primitives)
- **Color model + validation (core):** the `Color` type, `ANSI16_ORDER`/`PALETTE`, `toRgb()`/`HEX_RE`,
  and the depth-aware `encode()` downsampling (`color/`) — the swatch never reimplements color math.
- **Popup/overlay (RD-14/RD-05):** the `ColorPicker` reuses the generalized `openAnchoredPopup` +
  `PopupHost` + `absoluteRect` + catcher/Esc/outside-click dismissal, exactly as `DatePicker`/`ComboBox`.
- **Hex field (RD-06):** an `Input` + the `filter` validator gate the hex entry; parsing via `toRgb()`.
- **Reactivity/draw (RD-01/RD-03):** `Signal`/`computed` drive the grid + selection; RD-03
  `bind`/`invalidate`; all writes via `DrawContext` → `ScreenBuffer` + core `sanitize`.
- **Focus/keys/mouse (RD-04):** the `ColorSwatch` is a focusable `View`; wrap-around arrows route through
  the keymap; click **and drag** hit-test through the standard mouse path (the drag-track decode).

---

## Integration Points

- **View/Group + reactivity (RD-03/RD-01):** `ColorSwatch` is a focusable `View`; `ColorPicker` is a
  `Group` (chip + button), mirroring `DatePicker`/`ComboBox`.
- **Input dropdowns (RD-14) + Date family (RD-20):** `ColorPicker` is the fourth client of the anchored
  popup and the **second non-list** client (after `DatePicker`); it **depends on** the AR-204
  generalization RD-20 lands.
- **Core color (core):** binds to the shipped `Color` model + `toRgb()`; truecolor cells auto-downsample
  via `encode()`. The only possible additive core edit is the optional single `colorMarker` role.
- **App shell (RD-05):** a `ColorSwatch`/`ColorPicker` mounts in a `Window`/`Dialog`/`Desktop`; the picker
  needs the overlay `PopupHost` (present in a shell or a bare `Dialog`).
- **Kitchen-sink (examples):** `ColorSwatch` + `ColorPicker` stories + `demo:color`.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-210** — RD-21 is **decode-first for `ColorSwatch`** (TV counterpart `TColorSelector`, `colorsel.cpp`)
  and a **documented extension for `ColorPicker`** (compresses the heavy `TColorDialog` into a dropdown).
- **AR-211** — **reuse the core `Color` model** (no new type); swatch sets are `Color[]`; bind
  `Signal<Color>`; truecolor cells auto-downsample via the existing `encode()`.
- **AR-212** — a **single generic `Color[]` grid** (configurable `columns`, DOS-16 default), **not** the
  fg/bg dual selector; the fg/bg distinction is an app concern.
- **AR-213** — **grid + optional hex `Input`** (`allowCustom`, default on) for arbitrary `#rrggbb`
  truecolor; `allowCustom:false` = pure indexed picker.
- **AR-214** — **recent-colors MRU strip is DEFERRED** (DEF-26) to a later RD (needs its own color-MRU
  store).
- **AR-215** — the swatch geometry is **faithful to `TColorSelector`**: 3-wide cells, the `◘` selection
  marker (+ the black-cell `0x70` contrast rule), wrap-around arrow nav, click/**drag** select — pinned at
  plan GATE-1/GATE-2.
- **AR-216** — `ColorPicker` = trigger chip + `▼` + generalized anchored `ColorSwatch` popup (+ optional
  hex field); open on Down/Alt+Down/click, **single click on a swatch commits + closes**, Esc/outside
  cancels — mirroring `ComboBox`/`DatePicker`.
- **AR-217** — **minimal theme roles**: cells are raw `Color`s (no role); frame/hex/chip reuse existing
  roles; **0 or 1** additive `colorMarker` role (only if the `0x70`-on-black decode needs it), pinned at
  plan GATE-1.
- **AR-218** — new `src/color/` subsystem, explicit named re-exports.
- **AR-219** — kitchen-sink `ColorSwatch` + `ColorPicker` stories + headless `demo:color`.

> **Traceability:** AR-212/213/214 are explicit user choices (RD-21 `add_requirement` gate, 2026-07-03);
> AR-211 is a user-confirmed recommendation (reuse core `Color`); AR-210/215/216/217/218/219 are
> source-determined or single-dominant decisions (the GATE-1 finding, the faithful geometry, the house
> picker/subsystem/demo patterns) recorded for traceability.

---

## Security Considerations

> RD-21 adds a **color grid + a dropdown picker** over the existing in-process TUI. No network, no
> persistence, no new untrusted external surface. The input boundaries are keystroke/mouse → view state
> and hex text → color parse → screen:
- Every rendered glyph (color blocks, the `◘` marker, chip caption, hex field) routes through the RD-03
  `DrawContext` → `ScreenBuffer` + core **`sanitize`** boundary — no raw escape sequence reaches the
  terminal.
- The hex field is gated by the RD-06 **`filter` validator** (allowlist `#` + hex digits) and parsed by
  the core **`toRgb()`** single validation boundary (`color.ts:42`) — a malformed hex string is rejected
  (`toRgb` throws `InvalidColorError`, caught → the field stays at its last valid value); an invalid
  color is never committed to `value`.
- All grid indexing (cell selection, wrap-around nav, `mouse.y*columns + mouse.x/3` hit math) is
  **bounds-checked/clamped** to `[0, colors.length-1]` — no out-of-range indexing for any palette size,
  column count, empty set, or drag beyond the grid edge.
- `onChange`/callbacks are caller-supplied and invoked only on user action; no color text is interpreted
  as code.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. The `ColorSwatch` fidelity ACs (AC-2 geometry,
AC-3 marker, AC-4 nav) diff against the **`TColorSelector` decode** (`colorsel.cpp:120-237`), pinned at
plan GATE-1/GATE-2; the extension ACs encode the generic-palette / hex / picker behavior.

- **AC-1** (color model + binding) — a `ColorSwatch` over `colors: ANSI16_ORDER` binds `value: Signal<Color>`;
  setting `value` to a member color marks that cell; a `#rrggbb` truecolor value is accepted and (on a
  16-color capability) renders as its nearest ANSI-16 via `encode()` without error; a `value` not in
  `colors` marks no cell. *(AR-211/AR-215)*
- **AC-2** (grid geometry, faithful) — with `columns: 4` the grid draws cells **3 columns wide** (grid
  width = 12), each painted in its cell's `Color`, in `ceil(colors.length/4)` rows; asserted against the
  buffer pre-`serialize` and matched to the `colorsel.cpp:124-141` decode. *(AR-210/AR-212/AR-215)*
- **AC-3** (selection marker, faithful) — the cell equal to `value` shows the **`◘`** marker (U+25D8) at
  its centre column; when that color is **black** the marker is drawn in the forced-contrast style (the
  `0x70`-on-black decode) so it is visible; no other cell shows a marker. *(AR-215/AR-217)*
- **AC-4** (wrap-around keyboard nav) — `→` moves the selection +1 with wrap from the last cell to the
  first; `←` −1 with wrap; `↑`/`↓` move ∓/±`columns` with the edge-wrap decode; **Enter/Space** commits the
  focused cell to `value`. *(AR-215)*
- **AC-5** (click + drag select) — a click on a cell sets `value` to it; a drag (mouse-move while down)
  moves the selection across cells under the pointer (the `evMouseMove` track); the hit math is
  `row*columns + floor(localX/3)`, bounds-clamped. *(AR-215)*
- **AC-6** (generic palette + columns) — a custom `colors` array (e.g. 8 truecolor hex values) with
  `columns: 8` renders one row of 8 three-wide cells; `columns` defaults to 4 and `colors` to
  `ANSI16_ORDER` (16 cells, 4×4). *(AR-212)*
- **AC-7** (`ColorPicker` chip + open/commit/cancel) — the trigger chip shows `value` as a color block (+
  optional label/hex); **Down/Alt+Down** or a click on **▼** opens the `ColorSwatch` popup (a no-op with
  no `PopupHost`); a **single click on a swatch** (or Enter on the focused cell) sets `value` **and closes**;
  **Esc**/outside-mouse-down closes **without** changing `value`. *(AR-213/AR-216)*
- **AC-8** (optional hex entry) — with `allowCustom: true` (default) the popup shows a hex `Input`; typing
  a complete valid `#rrggbb` and committing sets `value` to that truecolor (parsed via `toRgb()`); an
  invalid hex is rejected by the `filter` validator / `toRgb` and does not change `value`. With
  `allowCustom: false` the popup shows the grid only. *(AR-213)*
- **AC-9** (popup generalization consumed; RD-14/RD-20 intact) — the `ColorPicker` hosts the non-list
  `ColorSwatch` via the **generalized** `openAnchoredPopup` (AR-204, landed by RD-20); the existing
  `History`/`ComboBox`/`DatePicker` popup tests stay green; RD-21 does not edit `dropdown/`. *(AR-216)*
- **AC-10** (theme roles) — the swatch cells render as raw `Color`s (no theme role); frame/hex/chip reuse
  existing roles; **at most one** additive `colorMarker` role exists (only if the GATE-1 decode needs it),
  `encode()` of it does not throw, and no existing role changes. *(AR-217)*
- **AC-11** (packaging) — the color family lives in `packages/ui/src/color/` with explicit named
  re-exports from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-218)*
- **AC-12** (stories + demo) — `ColorSwatch` and `ColorPicker` kitchen-sink stories (category **`Color`**;
  a DOS-16 grid with a selected-color echo (name + hex), the picker opening the grid + a hex field) pass
  the headless smoke test; **`demo:color`** runs headless with an ASCII frame per step (render → arrow-nav
  → pick a swatch → open the picker popup → enter a hex color → commit). *(AR-219)*
- **AC-13** (security) — every color block/marker/caption is sanitized to the screen; the hex field is
  `filter`-gated and parsed by `toRgb()` (an invalid hex never commits); all grid/cell/drag indexing is
  bounds-checked for any palette size, column count, empty set, or drag beyond the grid edge. *(security standard)*
- **AC-14** (empty / single-color state) — an empty `colors: []` renders an empty grid with no marker and
  no crash / out-of-range indexing; a single-color palette renders one cell and arrow-nav is a no-op (no
  infinite wrap loop). *(edge case; RD-16/17 empty-state precedent)*

---

> **Next step:** run the make_plan skill on RD-21 (spec-first: spec oracles RED → implement → GREEN → impl
> tests). Because `ColorSwatch` **has a TV counterpart** (GATE-1), the plan's GATE-1/GATE-2 work is
> mandatory: **decode `TColorSelector::draw()`/`handleEvent()` cell-by-cell** (`colorsel.cpp:120-237` — the
> 3-wide cells, the `◘`(CP437 8) marker + the `0x70`-on-black rule, the wrap-around arrow math, the
> click/drag hit math), **pin the 0-or-1 `colorMarker` role byte** if the decode needs it, and record the
> decode + the two BEFORE/AFTER gate tasks in `99-execution-plan.md`; the generic-palette/hex/picker
> extensions get spec oracles but no diff. **This RD depends on the AR-204 popup generalization landed by
> RD-20** — sequence RD-20 first. Then optionally preflight, then exec_plan. RD-20 (Date family) is the
> sibling; together they complete the date & color set.
