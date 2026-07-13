# RD-11: Containers, Scrolling & Lists — ScrollBar · Scroller · ListView · ListBox · Dialog

> **Document**: RD-11-containers-scrolling-lists.md
> **Status**: Draft
> **Created**: 2026-06-30 (stub) · **Authored**: 2026-07-01 (`add_requirement`, RD-06 settled)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-06 (Essential controls — done; `Dialog` hosts `Button`/`Input`/`Cluster`, and the `valid()` gate sweeps their validators), RD-05 (App shell — done; `Window`/`Frame`, `Desktop`, `execView`/`endModal` modality, the overlay + capture seams), RD-04/RD-03/RD-02/RD-01 (done), `@jsvision/core` (done; the additive ScrollBar/ListViewer theme roles land here)
> **Split from**: RD-06 (AR-93) — the focused-core split spun these container/scrolling/list controls + the rich `Dialog` out so RD-06 stayed small and demoable in a plain `Window`.
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The **container, scrolling, and list** tier of `@jsvision/ui` — the widgets that present *more content
than fits* and the rich **`Dialog`** that hosts a form of RD-06 controls. These are the Tier-1
components the AR-93 split reserved out of RD-06 because the `Dialog` depends on RD-06's leaf controls
existing (and their `valid()` shapes) — now settled (RD-06 ✅ Done). Each is reimagined from its Borland
Turbo Vision counterpart per the **NON-NEGOTIABLE TV-fidelity directive** (`magiblot/tvision`
`source/tvision/t*.cpp`, palette map `dialogs.h`), on the RD-03 view/group spine, RD-04 event loop, and
RD-05 app shell.

The components in scope:

| Component | TV source | Role |
|-----------|-----------|------|
| `ScrollBar` | `TScrollBar` (`tscrlbar.cpp`, `views.h`) | A terminal-intrinsic vertical/horizontal bar: thumb + page area + control arrows; a two-way position signal. |
| `Scroller` | `TScroller` (`tscrolle.cpp`, `views.h`) | A scrollable viewport `Group` clipping oversized content; **auto-creates & owns** its ScrollBar(s) and tracks the scroll delta. |
| `ListView` | `TListViewer` (`views.h`) | A single-column **virtual-scroll** list: renders only visible rows via `getText(item)`, bound to an items signal + a focused-index signal; optional **sorted + type-ahead** (TV `TSortedListBox`). |
| `ListBox` | `TListBox` (`tlistbox.cpp`) | The convenience `ListView<string>` preset bound to a `Signal<string[]>`. |
| `Dialog` | `TDialog` (`tdialog.cpp`, `dialogs.h`) | A `Window`-derived **modal or modeless** container + standard-button helpers; the `execView` (RD-04) target; hosts RD-06 controls; a terminating-command result with a child `valid()` close-gate. |

**Behavior may extend TV** (reactive two-way binding, generic `ListView<T>`, async `execView`) but the
**drawing/geometry must match TV exactly** (glyphs, thumb math, column layout, frame, hit-zones).

---

## Functional Requirements

### Must Have

#### `ScrollBar` — terminal scroll bar (TV `TScrollBar`, AR-111/AR-112)
- A `View` drawn as a track of the TV scrollbar glyphs — control arrows at each end, a `▓` thumb over a
  `░` page area (exact glyphs/chars decoded from `TScrollBar::draw`/`drawPos` at plan GATE-1), in both
  **vertical and horizontal** orientation. Themed via the additive `scrollBarPage`/`scrollBarControls`
  core roles (`cpScrollBar` slots 4–5, AR-112).
- **Binding (AR-111):** a two-way `value: Signal<number>` for the thumb position within a
  `{ min, max, pageStep, arrowStep }` config (TV `value`/`minVal`/`maxVal`/`pgStep`/`arStep`). Clicking
  an arrow steps by `arrowStep`; clicking the page area pages by `pageStep`; dragging the thumb sets the
  value proportionally (reuses the RD-05 pointer-capture seam, AR-82). Every change writes the signal.

#### `Scroller` — scrollable viewport (TV `TScroller`, AR-105)
- A `Group` that clips an oversized content view to its own bounds and offsets it by a scroll delta
  `{ x, y }` (TV `TScroller::scrollDraw`/`scrollTo`). Content larger than the viewport is revealed by
  scrolling; the delta is clamped to the content extent.
- **Scrollbar ownership (AR-105):** the `Scroller` **auto-creates and owns** its scrollbar(s) — a
  `scrollbars: 'vertical' | 'horizontal' | 'both' | 'none'` option (default `'vertical'`) — wiring each
  bar's `value` signal ↔ the scroll delta bidirectionally, and sizing each bar's `max` to the content
  extent. An escape hatch may inject/hide a bar, but the common path needs no manual wiring. (Drawing
  stays TV-exact; the fidelity directive governs pixels, not the construction API.)
- Keyboard: ↑↓/←→/PgUp/PgDn/Home/End scroll the focused viewport (TV `TScroller::handleEvent` deltas).

#### `ListView` / `ListBox` — virtual-scroll list (TV `TListViewer`/`TListBox`/`TSortedListBox`, AR-104/AR-106)
- A focusable **single-column** list that renders **only the visible rows** (virtual scroll — TV
  `TListViewer::draw` iterates `focused`-relative visible indices via `getText(i)`), bound to:
  `items: Signal<T[]>`, a `getText(item: T) => string` renderer, and a `focused: Signal<number>`
  (the highlighted row). An optional `selected` signal marks a chosen row. Themed via the additive
  ListViewer roles (slots 26–29, AR-112): normal/focused/selected/divider.
- Pairs with a `ScrollBar` (owned like `Scroller`, AR-105) that reflects `focused`/extent; the list
  scrolls to keep the focused row visible. ↑↓/PgUp/PgDn/Home/End move focus; Enter/double-click emits a
  selection command; a row click focuses+selects (TV `TListViewer` mouse + key handling).
- **Sorted + type-ahead (AR-104):** optional `sorted?: boolean` (ordered display) and `typeAhead?:
  boolean` (incremental prefix search jumps focus to the first matching row — TV `TSortedListBox`
  keyboard search). Off by default; an *option on `ListView`, not a subclass* (component map §116).
- **`ListBox` (AR-106):** the `ListView<string>` preset bound to a `Signal<string[]>` with the identity
  `getText` — the common case, zero generics at the call site.
- **Multi-column is out of scope** (AR-104): TV `TListViewer` supports `numCols`; the multi-column grid
  is the RD-07 `Table`/`DataGrid`. RD-11 is single-column only.

#### `Dialog` — rich container (TV `TDialog`, AR-107/AR-108/AR-109)
- A `Window`-derived container (RD-05 `Window` chrome — frame, title, close/zoom) that **hosts a form of
  RD-06 controls** laid out absolutely/flowed inside it. Themed via the existing `dialog` role +
  `cpGrayDialog` (RD-06 control roles already landed).
- **Modality (AR-107):** supports **both** — **modal** via RD-04 `execView`/`endModal` (the primary
  path; blocks until a terminating command closes it) and **modeless** via `desktop.add` (an ordinary
  window). `Dialog` is-a `Window`, so modeless is intrinsic.
- **Result + `valid()` close-gate (AR-108, realizes DEF-16):** `execView(dialog)` resolves to the
  **terminating command** (e.g. `Commands.ok`/`Commands.cancel`); form data already lives in the
  controls' bound signals (AR-100), so there is **no separate result object**. A **positive** close
  (OK/Yes) first runs a **child `valid()` sweep** (TV `TDialog::valid` → `TGroup::valid`): if any
  blocking-invalid field vetoes, the close is cancelled and focus moves to the offending control; a
  **negative** close (Cancel/Esc) skips the sweep and always closes. (TV `cmCancel`/`cmClose` bypass
  `valid`.)
- **Standard-button helpers (AR-109):** builder helpers for the TV standard buttons —
  `okButton()`/`cancelButton()`/`yesButton()`/`noButton()` (+ a `yesNoButtons()` / `okCancelButtons()`
  convenience) — each an RD-06 `Button` preset emitting the matching terminating command
  (`Commands.ok`/`cancel`/`yes`/`no`). The `ok`/`cancel`/`yes`/`no` command constants are added to the
  RD-05 `Commands` set (additive).

#### Theme roles — faithful `cpScrollBar` + ListViewer colors (AR-112)
- Add the additive `cpGrayDialog` roles these components use to core `@jsvision/core` `Theme` +
  `defaultTheme`, decoded from TV's palette (`dialogs.h` `cpGrayDialog` slots → `cpAppColor`):
  **ScrollBar** `scrollBarPage`/`scrollBarControls` (`cpScrollBar` slots 4–5), and **ListViewer**
  `listNormal`/`listFocused`/`listSelected`/`listDivider` (slots 26–29). Additive, non-breaking — the
  same cross-package pattern as `windowInactive`/`statusSelected` and the RD-06 control roles (AR-97).
  (History 22–25 remain reserved → RD-07.)

#### Kitchen-sink Navigator upgrade + stories (AR-110, AR-114)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** dogfooding rule, rebuild the showcase navigator
  from a **menu** into a persistent **`ListView`-in-a-`Scroller` sidebar** — the showcase demoing the
  very component it is built from. Only `packages/examples/kitchen-sink/shell.ts` changes (the Navigator
  seam); stories stay untouched (their smoke test still passes).
- Add a **story** for each new visual component (`ScrollBar`, `Scroller`, `ListView`/`ListBox`, `Dialog`)
  + a headless `demo:containers` walkthrough (dispatch-driven, an ASCII frame per step, matching
  `demo:controls`): a scrollable list navigated by keyboard, a `Scroller` revealing oversized content,
  and a modal `Dialog` with an invalid field vetoing OK then passing.

### Should Have

- `Dialog.valid()` reporting *which* field failed (for a status hint) if it falls out of the sweep cheaply.
- A `ScrollBar` auto-hide when `max ≤ pageStep` (content fits) — TV shows a full-thumb bar; match TV, but
  an ergonomic hide is a nice-to-have if it does not diverge visually.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- **Multi-column** list / `Table`/`DataGrid` → RD-07 (AR-104). `ComboBox` (Input + ListView dropdown),
  `History`, `Tree`, `Tabs` → RD-07.
- File-bound dialogs (`FileDialog`/`DirList`/`ChDir`) → RD-09 (`@jsvision/files`).
- `ColorDialog` family, Help viewer → optional Tier-3 (component map).

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target RD | Rationale |
|---------------|---------------|-----------|-----------|
| Multi-column `ListViewer` (`numCols`) | AR-104 | **RD-07** (`Table`/`DataGrid`) | A real table is the high-value multi-column surface; RD-11 stays single-column + focused. |
| `ComboBox` (`Input` + `ListView` dropdown) | component map §118 | **RD-07** | Composes RD-06 `Input` + RD-11 `ListView`; belongs with the high-value controls. |

> DEF-16 (**Input modal focus-trap on invalid**) is **realized by this RD** (the `Dialog` `valid()`
> close-gate, AR-108) — it moves from Deferred to Done when RD-11 ships.

---

## Technical Requirements

### New subsystems (AR-113)
- Three new subsystem dirs under `packages/ui/src/`, one per concern (the established RD-05 pattern of a
  dir per concern): `scroll/` (`scroll-bar.ts`, `scroller.ts`), `list/` (`list-view.ts`, `list-box.ts`,
  shared `virtual.ts` for the visible-window math), `dialog/` (`dialog.ts`, `buttons.ts` standard-button
  helpers). One barrel `index.ts` each; per-file ≤ 500 lines. **Explicit named re-exports** from
  `src/index.ts` (the layout-convention rule, AR-81/AR-102).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package edits (additive only, AR-112)
- `@jsvision/core` `Theme` + `defaultTheme` gain the additive `scrollBarPage`/`scrollBarControls` +
  `listNormal`/`listFocused`/`listSelected`/`listDivider` roles (decoded from `cpAppColor`; exact
  attribute bytes pinned at implementation per the fidelity directive). Same additive pattern as AR-97.
- The RD-05 `Commands` set gains `ok`/`cancel`/`yes`/`no` terminating-command constants (AR-109) — the
  standard-button vocabulary. Additive; no existing command changes.

### Reuse (no new engine primitives)
- **Pointer capture (AR-82):** ScrollBar thumb-drag + Scroller reuse the RD-05 `setCapture`/
  `releaseCapture` loop seam — no new capture mechanism.
- **Modality (RD-04):** `Dialog` reuses `execView`/`endModal` + the save/restore-around-modal stack; no
  new modal machinery. Modeless reuses `desktop.add` (RD-05).
- **Validators (RD-06):** the `Dialog` `valid()` sweep calls each hosted control's existing `valid()`
  (RD-06 exposed it, PF-009) — no validator changes.
- **Reactivity/layout/draw:** RD-01 signals + RD-03 `bind`/`invalidate`, RD-02 reflow, RD-03
  `DrawContext` (all writes via `ScreenBuffer` + `sanitize`).

---

## Integration Points

- **App shell (RD-05):** `Dialog` extends `Window` and is raised/focused/z-ordered by the same
  `Desktop`; `execView` is the RD-04 mechanism the menu/status already drive. The overlay/capture seams
  are reused, not extended.
- **Essential controls (RD-06):** `Dialog` hosts `Button`/`Input`/`Cluster`; the standard-button helpers
  are `Button` presets; the `valid()` gate sweeps the hosted validators — RD-06 is the direct upstream.
- **Core theme (core):** the additive ScrollBar/ListViewer roles extend the same `Theme` the frame/
  menu/status/controls read; `defaultTheme` stays the single source of truth.
- **Kitchen-sink (examples):** the Navigator seam (`shell.ts`) swaps its menu for a `ListView` sidebar;
  the new components each get a story; `demo:containers` is the headless walkthrough.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-104** — `ListView` single-column base now; multi-column/`Table` → RD-07; sorted + type-ahead ship as options.
- **AR-105** — `Scroller` auto-creates & owns its ScrollBar(s) (inject/hide escape hatch).
- **AR-106** — generic `ListView<T>` base (`getText` + items/focused signals) + `ListBox` string preset.
- **AR-107** — `Dialog` supports both modal (`execView`) and modeless (`desktop.add`).
- **AR-108** — result = terminating command + bound signals; positive close runs a child `valid()` sweep (realizes DEF-16).
- **AR-109** — standard-button helpers `ok`/`cancel`/`yes`/`no` (+ `Commands` constants).
- **AR-110** — the kitchen-sink Navigator sidebar upgrade is an RD-11 AC (dogfooding).
- **AR-111** — `ScrollBar` two-way `value` signal + `{min,max,pageStep,arrowStep}`; vertical + horizontal.
- **AR-112** — additive `cpScrollBar` (4–5) + ListViewer (26–29) core theme roles.
- **AR-113** — `src/{scroll,list,dialog}/` subsystems, explicit named re-exports.
- **AR-114** — headless `demo:containers` + per-component kitchen-sink stories.

> **Traceability:** AR-103…AR-110 are explicit user choices (RD-11 `add_requirement` interview,
> 2026-07-01); AR-111…AR-114 are single-dominant decisions (two-way-signal model AR-100, the AR-97
> additive-role pattern, the AR-102 subsystem convention, the AR-98 demo pattern) recorded for
> traceability.

---

## Security Considerations

> RD-11 adds **container/scroll/list** widgets + a `Dialog` in the existing in-process TUI. No network,
> no persistence, no new untrusted external surface. The input boundaries are keystroke/mouse → view
> state and list text → screen:
- All draws (thumb, rows, frame) route through the RD-03 `DrawContext` → `ScreenBuffer` + core
  `sanitize` boundary; list `getText` output is sanitized like any other cell text (no raw escapes from
  item strings reach the terminal).
- Scroll deltas and `ScrollBar` values are **clamped** to `[min, max]` / the content extent — no
  out-of-range indexing into `items` (virtual-scroll row access is bounds-checked).
- The `Dialog` `valid()` gate is an allowlist-style completion check (blocking validators must pass
  before a positive close), consistent with the coding standard's input-constraint requirement.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode (TV `tscrlbar.cpp`/`tscrolle.cpp`/`views.h`/
`tlistbox.cpp`/`tdialog.cpp` + `dialogs.h` is the drawing oracle).

- **AC-1** (`ScrollBar` draw + step) — a vertical `ScrollBar` draws control arrows + a `▓` thumb over the
  `░` page area at the TV positions; clicking an arrow changes `value` by `arrowStep`, the page area by
  `pageStep`, each clamped to `[min,max]`; the bound `value` signal reflects every change; a horizontal
  bar mirrors this. Themed `scrollBarPage`/`scrollBarControls`. *(AR-111/AR-112)*
- **AC-2** (`Scroller` clip + reveal) — a `Scroller` with content larger than its viewport clips to its
  bounds; scrolling down by ↓/PgDn/thumb reveals lower content and clamps at the extent; the owned
  ScrollBar's `value` tracks the delta (and dragging it scrolls the content). *(AR-105)*
- **AC-3** (`Scroller` owns bars) — a `Scroller({ scrollbars:'vertical' })` auto-creates + wires its bar
  with no manual construction; `'none'` shows none; `'both'` shows H+V. *(AR-105)*
- **AC-4** (`ListView` virtual scroll) — a `ListView` over 1000 items renders only the visible rows via
  `getText` (not all 1000); ↑↓ move `focused`, PgDn pages, the focused row stays visible, the owned
  ScrollBar reflects position; the focused row uses `listFocused`. *(AR-104/AR-106/AR-112)*
- **AC-5** (`ListView` select + emit) — Enter/double-click on a row emits the selection command and sets
  the `selected` signal; a row click focuses+selects it (`listSelected`). *(AR-104)*
- **AC-6** (sorted + type-ahead) — a `ListView({ sorted:true, typeAhead:true })` displays items ordered;
  typing a prefix jumps `focused` to the first matching row; both are off by default. *(AR-104)*
- **AC-7** (`ListBox` preset) — a `ListBox` bound to a `Signal<string[]>` lists the strings with identity
  `getText`; updating the signal re-renders the visible rows. *(AR-106)*
- **AC-8** (`Dialog` modal result) — `await execView(dialog)` blocks until a terminating command closes
  it and resolves to that command (`Commands.ok`/`cancel`); the form's bound signals hold the entered
  data (no separate result object). *(AR-107/AR-108)*
- **AC-9** (`Dialog` `valid()` gate = DEF-16) — with an `Input` carrying a `range(0,100)` validator set to
  `150`, pressing OK does **not** close the dialog and focus moves to that `Input`; correcting to `50`
  then OK closes with `Commands.ok`; Cancel/Esc closes regardless of validity. *(AR-108, realizes DEF-16)*
- **AC-10** (`Dialog` modeless) — a `Dialog` added via `desktop.add` behaves as an ordinary window
  (raise/move/focus) and is not blocking. *(AR-107)*
- **AC-11** (standard buttons) — `okButton()`/`cancelButton()`/`yesButton()`/`noButton()` render the TV
  button faces and emit `Commands.ok`/`cancel`/`yes`/`no`; the constants exist on the `Commands` set. *(AR-109)*
- **AC-12** (theme roles) — `defaultTheme` exposes `scrollBarPage`/`scrollBarControls` +
  `listNormal`/`listFocused`/`listSelected`/`listDivider` with `cpGrayDialog`-decoded colors; `encode()`
  of each does not throw; they are the only new core role symbols. *(AR-112)*
- **AC-13** (faithful geometry) — each component's glyphs, thumb math, row layout, frame, and hit-zones
  match its TV source (asserted against the buffer pre-`serialize`). *(fidelity directive)*
- **AC-14** (packaging) — components live in `packages/ui/src/{scroll,list,dialog}/` with explicit named
  re-exports; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-113)*
- **AC-15** (Navigator + stories) — the kitchen-sink navigator is a `ListView`-in-`Scroller` sidebar
  (only `shell.ts` changed); `ScrollBar`/`Scroller`/`ListView`/`Dialog` each have a story passing the
  headless smoke test; `demo:containers` runs headless with an ASCII frame per step. *(AR-110/AR-114)*

---

> **Next step:** run the make_plan skill on RD-11 to produce the implementation plan (spec-first per
> component: spec oracles RED → implement → GREEN → impl tests), **reading each component's TV source
> first** per the fidelity directive (`TScrollBar`/`TScroller`/`TListViewer`/`TListBox`/`TDialog` — GATE
> 1 decode of draw/geometry/`getColor` chain in the `03-NN-*.md` spec + the BEFORE/AFTER gate tasks in
> `99-execution-plan.md`); optionally preflight, then exec_plan.
