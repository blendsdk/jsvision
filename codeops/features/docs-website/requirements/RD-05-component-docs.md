# RD-05: Component Documentation System

> **Document**: RD-05-component-docs.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-03 (live-example system)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

---

## Feature Overview

A **repeatable, consistent per-component documentation system** and its **full coverage** of the
public surface. Every component and primitive JSVision exports gets its own page built from a single
template: a one-line summary, a live example (Play), the props/options it takes, its keyboard/mouse
interactions (a TUI-specific **keyboard cheatsheet**), best-practices/gotchas, a **status badge**
(stable / experimental / planned), and links into the generated API reference. A **Components
overview** page presents the **component hierarchy** so readers see how the pieces relate (engine →
spine → containers → controls → families).

"Every component" is the full public barrel surface (~40 across `@jsvision/ui`, `@jsvision/files`, and
re-exported core primitives) — the coverage list the RD-09 gate enforces (AR-27).

---

## Functional Requirements

### Must Have

- [ ] **Per-component page template** with these sections, in order: **Summary** (what it is, one
      sentence) · **Live example** (RD-03 Play + snippet) · **Import** (the exact import line) ·
      **Props / Options** (a table of each option: name, type, default, description) · **Keyboard &
      Mouse** (a cheatsheet of chords/gestures the component handles) · **Best practices / gotchas**
      (e.g. "a `Text` with no `measure()` reflows to 0×0 — give it a layout") · **Status badge** ·
      **See also / API** (link to the generated reference symbol).
- [ ] **Full coverage** of the public surface, organized by family:
      - **Spine & shell**: View, Group, Window, Desktop/Application, MenuBar, StatusLine.
      - **Layout**: the layout DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`place`/`centered`/…).
      - **Reactivity**: signal, computed, effect, Show, For (concept-linked, with runnable snippets).
      - **Controls**: Text, Label, Button, Input, CheckGroup, RadioGroup, Slider, Switch.
      - **Containers**: ScrollBar, Scroller, ListView, ListBox, Dialog (+ messageBox/confirm/inputBox),
        ComboBox, History, Tree, DataGrid, TabView.
      - **Feedback**: ProgressBar, Spinner.
      - **Date**: Calendar, DatePicker. **Color**: ColorSwatch, ColorPicker.
      - **Surface**: Surface, SurfaceView. **Terminal**: Terminal.
      - **Files**: FileDialog, ChDirDialog, FileList, DirList, FileInput, FileInfoPane.
- [ ] **Component hierarchy** page: a diagram/tree of the families above and how a typical app nests
      them (Application → Desktop → Window → Group → controls), with links to each component page.
- [ ] **Status badges** driven by a single machine-readable source (e.g. a `components.json` mapping
      each symbol → `stable|experimental|planned`), so a badge is never hand-set inconsistently and
      RD-09's coverage gate reads the same list.
- [ ] Each page's **props table** is accurate to the exported `*Options` type (kept honest by linking
      to / cross-checking the API reference from RD-06).

### Should Have

- [ ] Cross-links between related components (e.g. `ListView` ↔ `ScrollBar` ↔ `Scroller`; `DatePicker`
      ↔ `Calendar`; `ColorPicker` ↔ `ColorSwatch`).
- [ ] A "variations" area on richer components (e.g. `Calendar` densities; `DataGrid` sort/scroll;
      `Tree` marker styles) each as its own small live example.
- [ ] A per-component "common patterns" snippet (e.g. two-way binding an `Input` to a `Signal`).

### Won't Have (Out of Scope)

- The generated symbol reference itself — RD-06 (this RD links to it).
- The Play/live mechanism — RD-03.
- The coverage-enforcing gate — RD-09 (this RD provides the coverage list + example registry it reads).

---

## Technical Requirements

- The page template is a documented markdown skeleton (+ optional Vue components for the props table
  and badge) so authoring a new component page is mechanical and consistent.
- The keyboard cheatsheet is authored from each component's actual keymap (derived from the source /
  the component's documented chords), not invented.
- `components.json`: `{ symbol, family, status, page, examples[] }` — the single source consumed by
  the overview page, the badges, and RD-09's gate. Adding a public export without a row fails the gate.
- Props tables SHOULD, where feasible, be generated or cross-checked against RD-06's TypeDoc output to
  avoid drift; at minimum they cite the option type name so a reader can jump to the generated symbol.

---

## Integration Points

### With RD-03 (live examples)
- Every component page embeds ≥1 example via Play + snippet; the examples live in the RD-03 registry.

### With RD-06 (API reference)
- Each page links to its symbol(s) in the generated reference; props tables reference the `*Options`
  types RD-06 documents.

### With RD-08 (reference & trust)
- The keyboard cheatsheets aggregate into a global shortcuts reference; theming-sensitive components
  link to the theme-role reference.

### With RD-09 (anti-drift)
- `components.json` + the example registry are the coverage inputs the `check:docs-site` gate enforces.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Coverage | Curated subset / full barrel (~40) | Full barrel surface | Meets "every component"; gate-enforceable | AR-27 |
| Keyboard cheatsheet | Skip / per-component | Per-component | TUI-specific, high value | AR-14 |
| Status source | Hand-set per page / one machine-readable file | `components.json` (single source) | Consistency; gate reads it | AR-27 |
| Props accuracy | Hand-written / linked to generated types | Cross-checked against RD-06 | Prevent drift | AR-7 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none (authored docs + live examples over the virtual FS).
- **Input validation / injection**: live examples inherit RD-03/RD-02 `sanitize()` protection; props
  tables and cheatsheets render escaped authored text.
- **Authentication / rate limiting / encryption / infra**: N/A beyond RD-01.
- **Coverage integrity**: `components.json` is the authority for what must be documented; RD-09's gate
  makes an undocumented public export a build failure — a governance control, not a runtime one.

---

## Acceptance Criteria

1. [ ] Every symbol listed in `components.json` has a page that renders all required template sections
       (Summary, Live example, Import, Props/Options, Keyboard & Mouse, Best practices, Status, API
       link) — verified by a structural test over the pages.
2. [ ] `components.json` contains a row for **every** public export of `@jsvision/ui` +
       `@jsvision/files` + the re-exported core primitives (the ~40 surface); a test comparing the
       barrels to `components.json` finds **no** export missing a row and no row without an export.
3. [ ] Each component page has at least one working live example (present in the RD-03 registry and
       passing the smoke test).
4. [ ] The Components overview page renders the hierarchy tree with a working link to each component
       page (link-check passes, no dead links).
5. [ ] Each page shows a status badge whose value equals the `status` in `components.json` for that
       symbol (stable/experimental/planned) — no page hard-codes a divergent badge.
6. [ ] A spot-check of three components (e.g. `Input`, `DataGrid`, `Calendar`) shows a props table
       whose option names match the exported `*Options` type, and a keyboard cheatsheet whose chords
       match the component's actual handled keys.
7. [ ] Security requirements verified: all example content on component pages is `sanitize()`-guarded
       (RD-03); props/cheatsheet content renders escaped.
