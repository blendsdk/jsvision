# RD-17: Tabs — tabbed layout container (documented new component, no TV counterpart)

> **Document**: RD-17-tabs.md
> **Status**: Draft
> **Created**: 2026-07-03 (`make_requirements --continue` — RD-12+ high-value-controls set, sibling 4 of 6; first of the **Later** phase)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done; `Group`/`View`/`DrawContext`, the `Show` visibility toggle, per-view focus), RD-04 (Event loop — done; focus chain, keymap/commands, mouse hit-test the strip/close/arrows route through), RD-05 (App shell — done; the shipped **frame glyph set** the folder tabs reuse, the `parseTilde`/`tildeSegments` hotkey helpers from `menu/`, the disabled-greying convention, `Window`/`Dialog` that host it), RD-01 (Reactive core — done; `Signal`/`computed`/`Show` drive the tabs list + active index), RD-02 (Layout engine — done; the content region + strip fit via the normal layout pass), `@jsvision/core` (done; the additive `tab*` theme roles land here at plan GATE-1)
> **Set**: RD-12+ high-value controls (AR-125…AR-129) — sliced by mechanism into 6 sibling RDs; this is **RD-17 (Tabs)**, the first **Later**-phase RD (after the RD-14/15/16 MVP, AR-129).
> **CodeOps Skills Version**: 3.2.0

---

## Feature Overview

A **tabbed layout container** for `@jsvision/ui` — a self-contained **`TabView`** that presents several
titled pages in one framed region, one visible at a time, with a clickable/keyboard-navigable tab strip
across the top. It is the idiomatic way to pack multiple panels of content (settings groups, a
parameters dialog with sections, a multi-page form) into a single window without opening several
desktop windows.

**GATE-1 fidelity finding (whole-tree search, `magiblot/tvision`).** Turbo Vision has **no** tab /
notebook / tabstrip / property-sheet class. A full-tree search for any `TTab*`/notebook/tabstrip class
returns only `TRefTable` (the help compiler's sorted collection) and `TTable` (an unrelated ASCII-art
demo view, `examples/tvdemo/ascii.h`) — neither is a tab control. Turbo Vision organized multi-panel
content by placing **separate `TWindow`s on the desktop**, never by tabbing within one frame.

So RD-17 has **no TV counterpart to decode** — stronger than RD-16, which at least had the `TListViewer`
spine. Per the **NON-NEGOTIABLE TV-fidelity directive**, RD-17 is therefore a **documented new component**
(AR-172). The directive still binds every **piece** that *does* have a TV precedent, and RD-17 grounds
each one in an already-decoded, already-shipped facility rather than inventing:

| Piece | Grounded in |
|-------|-------------|
| Box-drawing chrome for the folder-tab strip + content frame — line/corner glyphs (`┌ ┐ └ ┘ │ ─`) from the shipped RD-05 **frame glyph set** (`window/frame.ts`) **plus the tab-junction tees (`┬ ┴ ├ ┤`) added by RD-17** (the frame set ships no tee, and its glyph consts are module-private) | the shared shapes match every other framed surface; the tees decoded fresh at plan GATE-1 (PF-002/AR-184) |
| `~X~` tilde hotkeys on tab titles + Alt-jump | the shipped **`parseTilde`/`tildeSegments`** helpers (`menu/`, reused by `Label`) |
| Disabled-tab greying | the Button/Cluster **disabled-colour** convention (`getColor` disabled) |
| Active vs. inactive tab colour | decoded through the **`cpAppColor`** chain at **plan GATE-1**, mirroring the window active/inactive theming (`windowInactive`) |

This is exactly the extension latitude the directive permits ("behavior the original couldn't have may
extend TV, but the visual shapes/sizes/colors must still match") — the same class as reactive binding,
truecolor, and async modality. The *shapes and colours* remain TV-faithful even though the *component*
is new.

The components in scope:

| Component | Basis | Role |
|-----------|-------|------|
| `TabView` | *(new, extension — AR-172)* | A `Group` container owning a focusable **tab strip** (folder-tab box-drawing labels across the top) + a **bordered content region** showing the active tab's page; one page visible at a time via `Show`. Ctrl+PageUp/Down (+ best-effort Ctrl+Tab) / `←→` / Alt-hotkey / click navigation; disabled, closeable, and overflowing tabs handled. |
| `Tab` | *(new)* | The tab descriptor — `{ title: string; content: Group; disabled?: boolean; closeable?: boolean }`. `title` carries optional `~X~` hotkey markup. |
| *(internal)* strip renderer | RD-03 `View` + the `*-rows.ts` renderer-split pattern | Draws the notched tab labels, the `◄`/`►` overflow arrows, and the per-tab `×`; hit-tests clicks to (tab / close / arrow); keeps `tab-view.ts` ≤ 500 lines. |

**Behavior may extend TV** (the tab concept itself, reactive binding, dynamic add/remove) but the
**drawing/geometry/colour of every piece must match TV conventions** (box glyphs, tilde hotkeys, disabled
greying, active/inactive colour) — decoded/confirmed at plan GATE-1.

---

## Functional Requirements

### Must Have

#### `TabView` — self-contained tabbed container (AR-172…AR-175)
- A **`Group`** container (only a `Group` owns children — the shipped idiom is `ListView extends Group` /
  `Tree extends Group` / `DataGrid extends Group`, AR-169) composing a **focusable tab-strip renderer**
  (a `View`, its own file — mirrors `list-rows.ts`/`tree-rows.ts`/the grid rows-renderer) and a
  **bordered content region**. It is **self-contained** (AR-174): it draws **both** the tab strip **and**
  the surrounding frame, so dropping a `TabView` into any `Group`/`Window`/`Dialog` is complete — no host
  frame required (the batteries-included choice, mirroring how `Dialog`/`Window` own their chrome).
- **Visual style — folder tabs (AR-173):** a **top** strip whose tab labels join the content frame with
  `┬` notches (`┌ ~G~eneral ┬ ~D~isplay ┐` over a bordered region), drawn with the shipped frame set's
  line/corner glyphs **plus the tab-junction tees (`┬ ┴ ├ ┤`) added by RD-17** (the frame set ships no tee;
  its glyph consts are module-private — `frame.ts:77-94`), so it matches every other framed surface for the
  shared shapes. The **active** tab is drawn brighter (the
  active-tab role); **inactive** tabs dimmed (the inactive-tab role). Strip position is **top only** for
  this RD (bottom-strip deferred).
- **Content model — eager pages + `Show` (AR-175):** each `Tab.content` is a **`Group` built up-front**;
  exactly **one page is visible at a time**, switched by toggling visibility via RD-01 **`Show`** keyed on
  the active index. All pages are mounted; switching is a cheap visibility flip (no per-switch
  mount/dispose). The content region is the frame's interior, laid out by the normal RD-02 pass.
- **Tabs data model (AR-178):** `tabs: Signal<Tab[]>` — a **caller-owned reactive** array (mirroring
  `ListView`'s `items` and `Tree`'s `roots`, AR-106/142), where
  `Tab = { title: string; content: Group; disabled?: boolean; closeable?: boolean }`. Updating the signal
  (add/remove/reorder a tab) re-renders the strip and repaints. The `title` carries optional `~X~` hotkey
  markup, parsed with the shipped `parseTilde`.
- **Active binding (AR-177):** a two-way **`active: Signal<number>`** — the index of the visible tab
  (matching the house index convention: `RadioGroup` `Signal<number>`, `ListView.focused`, `Tree`,
  AR-100/106/147). It is **clamped** to the current tab count on any change, and on a **remove** it
  clamps to the neighbour (prev if the removed tab was last, else the same position → the next tab).
- **Navigation (AR-179, revised by preflight PF-001 / AR-183):**
  - **Ctrl+PageUp / Ctrl+PageDown** cycle to the previous/next **enabled** tab from **anywhere inside the
    `TabView`** (wrap-around), skipping disabled tabs. This is the **reliable global switch**: the decoder
    produces `{key:'pageup'|'pagedown', ctrl:true}` from `CSI 5;5~`/`CSI 6;5~` on real terminals
    (`keys.ts:57-69,187-192`).
  - **`←` / `→`** cycle to the previous/next enabled tab **when the tab strip itself holds focus**.
  - **Alt+letter** jumps directly to the tab whose `~X~` hotkey matches (skipping disabled tabs).
  - **Ctrl+Tab / Ctrl+Shift+Tab** are registered as an **additional best-effort accelerator** for the same
    next/previous-enabled cycle, but fire **only** on terminals that disambiguate a modified Tab via the
    keyboard protocol (CSI-u / `modifyOtherKeys`). That decode is **not yet enabled** (RD-06 "Phase B",
    `keys.ts:8-10` + `host/modes.ts:11-15` DEF-2): on today's terminals `Ctrl+Tab` is byte-identical to
    plain Tab (both `0x09`) and does **not** fire — the reliable switchers are Ctrl+PageUp/Down, `←→`,
    Alt-hotkey, and click.
  - Plain **Tab / Shift+Tab keep their normal meaning** — moving focus among the *content* widgets of the
    active page (the RD-04 focus chain), never switching tabs.
  - A **click** on a tab label activates it; a click on a tab's **`×`** closes it (closeable only); a
    click on **`◄`/`►`** scrolls the strip (overflow).
- **Disabled tabs (AR-176):** a `disabled: true` tab is drawn in the **disabled colour** (the Button/Cluster
  greying convention), is **not activatable** by Ctrl+PageUp/Down/`←→`/Alt-hotkey/click (or best-effort
  Ctrl+Tab), and is **skipped** by all cycling. (Its page is never shown while disabled.)
- **Hotkey accelerators (AR-176):** `~X~` markup in a `Tab.title` renders the marked letter in the
  hotkey/shortcut style (reusing `tildeSegments`, exactly as `Label`/menu items do) and registers an
  **Alt+letter** accelerator that jumps to that tab.
- **Overflow (AR-176):** when the total tab-label width exceeds the strip width, the strip shows **`◄` at
  the left end and `►` at the right end** (only while overflowing) and **auto-scrolls to keep the active
  tab fully visible**; clicking an arrow scrolls the strip by one step. Off-screen tabs are clipped at the
  strip edges.
- **Closeable tabs + dynamic add/remove (AR-176/AR-178):** a `closeable: true` tab draws a small **`×`**
  affordance in its label; activating it (click on the `×`) **removes the tab from the `tabs` signal**
  (the built-in handler mutates the caller-owned signal for you) **and fires `onClose(tab)`**; `active`
  re-clamps to the neighbour (AR-177). Tabs can equally be **added/removed at runtime** by writing the
  `tabs` signal directly — the strip and content region react.

#### Theme roles — additive faithful `tab*` colours (AR-180)
- Add a small set of **additive `tab*` roles** to core `@jsvision/core` `Theme` + `defaultTheme` — tab
  **active** / **inactive** / **disabled** (and, if the plan GATE-1 decode shows it is needed, the strip
  background) — each decoded through the **`cpAppColor`** chain at **plan GATE-1** and pinned to an exact
  attribute byte per the fidelity directive. Since TV has no tab palette, these are **documented extension
  colours** grounded in TV's window active/inactive + disabled conventions. Additive, non-breaking — the
  same cross-package pattern as the RD-06/07/11/15/16 control roles (AR-97/112/122/149/159). **The exact
  role count + attribute bytes are pinned at plan GATE-1.**

#### Kitchen-sink story + headless demo (AR-182)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`Tabs` story** — a folder-tab `TabView`
  with **≥3 tabs including one disabled and one closeable**, `~X~` hotkeys, distinct content per page, and a
  visible active-tab echo; Ctrl+PageUp/Down / `←→` / Alt-hotkey / click / close all live (+ best-effort
  Ctrl+Tab) — passing the headless smoke test, plus a headless **`demo:tabs`** walkthrough (dispatch-driven,
  an ASCII frame per step: render → Ctrl+PageDown switch → Alt-hotkey jump → close a tab → overflow-scroll),
  matching
  `demo:containers`/`demo:tree`/`demo:table`.

### Should Have

- **`TabView.select(index)` / `next()` / `prev()`** convenience methods (drive the same `active` signal
  programmatically, not only via keys/clicks).
- **A default/first-enabled active tab** when the constructed `active` points at a disabled tab (snap to
  the first enabled tab rather than showing nothing).
- **`onChange(index)`** callback fired when the active tab changes (parallel to `onClose`) for callers that
  prefer a callback to observing the signal.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `ProgressBar`/`Spinner` (RD-18), `Surface` (RD-19), `History`/`ComboBox` (RD-14), `Tree` (RD-15),
  `Table`/`DataGrid` (RD-16) — the other RD-12+ siblings (AR-126).
- **Lazy per-tab content** (`content: () => Group` built on first activation) — the eager model is the MVP
  (AR-175); lazy building is a separable enhancement (see Deferred).
- **Bottom / left / right tab strips** — top-strip only for this RD (AR-173).
- **Reorder tabs by drag** — the strip is a navigation surface here, not a drag surface (cf. RD-16's
  no-drag header).
- **Nested / scrollable tab content beyond the page `Group`** — a page is a `Group`; if it needs to
  scroll, the caller composes a `Scroller` inside it (RD-11), not the `TabView`.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Lazy per-tab content factory (`() => Group`, mount/dispose on switch) | AR-175 | later (post-set) | The eager `Show` model covers the common case; lazy building adds switch-time lifecycle, worth it only for heavy/many-tab views. |
| Bottom / side tab strips | AR-173 | later (post-set) | Top strip is the common case; other edges are a geometry variant on the same renderer. |
| Tab drag-reorder | out-of-scope | later (post-set) | The strip is a navigation surface; drag is a separable enhancement. |

---

## Technical Requirements

### New subsystem (AR-181)
- One new subsystem dir `packages/ui/src/tabs/` (dir-per-concern, AR-133/148/160): `tab-view.ts` (the
  `TabView` **`Group`** container + the `Tab` type + the active/close/nav/clamp logic), a **strip-renderer**
  file (the focusable tab-strip `View` — draws the notched labels, the `◄`/`►` arrows, and the per-tab
  `×`; hit-tests clicks to tab/close/arrow; mirrors the `list-rows.ts`/`tree-rows.ts`/grid renderer split so
  `tab-view.ts` stays ≤ 500), one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named re-exports**
  from `src/index.ts` (the layout-convention rule, AR-81/AR-102/AR-113). *(Exact file split confirmed at
  plan time; the renderer split follows the established `ListView`/`Tree`/`DataGrid` shape.)*
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package edits (additive only, AR-180)
- `@jsvision/core` `Theme` + `defaultTheme` gain the additive **`tab*` roles** (active/inactive/disabled,
  plus optionally the strip background), decoded from `cpAppColor` at plan GATE-1 (exact attribute bytes
  pinned per the fidelity directive). Same additive pattern as AR-97/112/122/149/159; no existing role
  changes.

### Reuse (no new engine primitives)
- **Frame chrome (RD-05):** the content-region border + the tab line/corner glyphs reuse the shipped frame
  glyph set's shapes (`window/frame.ts` — `┌ ┐ └ ┘ │ ─`), so the tabs match every other framed surface;
  RD-17 **adds the tab-junction tees `┬ ┴ ├ ┤`** (U+252C/2534/251C/2524) the frame set does not ship,
  decoded fresh at plan GATE-1. (`frame.ts`'s glyph consts are module-private — the plan either exports
  them or defines a small local `tabs/` glyph set.)
- **Hotkeys (RD-05/RD-06):** `~X~` parsing + rendering reuse `parseTilde`/`tildeSegments` (`menu/`, already
  reused by `Label`); Alt-hotkey routing reuses the RD-04 keymap/dispatch path.
- **Visibility switch (RD-01/RD-03):** one page visible at a time via RD-01 `Show` keyed on `active`; the
  page `Group`s mount under the `TabView` scope.
- **Reactivity/draw (RD-01/RD-03):** RD-01 signals (`tabs`/`active` drive strip + content re-render),
  RD-03 `bind`/`invalidate`, RD-03 `DrawContext` (all writes via `ScreenBuffer` + `sanitize`).
- **Focus/commands/mouse (RD-04):** the tab strip is a focusable `View` in the RD-04 focus chain;
  Ctrl+PageUp/Down (+ best-effort Ctrl+Tab)/`←→`/Alt-hotkey route through the keymap; clicks hit-test through the standard mouse path; plain
  Tab/Shift+Tab traverse the active page's content via the existing focus chain (unchanged). The reliable
  global switch chord is **Ctrl+PageUp/PageDown** (decoder-produced from `CSI 5;5~`/`CSI 6;5~`); Ctrl+Tab
  is a best-effort accelerator gated on the keyboard protocol (PF-001/AR-183).
- **Disabled greying (RD-06):** the disabled-tab colour reuses the Button/Cluster disabled-colour
  convention.

---

## Integration Points

- **View/Group + Show (RD-03/RD-01):** `TabView` is a `Group`; the one-page-at-a-time switch is a `Show`
  over the active index — the same reactive composition the whole UI uses.
- **App shell (RD-05):** a `TabView` mounts in a `Window`/`Dialog`/`Desktop` like any focusable container;
  it reuses the frame glyph set and the `parseTilde` hotkey helpers; no overlay/capture needed. (A
  parameters `Dialog` with several sections is the canonical host.)
- **Event loop (RD-04):** tab switching adds Ctrl+PageUp/Down (+ best-effort Ctrl+Tab)/`←→`/Alt-hotkey
  handling **inside** the `TabView`; plain Tab focus traversal of page content is unchanged (the content
  widgets are ordinary focusables).
- **Core theme (core):** the additive `tab*` roles extend the same `Theme` the frame/menu/status/controls/
  list/outline/table roles read; `defaultTheme` stays the single source of truth.
- **Kitchen-sink (examples):** the `TabView` gets a story; `demo:tabs` is the headless walkthrough. (When
  a future demo or the showcase itself wants sectioned content, this is the component it uses.)

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-172** — RD-17 is a **documented new component** (GATE-1: TV has no tab/notebook/tabstrip class); the
  pieces (box chrome, tilde hotkeys, disabled greying, active/inactive colour) are grounded in shipped
  TV-decoded facilities.
- **AR-173** — **folder-tab** box-drawing style, **top** strip joined to the content frame; active brighter,
  inactive dimmed; bottom/side strips deferred.
- **AR-174** — **self-contained** container (owns both the strip and the surrounding frame).
- **AR-175** — **eager** child pages, one visible at a time via `Show`; lazy factory deferred.
- **AR-176** — MVP includes **disabled tabs, `~X~` hotkey accelerators, `◄`/`►` overflow scrolling, and
  closeable tabs + dynamic add/remove** (all four).
- **AR-177** — **`active: Signal<number>`** (index), clamped to the tab count, clamps to the neighbour on
  remove.
- **AR-178** — **`tabs: Signal<Tab[]>`** (caller-owned); the built-in `×` handler removes the entry and
  fires `onClose(tab)`; `Tab = {title, content, disabled?, closeable?}`.
- **AR-179** (revised by **AR-183**) — **Ctrl+PageUp/PageDown** cycle globally within the view (the
  reliable, decoder-produced switch) + **`←→`** on the focused strip + **Alt-hotkey** jump; **Ctrl+Tab/
  Ctrl+Shift+Tab** are a best-effort accelerator gated on the keyboard protocol; plain **Tab/Shift+Tab**
  keep normal content-focus meaning.
- **AR-180** — additive **`tab*` theme roles** (active/inactive/disabled), decoded through `cpAppColor` and
  pinned to exact bytes at **plan GATE-1**.
- **AR-181** — new `src/tabs/` subsystem, explicit named re-exports.
- **AR-182** — kitchen-sink `Tabs` story + headless `demo:tabs`.
- **AR-183** (preflight PF-001) — the global tab-switch chord is **Ctrl+PageUp/PageDown** (the decoder
  produces `{pageup/pagedown, ctrl:true}` from `CSI 5;5~`/`CSI 6;5~`); **Ctrl+Tab/Ctrl+Shift+Tab** are a
  best-effort accelerator that fires only under the keyboard protocol (unshipped, DEF-2) — on real
  terminals Ctrl+Tab is byte-identical to plain Tab, so it would have silently never fired. AC-4's oracle
  now feeds real decoder bytes.
- **AR-184** (preflight PF-002) — the folder-tab chrome reuses the frame set's line/corner glyphs and
  **adds the tab-junction tees `┬ ┴ ├ ┤`** (the shipped `frame.ts` ships no tee and its glyph consts are
  module-private); "no new glyph decode" was inaccurate. AC-2 reworded.

> **Traceability:** AR-173…AR-179 are explicit user choices (RD-17 `make_requirements --continue` gate,
> 2026-07-03); AR-172 is the GATE-1 source-determined finding (no TV counterpart); AR-180…AR-182 are
> single-dominant / source-determined decisions (the additive-role fidelity pattern, the AR-133 subsystem
> convention, the AR-98/114/161 demo pattern) recorded for traceability.

---

## Security Considerations

> RD-17 adds a **tabbed layout container** over the existing in-process TUI. No network, no persistence, no
> new untrusted external surface. The input boundaries are keystroke/mouse → view state and tab titles →
> screen:
- Every tab `title` (including its `~X~` segments) routes through the RD-03 `DrawContext` → `ScreenBuffer` +
  core `sanitize` boundary — no raw escape sequences from a title reach the terminal (the same canonical
  injection boundary the whole UI uses). Page content is ordinary child views, each sanitizing its own
  draws.
- The `active` index and every tab access (strip render, close, cycle, hotkey jump, overflow scroll) are
  **bounds-checked / clamped** to the current `tabs` count — no out-of-range indexing regardless of
  add/remove/reorder, empty tabs, or an all-disabled set.
- Tab labels are **width-clipped** to the strip (with the `◄`/`►` overflow affordance), so a pathological
  long title cannot overflow the strip or the viewport.
- `onClose`/`onChange` are caller-supplied callbacks invoked only on the corresponding user action; no tab
  data is interpreted as code.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. There is no TV component to diff against
(GATE-1); the fidelity ACs (AC-2 chrome, AC-8 hotkeys, AC-10 colours) encode the **grounded-in-TV-pieces**
requirement — the box glyphs, tilde rendering, and `cpAppColor`-decoded bytes pinned at plan GATE-1.

- **AC-1** (tabbed container, one page visible) — a `TabView` over `tabs: Signal<Tab[]>` and
  `active: Signal<number>` renders a top tab strip + a bordered content region showing **only the active
  tab's page** (the others hidden via `Show`); switching `active` swaps the visible page. *(AR-172/AR-174/AR-175/AR-177)*
- **AC-2** (folder-tab chrome, faithful glyphs) — the strip draws folder-style tab labels joined to the
  content frame with `┬`/`┴` notches over a bordered region, using single-line box glyphs: corners/edges
  (`┌ ┐ └ ┘ │ ─`) matching the shipped frame set **plus the tab-junction tees (`┬ ┴ ├ ┤`) added by RD-17**;
  asserted against the buffer pre-`serialize`. *(AR-173/AR-184)*
- **AC-3** (active vs. inactive) — the active tab renders in the active-tab role and inactive tabs in the
  inactive-tab role; changing `active` re-themes both without a full teardown. *(AR-173/AR-180)*
- **AC-4** (global cycle, reliable from real bytes) — **Ctrl+PageDown** advances `active` to the next
  **enabled** tab (wrap-around) from anywhere inside the `TabView`, **Ctrl+PageUp** to the previous;
  disabled tabs are skipped. The oracle **feeds the real decoder bytes** (`CSI 6;5~` / `CSI 5;5~`), not a
  hand-built event, so the chord is proven to fire on a real terminal (closes the PF-001 false-green
  trap). **Ctrl+Tab / Ctrl+Shift+Tab** drive the same cycle **only** when the keyboard protocol is enabled
  (best-effort; asserted behind that capability, never on the default terminal). *(AR-179/AR-183)*
- **AC-5** (arrow cycle on strip) — when the **tab strip holds focus**, `←`/`→` move `active` to the
  previous/next enabled tab; when a **content widget** holds focus, plain Tab/Shift+Tab traverse the page's
  content and do **not** switch tabs. *(AR-179)*
- **AC-6** (click to activate / close / scroll) — a click on a tab label sets `active` to it; a click on a
  closeable tab's `×` removes it from the `tabs` signal and fires `onClose(tab)`; a click on `◄`/`►` scrolls
  the strip. *(AR-176/AR-178/AR-179)*
- **AC-7** (disabled tabs) — a `disabled` tab draws in the disabled colour, cannot be activated by
  key/click/hotkey, and is skipped by all cycling; its page is never shown while disabled. *(AR-176)*
- **AC-8** (hotkey accelerators) — a `~X~` in a tab title renders the marked letter in the hotkey style and
  **Alt+letter** jumps `active` to that tab (skipping it if disabled), reusing `parseTilde`/`tildeSegments`.
  *(AR-176)*
- **AC-9** (overflow scrolling) — when tab labels exceed the strip width, `◄`/`►` appear and the strip
  auto-scrolls to keep the active tab fully visible; off-screen tabs are clipped; arrow clicks step the
  scroll. *(AR-176)*
- **AC-10** (closeable + dynamic + clamp) — closing a closeable tab (or writing the `tabs` signal to
  add/remove) re-renders the strip and content; on a remove, `active` clamps to the neighbour (prev if it
  was last, else the next at that position) and stays in range. *(AR-176/AR-177/AR-178)*
- **AC-11** (theme roles) — `defaultTheme` exposes the additive `tab*` roles (active/inactive/disabled,
  `cpAppColor`-decoded); `encode()` of each does not throw; no existing role changes. *(AR-180)*
- **AC-12** (packaging) — the `TabView` lives in `packages/ui/src/tabs/` with explicit named re-exports from
  `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-181)*
- **AC-13** (story + demo) — the `TabView` has a kitchen-sink story (id **`containers/tabs`**, category
  `Containers` — matching the Tree/DataGrid convention, PF-003; ≥3 tabs incl. one disabled + one closeable,
  `~X~` hotkeys) passing the headless smoke test; `demo:tabs` runs headless with an ASCII frame per step
  (render → Ctrl+PageDown switch → Alt-hotkey jump → close a tab → overflow-scroll). *(AR-182)*
- **AC-14** (security) — every tab title is sanitized to the screen; the active index and all tab access are
  bounds-checked/clamped; titles are width-clipped so no label overflows the strip or viewport. *(security standard)*
- **AC-15** (empty / all-disabled state) — with an empty `tabs` signal the framed content region draws
  empty (no strip labels) and nothing crashes/indexes out of range; with **all** tabs disabled no page is
  shown and cycling is a no-op (no infinite loop). *(edge case; RD-16 AC-14 / RD-15 preflight PF-003 precedent)*

---

> **Next step:** run the make_plan skill on RD-17 to produce the implementation plan (spec-first: spec
> oracles RED → implement → GREEN → impl tests). Because RD-17 has **no TV counterpart** (GATE-1), the
> plan's GATE-1 work is narrower but still mandatory: **pin the `tab*` theme-role attribute bytes through
> the `cpAppColor` chain**, **reuse the shipped frame line/corner glyphs and decode the added tab-junction
> tees (`┬ ┴ ├ ┤`)** (the frame set ships no tee; PF-002), and wire the reliable **Ctrl+PageUp/Down** switch
> chord (Ctrl+Tab best-effort; PF-001), recording the decode + the two BEFORE/AFTER gate tasks in
> `99-execution-plan.md`. This RD was **preflighted** (`00-preflight-report-RD-17.md`, 2026-07-03): 1 MAJOR
> (PF-001) + 1 MINOR (PF-002) resolved Option A, 1 OBSERVATION (PF-003) folded. Optionally re-preflight,
> then exec_plan. RD-17 is sibling 4 of the RD-12+ set (AR-126) and the first **Later**-phase RD (AR-129);
> **RD-18 (ProgressBar/Spinner)** is next in the drafting queue, then RD-19 (Surface).
