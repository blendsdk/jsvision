# RD-07: Essential-Control Completions — Input selection/clipboard · picture(mask) · MultiCheckGroup · visible caret

> **Document**: RD-07-essential-control-completions.md
> **Status**: Draft
> **Created**: 2026-07-01 (`add_requirement`, RD-06/RD-11 settled)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-06 (Essential controls — done; `Input`, the `Cluster` base, the `filter`/`range`/`lookup` validator model + `cpGrayDialog` control roles are the direct upstream this RD extends), RD-05/RD-04/RD-03 (done) — the **new** caret seam built here threads through their `View` → `RenderRoot` → `EventLoop` → host surfaces (all additive), `@jsvision/core` (done; `setClipboard()` OSC-52 write, bracketed `PasteEvent`, and `cursor` all already exist)
> **Scoped from**: the roadmapped "RD-07 High-value controls" bucket (AR-115) — the thin **control-completions** slice that finishes RD-06's leaf controls; the compound/heavy controls (`History`, `ComboBox`, `Tree`, `Tabs`, `Table`/`DataGrid`, `ProgressBar`/`Spinner`, `Surface`) split out to future sibling RDs, mirroring the RD-06 → RD-11 split (AR-93).
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The **completion** tier of `@jsvision/ui`'s essential controls — the four capabilities RD-06 deliberately
deferred (tracked as `DEF-01`/`DEF-02`/`DEF-03`/`DEF-19`) so its leaf-control slice stayed small and
demoable in a plain `Window`. Each finishes an existing RD-06 control or its validator/host seam rather
than introducing a new widget family; none needs the overlay-dropdown, virtual-scroll, or multi-column
machinery the later high-value controls require. Each is reimagined from its Borland Turbo Vision
counterpart per the **NON-NEGOTIABLE TV-fidelity directive** (`magiblot/tvision` `source/tvision/t*.cpp`,
palette map `dialogs.h`), on the RD-03 spine / RD-04 loop / RD-05 shell already built.

The components in scope:

| Capability | TV source | Role |
|-----------|-----------|------|
| `Input` **selection + clipboard** | `TInputLine` (`tinputli.cpp`) | Text selection (`selStart`/`selEnd`/`anchor`) via keyboard + mouse-drag, and cut/copy/paste against the **system clipboard**. |
| `picture(mask)` **validator** | `TPXPictureValidator` (`tvalidat.cpp`) | The Paradox picture-mask mini-DSL: a fourth validator factory beside `filter`/`range`/`lookup`. |
| `MultiCheckGroup` | `TMultiCheckBoxes` (`tmulchkb.cpp`) | A cluster whose items each hold a small **multi-state** value (not just on/off), cycled on press. |
| **Visible caret** | `TInputLine::draw` `setCursor` (`tinputli.cpp:160`) + `TView::showCursor` | The logical + **real hardware** terminal cursor at the focused `Input`'s edit position, via an additive `View` → host caret seam. |

**Behavior may extend TV** (system-clipboard integration via OSC-52 + bracketed paste, a `Signal<number[]>`
binding for the multi-check states, an async host caret seam) but the **drawing/geometry must match TV
exactly** (selection highlight columns, mask semantics, the `[ ]`+marker box, caret cell position).

---

## Functional Requirements

### Must Have

#### `Input` — text selection (TV `TInputLine`, AR-116)
- A selection range `{ selStart, selEnd }` with a moving `anchor`, faithful to `tinputli.cpp:227-235`
  (`adjustSelectBlock`). **Full-faithful gesture set:**
  - **Keyboard:** Shift+Left/Right extend by one grapheme; **Ctrl+Shift+Left/Right** extend by word
    (`prevWord`/`nextWord`, `tinputli.cpp:363-372`); Shift+Home/End extend to the field ends; a plain
    (un-shifted) motion collapses the selection (`extendBlock` false → `selStart = selEnd = 0`,
    `:459`). **Select-all** (Ctrl+A → `selectAll`, `tinputli.cpp:496`).
  - **Mouse:** press sets `anchor = mousePos`; drag extends `curPos` so the range grows/shrinks
    (`tinputli.cpp:325-333`).
  - **Editing a selection:** Backspace/Delete (and typing a printable) over a **non-empty** selection
    first deletes the selected range (`deleteSelect`, `tinputli.cpp:203-211`), then applies the edit;
    the inserted text still passes `validator.isValidInput` + `maxLength` (RD-06 semantics preserved).
- **Rendering (AR-122):** the selected columns `selStart..selEnd` draw in a distinct **selection** theme
  role (the faithful `cpGrayDialog` selection color, decoded from `TInputLine::draw`'s `getColor` chain
  at plan GATE-1, `tinputli.cpp:145-156`); the unselected field keeps the RD-06 `inputSelected`/
  `inputNormal` roles.

#### `Input` — cut / copy / paste against the system clipboard (TV `TInputLine` `cmCut`/`cmCopy`/`cmPaste`, AR-117)
- **Copy / Cut** place the selected text on the **system clipboard** via core's existing
  `setClipboard(text, caps)` (OSC-52 write, gated on `caps.osc.clipboard52` — a no-op when unsupported),
  matching the modern TV fork's `TClipboard::setText` (`tinputli.cpp:478`). **Cut** additionally deletes
  the selection (`deleteSelect` + re-validate, `:481-487`).
- **Paste** consumes the existing **bracketed `PasteEvent`** (core input decoder → `route()` focus sweep,
  dispatch.ts:12): the OS-delivered pasted text replaces any selection and inserts at the cursor,
  filtered by `validator.isValidInput` + `maxLength`. (App-initiated clipboard **read** — an OSC-52
  query — is **deferred**: terminals commonly block it for security; bracketed paste is the reliable
  inbound path.)
- **Keys + commands:** the TV-faithful, SIGINT-safe DOS chords — **Ctrl+Insert** (copy), **Shift+Insert**
  (paste), **Shift+Delete** (cut) — plus additive `Commands.copy`/`cut`/`paste` constants on the RD-05
  `Commands` set so a menu/status item can drive the focused `Input`.

#### `picture(mask)` — Paradox picture-mask validator (TV `TPXPictureValidator`, AR-119)
- A **fourth** validator factory `picture(mask: string, autoFill?: boolean): Validator`, added beside
  `filter`/`range`/`lookup` under `controls/validators/`, implementing the **full** `TPXPictureValidator`
  mask DSL faithfully ported from `tvalidat.cpp` (the `process`/`scan`/`group`/`iteration`/`checkComplete`
  state machine `:264-517`; `syntaxCheck` `:519`) — all special characters
  `# ? & ! @ * { } [ ] , ;` (digit / letter / letter-forced-upper / any-forced-upper / any /
  repeat-group / grouping / optional / alternation-separator / literal-escape) via the recursive
  `process`/`scan`/`group`/`iteration`/`checkComplete` state machine, with optional **`autoFill`** of
  trailing literals (the trailing-literal fill loop in `picture()`, `tvalidat.cpp:572-585`).
- **Firing (RD-06 AR-101 semantics):** transient `isValidInput` (per-keystroke, `prError` rejects the
  edit live — `tvalidat.cpp:149-153`) vs blocking `isValid` (on completion / focus-leave, requires
  `prComplete` — `:156-161`). It plugs into the RD-06 `Input.validator` hook unchanged.
- **Bounds-safety (security):** the parser is bounded — a malformed or adversarial mask is rejected by
  `syntaxCheck` (`tvalidat.cpp:519`) and recursion/iteration is depth/length-bounded so no mask can hang
  or overflow the validator (no unbounded recursion, no out-of-range index into input/`pic`).

#### `MultiCheckGroup` — multi-state cluster (TV `TMultiCheckBoxes`, AR-120)
- A new cluster control over the existing internal `Cluster` base (RD-06), a sibling of
  `CheckGroup`/`RadioGroup`. Each item holds a small **state index** `0..states.length-1` (TV packs these
  into a `uint32` bitfield via `flags`; `tmulchkb.cpp:73-102`); **press** (Space/click) **cycles** the
  focused item's state `state = (state + 1) % states.length` (`tmulchkb.cpp:86-101`).
- **Binding (AR-120):** idiomatic **`Signal<number[]>`** — one state index per item — matching the RD-06
  two-way-signal model (AR-100), *not* TV's packed-bitfield API. The **visual stays TV-faithful:** the
  `" [ ] "` box (`tmulchkb.cpp:67`) with the per-state marker drawn from a `states` **marker string**
  (`states[stateIndex]`, `drawMultiBox`, `tcluster.cpp:87`); the box/marker use the RD-06
  `clusterNormal`/`clusterSelected`/`clusterShortcut`/`clusterDisabled` roles.
- Keyboard/mouse nav (↑↓ move focus, Space/click cycle, per-item `~hotkey~`, disabled items skipped) is
  inherited from the `Cluster` base unchanged.

#### Visible caret — logical + real hardware cursor (TV `setCursor`/`showCursor`, AR-121)
- **Logical caret:** the focused `Input` marks its edit cell — column `curPos − firstPos + 1`
  (`tinputli.cpp:160`) — as the caret cell so it is visible even where the terminal cursor cannot be
  shown.
- **Hardware caret (additive `View` → host seam):** a minimal, additive cross-package seam so the **real
  blinking terminal cursor** is positioned at the focused view's caret cell:
  - `View` gains a way to report a **view-local desired caret** (a cell, or none) when focused;
  - `RenderRoot` translates the focused view's caret to an **absolute** screen cell during compose
    (hidden when no view requests one);
  - the `EventLoop` carries that caret alongside each composed frame (an additive hook next to
    `onFrame`, RD-05 PA-3) and `run()`/`createHost` positions the real cursor via core's existing
    `cursor.show()`/`cursor.to()` (`@jsvision/core` `render/cursor.ts`), hiding it when there is no
    caret. This mirrors the additive RD-05 `onFrame`/`setCapture` seams — no existing signature is
    reshaped.
- The caret is shown only for the **focused** view that requests one; losing focus / no requester hides
  the hardware cursor (TV `sfCursorVis`).
- **Suspend/resume:** `run()` **co-owns the output stream** (a two-writer arrangement with `host.render` —
  no core change: it emits the `cursor.*` escape to the same stream after each frame) and **re-applies the
  caret on `onResume`** — on SIGCONT the core host re-asserts modes (cursor hidden) + full-repaints the last
  buffer (`host/signals.ts`) but does **not** restore the app caret, so `run()` must re-emit it.

#### Kitchen-sink stories + demo (NON-NEGOTIABLE showcase rule, AR-124)
- A **`MultiCheckGroup` story** in the kitchen-sink showcase (the one new *visual* component), passing the
  headless smoke test (mounts, paints, unique id, metadata), with a live bound-state echo.
- The existing `Input` **story is extended** to demonstrate selection (highlighted range), copy/paste, a
  `picture(mask)` field, and the visible caret; and the headless **`demo:controls`** walkthrough gains
  steps for a selection→copy→paste sequence, a masked field rejecting/auto-filling, and a
  `MultiCheckGroup` cycling states (dispatch-driven, an ASCII frame per step, matching the RD-06 demo).

### Should Have

- A `selectAll()` convenience + `Ctrl+A` binding surfaced on `Input` (falls out of the selection model
  cheaply).
- The caret seam exposed generally enough that any future `View` (e.g. a `ListView` editor) can request a
  hardware caret without further host changes.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `History` (Input dropdown), `ComboBox`, `Tree`, `Tabs`, `Table`/`DataGrid`, `ProgressBar`/`Spinner`,
  `Surface` → **future high-value-control sibling RDs** (RD-12+); the roadmapped "RD-07 bucket" is sliced
  per AR-115.
- Multi-column cluster layout (TV `TCluster` `size.y`-rows-per-column + `←`/`→`) → `DEF-17` (unassigned).
- Editor family, file dialogs → RD-08 / RD-09.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| `Input` **insert/overwrite mode** + `Ins` toggle (TV `sfCursorIns`) | AR-118 | **`DEF-20`** (unassigned) | Overwrite is rarely used in forms and couples to caret-shape; kept out to keep the completion slice lean. |
| App-initiated clipboard **read** (OSC-52 query) | AR-117 | unassigned | Terminals commonly block OSC-52 read for security; bracketed paste is the reliable inbound path. |

> `DEF-01`/`DEF-02`/`DEF-03` (Input selection+clipboard · `picture` · `MultiCheckGroup`) and `DEF-19`
> (visible caret) move from Deferred to **Done** when RD-07 ships.

---

## Technical Requirements

### Subsystem placement (AR-123)
- Extends the existing **`packages/ui/src/controls/`** subsystem (the AR-102 convention — no new
  subsystem dir): edits to `input.ts` (selection/clipboard/caret request), a new
  `controls/validators/picture.ts` (+ its barrel export), and a new `controls/multi-check-group.ts` over
  the existing `Cluster` base. **Explicit named re-exports** from `src/index.ts` for `picture` and
  `MultiCheckGroup` (the layout-convention rule, AR-102).
- The **caret seam** touches `view/` (`View` caret-request), `view/render-root.ts` (absolute caret
  collection), and `event/` (carry the caret with the frame) in `@jsvision/ui`, plus the `run()`/host
  wiring — all additive.
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds); files ≤ 500 lines.

### Cross-package edits (additive only, AR-117/AR-121/AR-122)
- `@jsvision/core` `Theme` + `defaultTheme` gain the additive faithful **`Input` selection** role
  (decoded from `TInputLine::draw`'s `getColor` chain at plan GATE-1) — same additive pattern as the
  RD-06 control roles (AR-97). No existing role changes.
- The RD-05 `Commands` set gains `cut`/`copy`/`paste` constants (AR-117) — additive; no existing command
  changes.
- **No new core primitive** for copy/paste (reuses `setClipboard()` + bracketed `PasteEvent`) or the
  caret (reuses `cursor.show()`/`cursor.to()`); only the additive `View`→host caret *seam* is new, and it
  is intra-`@jsvision/ui` plus the existing `run()`/host wiring.

### Reuse (no new engine primitives)
- **Clipboard write:** core `setClipboard(text, caps)` (OSC-52, caps-gated) — already built.
- **Paste in:** the core bracketed-paste `PasteEvent` already routed to the focused view by `route()`
  (dispatch.ts:12) — `Input` just handles `type: 'paste'`.
- **Caret positioning:** core `cursor.show()`/`cursor.to()` (`render/cursor.ts`) — already built.
- **Validators:** `picture` implements the existing `Validator` shape (`isValidInput`/`isValid`) — plugs
  into the unchanged RD-06 `Input.validator` hook.
- **Cluster:** `MultiCheckGroup` reuses the RD-06 internal `Cluster` base (nav/hit-test/hotkeys/disabled).
- **Reactivity/layout/draw:** RD-01 signals + RD-03 `bind`/`invalidate`, RD-02 reflow, RD-03 `DrawContext`
  (all writes via `ScreenBuffer` + `sanitize`).

---

## Integration Points

- **Essential controls (RD-06):** the direct upstream — this RD edits `Input`, adds a validator factory,
  and adds a `Cluster`-derived control; the existing `demo:controls` + control stories are extended.
- **App shell (RD-05):** the `Commands` set gains `cut`/`copy`/`paste`; the caret seam extends the same
  `run()`/host lifecycle that owns `onFrame`; a focused `Input` in a `Dialog` (RD-11) shows the hardware
  caret + selection with no dialog changes.
- **Core (core):** `setClipboard`/`PasteEvent`/`cursor` are reused as-is; the one additive `Theme`
  selection role + the `Commands` constants extend existing single-sources-of-truth.
- **Kitchen-sink (examples):** the new `MultiCheckGroup` story + the extended `Input` story/`demo:controls`
  walkthrough.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-115** — RD-07 = the thin **control-completions** slice (DEF-01/02/03/19); History/ComboBox/Tree/
  Tabs/Table/Progress/Surface → future sibling RDs (the RD-06→RD-11 split precedent, AR-93).
- **AR-116** — `Input` selection = **full-faithful** (Shift+arrows + Ctrl+Shift word-select + mouse-drag
  + select-all; edits delete a non-empty selection first).
- **AR-117** — clipboard = **system clipboard** (copy/cut → `setClipboard()` OSC-52 write; paste →
  bracketed `PasteEvent`); keys Ctrl+Ins/Shift+Ins/Shift+Del + `Commands.cut`/`copy`/`paste`; OSC-52
  **read** deferred.
- **AR-118** — insert/overwrite mode (`Ins`/`sfCursorIns`) **deferred** (insert-only); tracked `DEF-20`.
- **AR-119** — `picture(mask)` = the **full** `TPXPictureValidator` DSL + `autoFill`, bounds-safe.
- **AR-120** — `MultiCheckGroup` binds an **idiomatic `Signal<number[]>`** (state index per item) + a
  `states` marker string; the box/marker visual stays TV-faithful.
- **AR-121** — visible caret = **logical + real hardware** cursor via an additive `View`→host caret seam
  (reuses core `cursor`).
- **AR-122** — an additive faithful **`Input` selection** theme role on core `Theme` (decoded at plan
  GATE-1).
- **AR-123** — extend the existing `packages/ui/src/controls/` subsystem (no new dir); explicit named
  re-exports; the caret seam is additive across `view/`/`event/`/host.
- **AR-124** — a `MultiCheckGroup` kitchen-sink story + an extended `Input` story/`demo:controls`
  walkthrough.

> **Traceability:** AR-115…AR-121 are explicit user choices (RD-07 `add_requirement` interview,
> 2026-07-01); AR-122…AR-124 are single-dominant decisions (the AR-97 additive-role pattern, the AR-102
> subsystem convention, the AR-98/kitchen-sink demo rule) recorded for traceability.

---

## Security Considerations

> RD-07 completes existing in-process controls; no network, no persistence. The new input boundaries are
> pasted text, mask parsing, and clipboard escape emission:
- **Paste is untrusted input** — bracketed-paste text is bounded by the core decoder's size cap (RD-06
  `PL-5`) and, on insert, filtered through `validator.isValidInput` + `maxLength`; it is drawn via the
  RD-03 `DrawContext` → `ScreenBuffer` + core `sanitize` boundary, so no raw escape sequences in pasted
  content can reach the terminal.
- **Clipboard write** goes through core `setClipboard()`, which **base64-encodes + sanitizes** the text
  into the OSC-52 sequence (no injection of raw control bytes); it is caps-gated (a no-op when the
  terminal lacks clipboard support) and never logs the clipboard contents.
- **Mask parsing is bounded** — `picture()` rejects malformed masks via `syntaxCheck` and bounds its
  recursion/iteration and all `input`/`pic` indexing, so no adversarial mask can hang, overflow, or
  index out of range (allowlist-style: only masks that parse are accepted).
- The caret seam emits only a cursor-position/visibility escape derived from clamped, in-bounds cell
  coordinates — no app text is placed in the escape.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode (TV `tinputli.cpp`/`tvalidat.cpp`/`tmulchkb.cpp`
+ `dialogs.h` is the drawing/semantics oracle; the C++ source outranks a mis-decoded oracle per the
fidelity directive).

- **AC-1** (`Input` keyboard selection) — Shift+Right/Left extends the selection by one grapheme and
  Ctrl+Shift+Right/Left by a word; Shift+Home/End extends to the ends; a plain arrow collapses it; the
  selected columns render in the selection role. *(AR-116/AR-122)*
- **AC-2** (`Input` mouse selection) — press-and-drag sets `anchor` then extends the range as the pointer
  moves; the highlighted range matches `selStart..selEnd`. *(AR-116)*
- **AC-3** (`Input` select-all + edit-over-selection) — Ctrl+A selects the whole value; typing a
  printable (or Backspace/Delete) over a non-empty selection deletes the selection first then applies the
  edit, still honoring `validator.isValidInput` + `maxLength`. *(AR-116)*
- **AC-4** (copy / cut to system clipboard) — with a caps profile advertising OSC-52 clipboard,
  **Ctrl+Insert** (or `Commands.copy`) emits the OSC-52 write of the selected text; **Shift+Delete**
  (`Commands.cut`) emits it **and** deletes the selection + re-validates; with clipboard unsupported both
  are safe no-ops. *(AR-117)*
- **AC-5** (paste) — a bracketed `PasteEvent` delivered to a focused `Input` replaces any selection and
  inserts the pasted text at the cursor, filtered by `validator.isValidInput` + `maxLength`; **Shift+
  Insert** maps to the same paste path. *(AR-117)*
- **AC-6** (`picture` transient) — `picture("###-##")` on an `Input` rejects a keystroke that would make
  the value un-maskable live (`isValidInput` → `prError`) and accepts digits in the `#` positions;
  literals (`-`) are matched/auto-inserted. *(AR-119)*
- **AC-7** (`picture` blocking + autoFill) — `isValid` is true only when the value is `prComplete` for the
  mask; with `autoFill` on, a positive completion appends trailing literal characters; a malformed mask
  is rejected by `syntaxCheck` (never hangs). *(AR-119)*
- **AC-8** (`picture` group / repeat / alternation) — the DSL specials `{ } [ ] * ! & ? @ ;` behave per
  `tvalidat.cpp` (e.g. `[#]` optional digit, `{#*}` repeat, `&` letter-forced-upper), asserted against
  the source semantics. *(AR-119)*
- **AC-9** (`MultiCheckGroup` cycle + bind) — a `MultiCheckGroup` with `states = " xX"` renders each item
  as `" [ ] "` with the marker for its current state; Space/click on the focused item cycles its state
  `0→1→2→0`; the bound `Signal<number[]>` reflects each change; ↑↓ move focus. *(AR-120)*
- **AC-10** (`MultiCheckGroup` faithful visual) — the box glyphs, marker column, and state markers match
  `TMultiCheckBoxes`/`drawMultiBox` (`tmulchkb.cpp`/`tcluster.cpp`) and use the `cluster*` roles,
  asserted against the buffer pre-`serialize`. *(AR-120, fidelity directive)*
- **AC-11** (logical caret) — a focused `Input` marks the caret cell at `curPos − firstPos + 1`
  (`tinputli.cpp:160`); it moves with the cursor and horizontal scroll. *(AR-121)*
- **AC-12** (hardware caret seam) — with a focused `Input`, the loop positions the real terminal cursor
  (core `cursor.to()`/`show()`) at the absolute caret cell each frame and hides it when no view requests
  a caret / focus is lost; no existing `onFrame`/`render` signature is reshaped (additive seam). *(AR-121)*
- **AC-13** (packaging) — `picture` + `MultiCheckGroup` live under `packages/ui/src/controls/` with
  explicit named re-exports; the caret seam edits are additive; `yarn check:deps` passes (zero runtime
  deps); files ≤ 500 lines. *(AR-123)*
- **AC-14** (stories + demo) — a `MultiCheckGroup` kitchen-sink story passes the headless smoke test; the
  `Input` story + `demo:controls` walkthrough demonstrate selection/copy/paste, a `picture` field, and
  the visible caret. *(AR-124)*
- **AC-15** (security) — pasted text is size-bounded + validator/`maxLength`-filtered + `sanitize`-drawn;
  `setClipboard()` base64-encodes/sanitizes (no raw-escape injection); `picture` bounds its recursion and
  indexing (no hang/overflow on a hostile mask). *(Security Considerations)*

---

> **Next step:** run the make_plan skill on RD-07 to produce the implementation plan (spec-first per
> capability: spec oracles RED → implement → GREEN → impl tests), **reading each TV source first** per the
> fidelity directive (`TInputLine` selection/clipboard/`setCursor`, `TPXPictureValidator`,
> `TMultiCheckBoxes`/`drawMultiBox` — GATE-1 decode of the draw/semantics/`getColor` chain in the
> `03-NN-*.md` specs + the BEFORE/AFTER gate tasks in `99-execution-plan.md`); optionally preflight, then
> exec_plan.
