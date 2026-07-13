# RD-15: Tree — expandable outline (TV `TOutlineViewer`/`TOutline`)

> **Document**: RD-15-tree.md
> **Status**: Draft
> **Created**: 2026-07-02 (`make_requirements` — RD-12+ high-value-controls set, sibling 2 of 6)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-11 (Containers/lists — done; the virtual-scroll helpers `list/virtual.ts` + the owned-`ScrollBar` pattern the Tree reuses), RD-05 (App shell — done; overlay/capture not needed, but `Desktop`/`Window` host it), RD-04/RD-03/RD-02/RD-01 (done), `@jsvision/core` (done; the additive `cpOutlineViewer` theme roles land here)
> **Set**: RD-12+ high-value controls (AR-125…AR-129) — sliced by mechanism into 6 sibling RDs; this is **RD-15 (Tree)**, an MVP-phase RD (AR-129).
> **CodeOps Skills Version**: 3.1.0

---

## Feature Overview

The **tree/outline** tier of `@jsvision/ui` — a focusable, virtual-scrolling **`Tree`** that renders a
hierarchy of expandable/collapsible nodes with faithful Turbo Vision tree-line graphics. Reimagined from
its Borland Turbo Vision counterpart per the **NON-NEGOTIABLE TV-fidelity directive** (`magiblot/tvision`
`source/tvision/toutline.cpp`, class defs `include/tvision/outline.h`).

TV's `TOutlineViewer` is an abstract `TScroller` subclass driving the drawing over data-model-agnostic
accessors; `TOutline` is the concrete `TNode`-tree subclass. RD-15 keeps the **drawing/geometry/glyphs
exactly** (`│├└─` connectors + a bare `+`/`─` expand marker, the collapsed-text two-tone color) while
modernizing the **data model** (a concrete reactive `TreeNode<T>`) and **behavior** (←/→ collapse/expand)
per the directive's "may extend behavior; visuals must match" rule.

The components in scope:

| Component | TV source | Role |
|-----------|-----------|------|
| `Tree<T>` | `TOutlineViewer` + `TOutline` (`toutline.cpp`, `outline.h`) | A focusable virtual-scroll outline: flattens the visible (expanded) nodes into rows, each = a `│├└─`+`+`/`─` graph prefix + the node text; ↑↓/←→/+/-/* navigation + expand/collapse; a two-way focused index + a select command. |
| `TreeNode<T>` | `TNode` (`outline.h`) | The node model — `{ value: T, children: TreeNode<T>[] }` (plain data); expand state is owned reactively by the view. |
| *(internal)* graph builder | `createGraph`/`getGraph` (`toutline.cpp:165/364`) | The faithful tree-line prefix builder (level marks + end graphic + expand marker). |

**Behavior may extend TV** (reactive `TreeNode<T>`, ←/→ collapse/expand, generic payload) but the
**drawing/geometry must match TV exactly** (the `graphChars` glyphs, indent/end widths, two-tone collapsed
text, and every resolved color).

---

## Functional Requirements

### Must Have

#### `Tree<T>` — expandable outline (TV `TOutlineViewer`, AR-141…AR-147)
- A focusable `View` that **flattens the visible nodes** (root + the recursively-expanded descendants) into
  an ordered row list and **virtual-scrolls** it (renders only the rows in view — TV `TOutlineViewer::draw`
  iterates `delta.y`-relative visible positions via `firstThat(drawTree)`). It **reuses the RD-11
  virtual-scroll helpers** (`list/virtual.ts` `clampIndex`/`keepVisible`) and **owns a `ScrollBar`** (as
  `ListView` does), with a **Tree-specific row renderer** (AR-145 — `ListRows` can't express the graph
  prefix / two-tone / expand zone; TV likewise made `TOutlineViewer` a `TScroller` subclass, not a
  `TListViewer`).
- **Node model (AR-141):** generic `TreeNode<T> = { value: T, children: TreeNode<T>[] }` (plain reactive
  data, mirroring `ListView<T>`'s items model, AR-106), rendered via a `getText: (value: T) => string`.
  **Expand state is owned by the view reactively** (a Set keyed by node identity), so user data stays plain;
  toggling it re-flattens the visible list. The tree source is a `Signal<TreeNode<T>>` (or roots array).
- **Row rendering (AR-146, faithful):** each visible row = the **graph prefix** then the node **text**. The
  graph is built from `graphChars = "\x20\xB3\xC3\xC0\xC4\xC4+\xC4"` (`toutline.cpp:367`): level filler
  `space` / level mark `│` for each continued ancestor level, then the end graphic — `├` (has a sibling
  below) or `└` (last child), `─` fillers, and the **expand marker**: a bare **`+`** when the node has
  collapsed children, a **`─`** when expanded (**no `[+]`/`[-]` brackets**). A **collapsed** node's text is
  drawn in the *not-expanded* color (`color >> 8`, TV `drawTree`). Indent (`levelWidth`) + end (`endWidth`)
  widths and the exact `getColor(0x0202/0x0303/0x0401)` chain are decoded at **plan GATE-1**.
- **Navigation (AR-142, keys):** ↑↓ move focus ±1, PgUp/PgDn ±viewport, Home/End, Ctrl+PgUp/Dn to
  ends (TV `handleEvent`); **`+`/`-`/`*`** expand / collapse / **expand-all** the focused node (faithful);
  **← collapses** (or moves to the parent when already collapsed) and **→ expands** (or descends to the
  first child when already expanded) — the modern affordance overriding TV's ←→ = up/down (a permitted
  behavioral extension, glyphs unchanged; cf. RD-14 Alt+Down).
- **Mouse (AR-142):** a click sets focus to the clicked row; **a click within the graph-prefix width
  toggles expand/collapse** of that node (TV `mouse.x < strwidth(graph)` → `adjust(!isExpanded)`); a
  **double-click selects** (as Enter).
- **Selection (AR-144/AR-147):** **single-select** — a two-way `focused: Signal<number>` (flattened index)
  + a `selected`/`onSelect`/`command` seam; **Enter/double-click emits the select command** (TV
  `cmOutlineItemSelected` = 301) and sets `selected`. Checkbox/multi-select is deferred (AR-144).
- **Loading (AR-143):** **eager** — the whole node tree is in memory and flattened reactively on
  expand/collapse. Lazy-load-on-expand is deferred (AR-143).

#### Theme roles — faithful `cpOutlineViewer` colors (AR-149)
- Add the additive outline roles to core `@jsvision/core` `Theme` + `defaultTheme` — **outline
  normal/focus/select/notExpanded** (`cpOutlineViewer "\x6\x7\x3\x8"`, `toutline.cpp:15`; palette layout
  1=Normal/2=Focus/3=Select/4=NotExpanded, `outline.h`) — decoded through the `getColor` chain at **plan
  GATE-1**. Additive, non-breaking — the same cross-package pattern as the RD-06/07/11/14 control roles
  (AR-97/112/122/139).

#### Kitchen-sink story + headless demo (AR-150)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`Tree` story** (an expandable outline
  with a visible focused/selected echo; ← collapse / → expand / `+`/`-`/`*` / click-to-toggle) passing the
  headless smoke test, plus a headless **`demo:tree`** walkthrough (dispatch-driven, an ASCII frame per
  step: expand → navigate → collapse → select), matching `demo:controls`/`demo:containers`.

### Should Have

- `Tree.expandAll()` / `collapseAll()` convenience methods (TV `expandAll`, `toutline.cpp:106`) exposed on
  the instance, not only via the `*` key.
- A `Tree` **guide-line toggle** (`guides?: boolean`, default on) — the faithful `│├└─` prefix is the
  default; a caller may hide the connectors for a flat-indent look without changing the expand markers.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `Table`/`DataGrid` (RD-16), `Tabs` (RD-17), `ProgressBar`/`Spinner` (RD-18), `Surface` (RD-19),
  `History`/`ComboBox` (RD-14) — the other RD-12+ siblings (AR-126).
- **Node editing** (rename/drag-reorder in the tree) — TV's outline is read-only navigation.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Lazy-load-on-expand (async children provider + loading state) | AR-143 | later (post-set) | Eager in-memory covers the MVP; async loading is a separable enhancement for huge/remote trees. |
| Checkbox / multi-select tree | AR-144 | later (post-set) | Single-select is faithful to TV; a checkbox state model is a separate mechanism. |
| Abstract `TreeModel` accessor interface | AR-141 | later (post-set) | The concrete `TreeNode<T>` covers the common case; a data-model-agnostic accessor can be added as an escape hatch when a non-materialized backing store needs it. |

---

## Technical Requirements

### New subsystem (AR-148)
- One new subsystem dir `packages/ui/src/tree/` (dir-per-concern, AR-133/113): `tree.ts` (`Tree<T>` +
  `TreeNode<T>`), `graph.ts` (the faithful `createGraph` line-prefix builder + the flatten-visible helper),
  one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named re-exports** from `src/index.ts` (the
  layout-convention rule, AR-81/AR-102/AR-113).
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package edits (additive only, AR-149)
- `@jsvision/core` `Theme` + `defaultTheme` gain the additive `cpOutlineViewer` roles (outline
  normal/focus/select/notExpanded), decoded from `cpAppColor` at plan GATE-1 (exact attribute bytes pinned
  per the fidelity directive). Same additive pattern as AR-97/112/122/139; no existing role changes.

### Reuse (no new engine primitives)
- **Virtual scroll (RD-11):** the visible-window math reuses `list/virtual.ts` (`clampIndex`/`keepVisible`);
  the owned `ScrollBar` reuses `scroll/scroll-bar.ts` + its `value`↔position wiring (as `ListView` does) —
  no new scroll machinery.
- **Reactivity/layout/draw:** RD-01 signals (the tree source + the view-owned expand Set + `focused`
  drive re-flatten/repaint), RD-03 `bind`/`invalidate`, RD-03 `DrawContext` (all writes via `ScreenBuffer`
  + `sanitize`), RD-02 for the container fit.
- **Focus/commands (RD-04):** the select command routes through the existing command/keymap path; focus is
  the standard `View` focus.

---

## Integration Points

- **Containers (RD-11):** the Tree reuses the virtual-scroll helpers + the owned `ScrollBar`; it is a
  sibling of `ListView` (its own renderer, shared scroll math). RD-11 is the direct upstream.
- **App shell (RD-05):** a `Tree` mounts in a `Window`/`Dialog`/`Desktop` like any focusable view; no
  overlay/capture needed.
- **Core theme (core):** the additive `cpOutlineViewer` roles extend the same `Theme` the frame/menu/
  status/controls/list read; `defaultTheme` stays the single source of truth.
- **Kitchen-sink (examples):** the `Tree` gets a story; `demo:tree` is the headless walkthrough. (When the
  showcase navigator wants a tree view, this is the component it upgrades to — future dogfooding.)

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-141** — concrete reactive `TreeNode<T>` (plain data + view-owned reactive expand Set), not TV's abstract accessor model.
- **AR-142** — ←/→ collapse/expand (modern override) while keeping faithful `+`/`-`/`*` + ↑↓ nav.
- **AR-143** — eager in-memory children now; lazy-load-on-expand deferred.
- **AR-144** — single-select (faithful) now; checkbox/multi-select deferred.
- **AR-145** — reuse the RD-11 virtual-scroll helpers + own `ScrollBar`, with a Tree-specific row renderer (fidelity requires it; TV `TOutlineViewer` is a `TScroller` subclass).
- **AR-146** — faithful `│├└─` + `+`/`─` glyphs (no brackets) + two-tone collapsed text; widths + colors decoded at plan GATE-1.
- **AR-147** — `focused`/`selected`/`command` binding mirrors `ListView` (TV `cmOutlineItemSelected`).
- **AR-148** — new `src/tree/` subsystem, explicit named re-exports.
- **AR-149** — additive faithful `cpOutlineViewer` theme roles, decoded at plan GATE-1.
- **AR-150** — kitchen-sink `Tree` story + headless `demo:tree`.

> **Traceability:** AR-141…AR-144 are explicit user choices (RD-15 `make_requirements` gate, 2026-07-02);
> AR-145…AR-150 are single-dominant / source-determined decisions (the fidelity directive, the AR-106
> list model, the AR-133 subsystem convention, the AR-97 additive-role pattern, the AR-98/114 demo pattern)
> recorded for traceability.

---

## Security Considerations

> RD-15 adds a **tree/outline** widget over the existing in-process TUI. No network, no persistence, no new
> untrusted external surface. The input boundaries are keystroke/mouse → view state and node text → screen:
- All draws (graph prefix, node text) route through the RD-03 `DrawContext` → `ScreenBuffer` + core
  `sanitize` boundary; `getText` output is sanitized like any other cell text (no raw escapes from node
  strings reach the terminal).
- The flattened visible-node list and the virtual-scroll row access are **bounds-checked** (`clampIndex`,
  RD-11) — no out-of-range indexing regardless of expand state; the focused index is clamped to the current
  flattened length.
- Expand/flatten operates over the **in-memory, bounded** node tree (eager, AR-143); a pathological deeply
  nested tree is bounded by the caller-supplied data (no unbounded recursion beyond the provided depth —
  the flatten is iterative/depth-guarded).

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode (TV `toutline.cpp` + `outline.h` is the
drawing/behavior oracle).

- **AC-1** (`Tree` flatten + virtual scroll) — a `Tree<T>` over a nested `TreeNode<T>` renders only the
  visible (expanded) rows in view via the row renderer (not the whole tree); ↑↓ move `focused`, PgDn pages,
  the focused row stays visible, and the owned `ScrollBar` reflects position. *(AR-141/AR-145)*
- **AC-2** (faithful graph prefix) — each row draws the `graphChars` prefix (`toutline.cpp:367`): `│` for
  continued ancestor levels, `├`/`└` for non-last/last children, `─` fillers, a bare **`+`** for a
  collapsed node with children and **`─`** for an expanded one — no `[+]`/`[-]` brackets — asserted against
  the buffer pre-`serialize`. *(AR-146)*
- **AC-3** (two-tone collapsed text) — a collapsed node's text draws in the *not-expanded* color while an
  expanded node's text uses the focus/select/normal color per the row state (TV `drawTree`
  `color`/`color>>8`). *(AR-146)*
- **AC-4** (expand/collapse keys) — `+` expands the focused node, `-` collapses it, `*` expands the whole
  subtree; the flattened visible list grows/shrinks accordingly and `focused` stays valid. *(AR-142/AR-143)*
- **AC-5** (arrow semantics) — ↑↓ move focus ±1; **← collapses** the focused node (or moves to its parent
  when already collapsed) and **→ expands** it (or descends to the first child when already expanded).
  *(AR-142)*
- **AC-6** (mouse) — a click focuses the clicked row; a click within the graph-prefix width toggles that
  node's expand state; a double-click emits the select command. *(AR-142/AR-147)*
- **AC-7** (single-select + emit) — Enter or double-click sets `selected` and emits the select command (TV
  `cmOutlineItemSelected`); `focused` and `selected` are two-way signals a caller can bind. *(AR-144/AR-147)*
- **AC-8** (generic `TreeNode<T>`) — the Tree renders `getText(node.value)`; updating the tree
  `Signal`/expand Set re-flattens and repaints the visible rows; user node data carries no reactive
  wrappers (expand state lives in the view). *(AR-141)*
- **AC-9** (theme roles) — `defaultTheme` exposes the additive outline normal/focus/select/notExpanded
  roles with `cpOutlineViewer`-decoded colors; `encode()` of each does not throw; they are the only new
  core role symbols. *(AR-149)*
- **AC-10** (faithful geometry) — the graph glyphs, indent/end widths, and row layout match `toutline.cpp`
  (asserted against the buffer pre-`serialize`). *(fidelity directive)*
- **AC-11** (packaging) — the Tree lives in `packages/ui/src/tree/` with explicit named re-exports from
  `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines. *(AR-148)*
- **AC-12** (story + demo) — the `Tree` has a kitchen-sink story passing the headless smoke test;
  `demo:tree` runs headless with an ASCII frame per step (expand → navigate → collapse → select). *(AR-150)*
- **AC-13** (security) — node text is sanitized to the screen; flattened-row access is bounds-checked; the
  eager flatten is depth-bounded by the caller-supplied tree. *(security standard)*

---

> **Next step:** run the make_plan skill on RD-15 to produce the implementation plan (spec-first: spec
> oracles RED → implement → GREEN → impl tests), **reading the TV source first** per the fidelity directive
> (`TOutlineViewer`/`TOutline` — GATE 1 decode of `draw`/`createGraph`/`getGraph`/the `getColor` chain in
> the `03-NN-*.md` spec + the BEFORE/AFTER gate tasks in `99-execution-plan.md`); optionally preflight,
> then exec_plan. RD-15 is sibling 2 of the RD-12+ set (AR-126); RD-16 (Table/DataGrid) is next in the
> drafting queue.
