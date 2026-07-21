# RD-14: Input Dropdowns — History · ComboBox

> **Document**: RD-14-input-dropdowns.md
> **Status**: Preflighted 🔎 (2026-07-02 — [`00-preflight-report-RD-14.md`](00-preflight-report-RD-14.md): 3 MAJOR + 3 MINOR + 2 OBS, all resolved; AR-162…AR-166)
> **Created**: 2026-07-02 (`make_requirements` — RD-12+ high-value-controls set, sibling 1 of 6)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-11 (Containers/lists — done; `ListView<T>` is the dropdown list, the overlay+capture seams), RD-06/RD-07 (Essential controls + completions — done; `Input` value/`maxLength`/`selectAll`, validators), RD-05 (App shell — done; the full-viewport overlay + `menu/controller.ts` outside-click catcher this generalizes, `execView`/`endModal`), RD-04/RD-03/RD-02/RD-01 (done), `@jsvision/core` (done; the additive History theme roles land here)
> **Set**: RD-12+ high-value controls (AR-125…AR-129) — the bucket sliced by mechanism into 6 sibling RDs; this is **RD-14 (Input dropdowns)**, an MVP-phase RD (AR-129).
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The **input-dropdown** tier of `@jsvision/ui` — the two controls that pair a text field with a
drop-down list: **`History`** (a dropdown of previously-entered values for an `Input`) and
**`ComboBox`** (an `Input` + selectable list, editable or select-only). Both share one **anchored-popup**
mechanism generalized from the RD-05 menu overlay.

`History` is reimagined from its Borland Turbo Vision counterpart per the **NON-NEGOTIABLE TV-fidelity
directive** (`magiblot/tvision` `source/tvision/thistory.cpp`/`thistwin.cpp`/`thstview.cpp`/`histlist.cpp`,
icon table `tvtext1.cpp`, palette map `dialogs.h`). `ComboBox` has **no TV counterpart** (the fork lacks
it — component map §118); it is designed as `Input` + `ListView`, and its **drawing follows the faithful
`TListBox`/History popup visuals** (the directive governs pixels; a control TV never had may extend TV in
behavior but must draw like its siblings).

The components in scope:

| Component | TV source | Role |
|-----------|-----------|------|
| `History` | `THistory` (`thistory.cpp`) + `THistoryWindow` (`thistwin.cpp`) + `THistoryViewer` (`thstview.cpp`) + the store `histlist.cpp` | A small `▐↓▌` button linked to an `Input`; opens a dropdown of that field's past values (a global bounded MRU store keyed by `historyId`); picking one replaces the field text. |
| `ComboBox<T>` | **new** (TV lacks it; component map §118) | An `Input` + drop-down `ListView<T>`, **editable** (free text + filter-as-you-type) or **select-only** (pure picker + type-ahead jump); a two-way bound `value: Signal<T \| null>` (the selection) + the field's own `text: Signal<string>` in editable mode (AR-164/PF-003). |
| *(internal)* anchored-popup primitive | generalized from `THistoryWindow` + RD-05 `menu/controller.ts` | The shared non-modal overlay that anchors a `ListView` below a field, clamps placement, and dismisses on outside-click/Esc/focus-loss. |

**Behavior may extend TV** (reactive two-way binding, generic `ComboBox<T>`, filter-as-you-type,
non-modal popup, Alt+Down) but the **drawing/geometry must match TV exactly** (the `▐↓▌` icon, the popup
rect, the list rows, hit-zones, and every resolved color).

---

## Functional Requirements

### Must Have

> **Input linkage seam (AR-162/PF-003).** TV's `THistory` reaches its linked `TInputLine`'s **public**
> `data`/`maxLen`/`selectAll` members (`thistory.cpp:106-107`). Our `Input` keeps these `protected`
> (`controls/input.ts:56/111/433`), so `History` requires a **minimal additive PUBLIC Input linkage seam**
> — a public `selectAll()` + a public accessor for the bound `value` signal + a `maxLength` read — added
> intra-`@jsvision/ui` (listed in the additive surface below; non-breaking). This corrects the earlier
> "no Input changes" framing: linking a field faithfully **does** need this small public seam.

#### `History` — dropdown of past field values (TV `THistory`, AR-130/AR-135/AR-138/AR-139)
- A `View` **linked to an `Input`** and drawn as the TV history button — icon `"\xDE~\x19~\xDD"` =
  `▐↓▌` (a color-marked `↓` between two half-blocks, `tvtext1.cpp:86`), `getColor(0x0102)`, palette
  `cpHistory` — placed adjacent to the field (`thistory.cpp` `THistory::draw`). Themed via the additive
  `cpHistory` core role (AR-139), decoded at plan GATE-1.
- **Open (AR-135):** on **click of the button**, **Down-arrow while the linked `Input` is focused**
  (`thistory.cpp handleEvent` `ctrlToArrow(...)==kbDown && link focused`), **or Alt+Down** (the modern
  chord — the extra-behavior the directive permits). On open it records the field's current text into the
  store, then pops the anchored popup.
- **Popup geometry (AR-138, `thistory.cpp`):** the popup rect = the linked field's bounds grown **±1 in x**
  and extended **7 rows down** (`r.b.y += 7`), clamped (`intersect`) to the host extent, hosting a
  `ListView` of the field's history entries with the TV `wfClose`/no-zoom framing (`THistoryWindow`,
  `wnNoNumber`). Overflowing entries scroll (owned ScrollBar, RD-11); `maxRows` is configurable (default 7).
- **Pick / cancel (AR-138):** **Enter or double-click** a row → the pick **replaces the `Input` text**
  (clamped to `maxLength`) and **`selectAll`s** it — both via the AR-162 public Input linkage seam
  (`thistory.cpp` cmOK path → `link->selectAll(True)`); **Esc or an outside-click** → cancel, leaving the
  field unchanged (`THistoryWindow` outside mouse-down → `endModal(cmCancel)`; `THistoryViewer` Esc →
  cmCancel). **Dismissal is dismiss-only** (AR-166/PF-005): an outside mouse-down closes the popup and is
  **consumed** (it does not pass through to the control behind it, matching the reused menu catcher).

#### History store — global bounded MRU keyed by `historyId` (TV `histlist.cpp`, AR-130)
- A **bounded module-singleton** string store keyed by a numeric `historyId`, faithful to
  `histlist.cpp`: `historyAdd(id, str)` **skips empty**, **dedups** (removes an existing equal entry),
  appends as most-recent, and **evicts the oldest** entry for that id when the bounded block is full;
  `historyStr(id, index)` / `historyCount(id)` read the per-id list. Two `History` controls sharing an id
  **share the same list** (TV behavior).
- **Escape hatch (AR-130):** a `History` may instead bind an injectable `history: Signal<string[]>` (the
  app owns the list) — the AR-105 auto-own-with-override pattern; the global store is the zero-config default.

#### `ComboBox<T>` — input + drop-down list (new; AR-131/AR-134/AR-136)
- A control composing an `Input` (RD-06/07) with a drop-down `ListView<T>` (RD-11) in the shared anchored
  popup. **Binding (AR-136/AR-164):** generic over `T` — `items: Signal<T[]>` + `getText: (item: T) =>
  string` + **two distinct signals** (PF-003): `value: Signal<T | null>` (the current **selection**;
  `null` while editable free text matches no item) **plus** the composed `Input`'s own `text:
  Signal<string>` (the field text). Mirrors `ListView<T>` (AR-106) + the AR-100 two-way-signal model.
  Opens on the AR-135 keys (Alt+Down / Down / a trailing `▐↓▌` button) into the same popup geometry as
  `History`.
- **Mode (AR-131) — `editable?: boolean` (default `true`):**
  - **editable** — the `Input` accepts free text into `text`; the dropdown offers suggestions;
    **filter-as-you-type (AR-134)** narrows the dropdown to items matching `text` via an overridable
    predicate (default case-insensitive substring), the modern autocomplete DX. Picking a row sets `value`
    to the item **and** `text` to `getText(item)`; free text matching nothing leaves `value` `null`.
  - **select-only** (`editable:false`) — the field is a read-only picker showing `getText(value)`; typing
    does **not** edit `text` but drives **type-ahead position-jump** (TV `TListViewer`/`TSortedListBox`
    `typeAhead`, AR-104) to the first matching row; picking sets `value`.
- Pick / cancel mirror `History` (Enter/double-click picks; Esc / outside-click / **the popup list losing
  focus** cancels — see the popup primitive's dismissal below).

#### Shared anchored-popup primitive (AR-132/AR-137)
- An **internal** primitive (DRY — one implementation, not one per control) generalized from the RD-05
  menu overlay + outside-click catcher (`menu/controller.ts`) and TV `THistoryWindow`: given an **anchor
  rect** and a `ListView`, it mounts the list **top-z in the app overlay**, gives the list focus, computes
  the clamped placement (grow ±1, default 7-row popup, `intersect` the host extent — AR-138), and routes
  **Enter/double-click → pick, Esc / outside-click / list-focus-loss → dismiss**.
- **Dismissal is concrete (AR-166/PF-005, PF-006):** the popup list **receives focus on open**; it
  dismisses on (a) **Esc**, (b) an **outside mouse-down** — closed **and consumed** (dismiss-only, no
  pass-through to the control behind, matching the reused menu catcher), or (c) the **list losing focus**
  (e.g. Tab-away), observed via the PF-009 per-view focus-change signal. **Non-modal** (AR-132): unlike
  TV's `execView` modal, the rest of the UI keeps updating and (after a dismissing click) is interactable
  — a construction detail the AR-105 precedent lets us modernize while the drawing stays faithful.
- It requires an **overlay host**: the RD-05 app-shell overlay (`application.ts:139-142`) is the default
  host, reached via the same additive attach-seam pattern the `MenuBar` controller uses
  (`menu/controller.ts` → `menuBar.attach(overlay, …)`, `application.ts:177`).
- **Shared-overlay visibility (AR-163/PF-002).** The app overlay is a **single** `Group` with **one**
  `state.visible` flag, today toggled by the menu controller (`controller.ts:229/247`). Two independent
  clients (the `MenuBar` + a dropdown popup) driving that one flag would stomp each other — a menu
  `close()` would hide an open dropdown, and vice versa. RD-14 therefore adds a **small additive app-shell
  seam making overlay visibility DERIVED** — the overlay is visible while it hosts **any** mounted popup
  child (ref-counted / any-child), so menu and dropdown coexist without stomping. This seam is listed in
  the additive surface. (Providing the popup an overlay host inside a bare RD-11 `Dialog` — no app shell —
  remains a plan-level seam detail.)

#### Theme roles — faithful History colors (AR-139)
- Add the additive History `cpGrayDialog`/`cpBlueWindow` roles to core `@jsvision/core` `Theme` +
  `defaultTheme`, decoded through the full `getColor` chain at **plan GATE-1**: the **button** (`cpHistory`,
  `thistory.cpp getColor(0x0102)`), the **popup window** (`cpHistoryWindow`, `thistwin.cpp`), and the
  **viewer list** (`cpHistoryViewer`, `thstview.cpp`) — with the exact attribute bytes decoded at plan
  GATE-1 (no palette slots are pre-reserved in core today; PF-004). Additive, non-breaking — the same
  cross-package pattern as the RD-06/07/11 control roles (AR-97/112/122). `ComboBox` reuses the existing
  `input*`/`list*` roles + the button role.

#### Kitchen-sink stories + headless demo (AR-140)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **story** for `History` (an `Input` + the
  `▐↓▌` button, live MRU) and for `ComboBox` (both modes, a visible bound-value echo) — each passing the
  headless smoke test — plus a headless **`demo:dropdowns`** walkthrough (dispatch-driven, an ASCII frame
  per step, matching `demo:controls`/`demo:containers`): open → filter/type-ahead → pick, and an
  Esc-cancel leaving the field unchanged.

### Should Have

- A `History` **auto-hide** of the button when the store for its id is empty (nothing to drop down) — an
  ergonomic nicety that must not diverge from the TV button visual when shown.
- `ComboBox` **`onSelect`/`command`** emission on pick (reusing the RD-11 `ListView` `onSelect`/`command`
  seam) so a combobox pick can drive an app command, not only the bound signal.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `Tree` (RD-15), `Table`/`DataGrid` (RD-16), `Tabs` (RD-17), `ProgressBar`/`Spinner` (RD-18),
  `Surface` (RD-19) — the other RD-12+ siblings (AR-126).
- **Multi-select** ComboBox / tag input — TV has no counterpart; not in the MVP dropdown surface.
- **Persisting** the History store across process runs (TV's is in-memory only) — no filesystem here.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Multi-select / tag ComboBox | AR-131 | later (post-set) | Single-select covers the modern combobox MVP; multi-select is a separate mechanism. |
| History store persistence | AR-130 | `@jsvision/files` (RD-09) or app | TV's store is in-memory; persistence is an app/fs concern, not a widget one. |

---

## Technical Requirements

### New subsystem (AR-133)
- One new subsystem dir `packages/ui/src/dropdown/` (the established dir-per-concern pattern, sibling to
  `menu/`): `history.ts` (`History` + the store), `combo-box.ts` (`ComboBox<T>`), `popup.ts` (the shared
  anchored-popup primitive), one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named re-exports**
  from `src/index.ts` (the layout-convention rule, AR-81/AR-102/AR-113).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Additive surface (all non-breaking)
- **Core (AR-139):** `@jsvision/core` `Theme` + `defaultTheme` gain the additive History roles
  (button/window/viewer), decoded from `cpAppColor` at plan GATE-1 (exact attribute bytes pinned per the
  fidelity directive). Same additive pattern as AR-97/112/122; no existing role changes.
- **Intra-`@jsvision/ui` — public Input linkage seam (AR-162/PF-001):** a minimal **public** surface on
  `controls/Input` — `selectAll()` promoted to public + a public accessor for the bound `value` signal +
  a `maxLength` read — so `History` can faithfully replace-text-and-`selectAll` a linked field
  (`thistory.cpp:106-107`). Additive; existing callers unaffected.
- **Intra-`@jsvision/ui` — derived overlay-visibility seam (AR-163/PF-002):** a small app-shell change so
  the shared overlay's `visible` is **derived from having any mounted popup child** (ref-counted), letting
  the `MenuBar` and a dropdown popup share the overlay without stomping the single `state.visible` flag.

### Reuse (no new engine primitives)
- **Dropdown list (RD-11):** the popup hosts a `ListView<T>` (`list/list-view.ts`) — its virtual scroll,
  owned ScrollBar, `sorted`/`typeAhead`, and `onSelect`/`command` are reused, not reimplemented.
- **Overlay + dismissal (RD-05):** the anchored popup generalizes the `menu/controller.ts` overlay +
  outside-click catcher + the `attach(overlay, …)` seam — no new overlay mechanism.
- **Input (RD-06/07):** `ComboBox` **composes** an `Input` (owning its `text`/`value` signals);
  `History` **links** an app-created `Input` via the additive public linkage seam (AR-162/PF-001) — its
  `value` signal, `selectAll()`, and `maxLength` read. No other `Input` behavior changes.
- **Reactivity/layout/draw:** RD-01 signals + RD-03 `bind`/`invalidate`, RD-02 reflow, RD-03
  `DrawContext` (all writes via `ScreenBuffer` + `sanitize`).

---

## Integration Points

- **Containers (RD-11):** the dropdown list *is* a `ListView<T>`; filter/type-ahead reuse its options; the
  popup reuses the overlay + capture seams. RD-11 is the direct upstream.
- **App shell (RD-05):** the popup mounts in the app overlay via the same attach-seam the `MenuBar` uses;
  dismissal mirrors the menu's outside-click catcher.
- **Essential controls (RD-06/07):** `History` links an existing `Input`; `ComboBox` composes one — the
  field editing, validators, caret, and selection are RD-06/07's, unchanged.
- **Core theme (core):** the additive History roles extend the same `Theme` the frame/menu/status/controls
  read; `defaultTheme` stays the single source of truth.
- **Kitchen-sink (examples):** `History` + `ComboBox` each get a story; `demo:dropdowns` is the headless
  walkthrough.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-130** — `History` uses a faithful global by-`historyId` MRU store (dedup + evict-oldest, bounded) + an optional injectable `history` signal escape hatch.
- **AR-131** — `ComboBox` supports both modes via `editable?: boolean` (default editable).
- **AR-132** — the dropdown popup is a **non-modal** anchored overlay (generalizing the RD-05 menu popup), not TV's `execView` modal; drawing stays TV-faithful.
- **AR-133** — new `src/dropdown/` subsystem, explicit named re-exports.
- **AR-134** — editable `ComboBox` filters-as-you-type (default on, overridable predicate); select-only uses type-ahead position-jump.
- **AR-135** — open keys = faithful (Down-while-focused / `▐↓▌` click) + Alt+Down.
- **AR-136** — generic `ComboBox<T>` (`items` + `getText` + two-way `value`), the AR-106 model; `History` is string-only.
- **AR-137** — one shared internal anchored-popup primitive (DRY) for both controls.
- **AR-138** — faithful popup geometry (grow ±1, 7-row default, clamp, scroll) + TV pick behavior (History replaces + `selectAll`; ComboBox sets `value`).
- **AR-139** — additive faithful History theme roles, decoded at plan GATE-1.
- **AR-140** — kitchen-sink stories (`History`, `ComboBox`) + headless `demo:dropdowns`.
- **AR-162** (preflight PF-001) — `History` links an `Input` via a **minimal additive public Input linkage seam** (`selectAll()` + a `value`-signal accessor + `maxLength` read); corrects the earlier "no Input changes" framing.
- **AR-163** (preflight PF-002) — the shared app overlay's visibility becomes **derived** (visible while it hosts any popup child) via a small additive app-shell seam, so `MenuBar` + dropdown share one overlay without stomping `state.visible`.
- **AR-164** (preflight PF-003) — `ComboBox<T>` binds **two signals**: `value: Signal<T | null>` (selection) + the composed `Input`'s `text: Signal<string>` (field text); resolves the T-vs-string conflation.
- **AR-165** (preflight PF-004) — no History palette slots are pre-reserved in core; the exact attribute bytes are decoded at plan GATE-1 (drops the phantom "slots 22–25 reserved" claim).
- **AR-166** (preflight PF-005/PF-006) — popup dismissal is concrete: the list takes focus on open; dismiss on Esc / outside mouse-down (**consumed**, dismiss-only) / list-focus-loss (via the PF-009 signal).

> **Preflight note (PF-007/PF-008, → plan GATE-1):** `r.b.y += 7` is the **popup rect** height (net +7),
> not the visible list-row count (~5 after frame); and TV's store is **byte-bounded** (1024-byte block,
> evict-oldest-by-bytes, `histlist.cpp:95/126-136`) — GATE-1 decides byte-block fidelity vs. a simpler
> entry-count cap (a permitted non-visual modernization).

> **Traceability:** AR-130…AR-135 are explicit user choices (RD-14 `make_requirements` gate,
> 2026-07-02); AR-136…AR-140 are single-dominant / source-determined decisions (the AR-106 data model,
> the AR-137 DRY standard, the decoded TV geometry, the AR-97 additive-role pattern, the AR-98/114 demo
> pattern) recorded for traceability.

---

## Security Considerations

> RD-14 adds two **dropdown** controls over the existing in-process TUI. No network, no persistence, no new
> untrusted external surface. The input boundaries are keystroke/mouse → view state and item/history text
> → screen:
- All draws (button icon, popup frame, list rows) route through the RD-03 `DrawContext` → `ScreenBuffer` +
  core `sanitize` boundary; `getText`/`historyStr` output is sanitized like any other cell text (no raw
  escapes from item or history strings reach the terminal).
- The **History store is bounded** (a fixed block with evict-oldest, faithful to `histlist.cpp`) — no
  unbounded growth from repeated entries; `historyAdd` skips empty and dedups. Store reads
  (`historyStr(id, index)`) are **bounds-checked** against `historyCount(id)`.
- Dropdown row access and the filter predicate operate over the bounded visible window of the RD-11
  `ListView` (virtual-scroll indexing is already bounds-checked); the pasted/typed field text remains
  gated by the `Input`'s existing validator/`maxLength` (RD-06/07).

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode (TV `thistory.cpp`/`thistwin.cpp`/`thstview.cpp`/
`histlist.cpp` + `tvtext1.cpp`/`dialogs.h` is the drawing/behavior oracle; `ComboBox` follows the
`TListBox`/History popup visuals).

- **AC-1** (`History` button draw) — a `History` linked to an `Input` draws the `▐↓▌` icon
  (`tvtext1.cpp:86`) adjacent to the field in the `cpHistory`-decoded colors; asserted against the buffer
  pre-`serialize`. *(AR-135/AR-138/AR-139)*
- **AC-2** (`History` open) — clicking the button, pressing **Down** while the linked `Input` is focused,
  or **Alt+Down** opens the anchored popup listing that id's history (most-recent first); the popup rect is
  the field grown ±1 wide, ≤ 7 rows, clamped to the host extent. *(AR-135/AR-138)*
- **AC-3** (History store) — `historyAdd` skips empty, dedups an existing equal entry, appends most-recent,
  and evicts the oldest when the bounded block is full; two `History` controls with the same `historyId`
  share the list; a `History` given a `history: Signal<string[]>` uses that instead of the global store.
  *(AR-130)*
- **AC-4** (`History` pick / cancel) — Enter/double-click on a row replaces the linked `Input` text
  (clamped to `maxLength`) and `selectAll`s it **via the public Input linkage seam** (AR-162); Esc or an
  outside-click cancels (the outside-click consumed, not passed through) and leaves the field unchanged.
  *(AR-138/AR-162/AR-166)*
- **AC-5** (`ComboBox` editable + filter) — an editable `ComboBox<T>` accepts free text into its `text:
  Signal<string>`; typing narrows the dropdown to items matching `text` (default case-insensitive
  substring); picking a row sets `value` to the item **and** `text` to `getText(item)`; free text matching
  no item leaves `value` `null`. *(AR-131/AR-134/AR-136/AR-164)*
- **AC-6** (`ComboBox` select-only + type-ahead) — a `ComboBox({ editable:false })` is a read-only picker
  showing `getText(value)`; typing jumps `focused` to the first matching row (no `text` edit); picking
  sets `value`. *(AR-131/AR-134/AR-164)*
- **AC-7** (`ComboBox<T>` binding) — bound to `items: Signal<T[]>` + `getText`, the dropdown lists
  `getText(item)`; updating `items` re-renders the visible rows; `value: Signal<T | null>` reflects the
  current selection independently of the field `text`. *(AR-136/AR-164)*
- **AC-8** (shared popup geometry) — both controls use one anchored-popup primitive: the placement grows
  the anchor ±1 and the **popup rect** by a default of 7 rows (`r.b.y += 7` net, `thistory.cpp:93-97`;
  the visible **interior** list rows are ~5 after the frame + `grow(-1,-1)` — the `maxRows` popup-vs-visible
  distinction is pinned at plan GATE-1, PF-007), clamps to the host extent, and scrolls when entries
  overflow (owned RD-11 ScrollBar). *(AR-137/AR-138)*
- **AC-9** (non-modal dismissal) — the popup is non-modal (the rest of the UI keeps updating); the popup
  list takes focus on open; Enter/double-click picks; Esc, an outside mouse-down (consumed, no
  pass-through), or the list losing focus (Tab-away, via the PF-009 signal) dismisses without a pick;
  after a dismissing click the UI is interactable again. *(AR-132/AR-166)*
- **AC-10** (theme roles) — `defaultTheme` exposes the additive History button/window/viewer roles with
  `cpGrayDialog`/`cpBlueWindow`-decoded colors; `encode()` of each does not throw; they are the only new
  core role symbols. *(AR-139)*
- **AC-11** (faithful geometry) — the button icon, popup rect, and list rows match their TV source
  (`thistory.cpp`/`thstview.cpp`), asserted against the buffer pre-`serialize`. *(fidelity directive)*
- **AC-12** (packaging) — the controls live in `packages/ui/src/dropdown/` with explicit named re-exports
  from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-133)*
- **AC-13** (stories + demo) — `History` and `ComboBox` each have a kitchen-sink story passing the headless
  smoke test; `demo:dropdowns` runs headless with an ASCII frame per step (open → filter/type-ahead → pick
  → an Esc-cancel). *(AR-140)*
- **AC-14** (security) — item/history text is sanitized to the screen; the History store is bounded with
  bounds-checked reads; free-text field input stays gated by the `Input` validator/`maxLength`. *(security standard)*

---

> **Next step:** run the make_plan skill on RD-14 to produce the implementation plan (spec-first per
> component: spec oracles RED → implement → GREEN → impl tests), **reading each component's TV source
> first** per the fidelity directive (`THistory`/`THistoryWindow`/`THistoryViewer`/`histlist.cpp` — GATE 1
> decode of draw/geometry/`getColor` chain in the `03-NN-*.md` spec + the BEFORE/AFTER gate tasks in
> `99-execution-plan.md`); optionally preflight, then exec_plan. RD-14 is sibling 1 of the RD-12+ set
> (AR-126); RD-15 (Tree) is next in the drafting queue.
