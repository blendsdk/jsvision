# RD-03: Editor view features (`@jsvision/editor`)

- **Priority:** Must
- **Depends on:** RD-01 (seam + roles), RD-02 (`@jsvision/lang`), #101 (editor lives in `@jsvision/editor`)
- **Status:** Drafted

## Summary

The visible half: the code-grade features rendered by the extracted **`@jsvision/editor`** view —
syntax highlighting, a line-number + fold gutter, tree-based folding, bracket matching,
comment-toggle, and selection-aware Tab indent/dedent — plus the **large-file soft-cap** that
degrades to the plain editor. The editor accepts an optional `LanguageProvider` (RD-01/02); with none,
it behaves exactly as today plus line numbers and indent-based folding (all zero-dep). This RD changes
the editor's own draw and event handling; it does **not** touch the `EditWindow` frame geometry
(scroll bars + indicator keep their decoded rects).

## Functional requirements

### FR-3.1 — Opt-in language wiring *(AR-01, AR-02)*
The editor accepts an optional `LanguageProvider`; when set, it builds a `Tokenizer` + `FoldProvider`
over a gap-buffer-backed `DocReader` and enables highlighting + tree folding. When unset, none of the
Lezer paths run (the editor is the plain editor + gutter + indent-fold).

### FR-3.2 — Highlight render integration *(AR-03)*
`drawEditor` (today `drawEditor(ed, ctx, normalRole, selectedRole)`, splitting runs only on the
`selected` boundary — `editor-draw.ts:24`) is extended to split each visible line into runs on both
`selected` **and** `bucket` boundaries: for each cell it resolves the highlight bucket (from
`Tokenizer.highlight` over the visible range) → the syntax role → `ctx.color(role)`; selection colour
still wins where a cell is selected. Regions the parse hasn't reached yet (`pending()`) draw with the
default `editorNormal` role and repaint as the parse fills in (AR-04 progressive).

### FR-3.3 — Gutter & line numbers *(AR-05)*
A gutter is drawn as part of the editor's own paint: **fixed left columns** that scroll vertically
with the text but are **not** horizontally scrolled. Layout `[ line-number | fold-col | 1 pad | text ]`.
Width is **dynamic-fit** = `digits(maxLineNumber) + 1 (fold) + 1 (pad)`, recomputed as the line count
crosses powers of ten. The **current line's number** is drawn in `gutterActive`, others in `gutter`.
Line numbers are **on by default** with a toggle option.

### FR-3.4 — Geometry reconciliation *(AR-05)*
- The editor's **text area width = `viewW − gutterWidth`**; the horizontal-scroll extent (`hBar`
  range over `MAX_LINE_LENGTH`) and `formatLine` start column are computed against the text area, not
  the full interior.
- `editorMousePtr` (`editor-draw.ts:134`) subtracts the gutter width before mapping a click to a
  buffer position; clicks inside the fold column route to fold-toggle (FR-3.6), not to caret motion.
- The `EditWindow` scroll-bar/indicator rects (`edit-window.ts:119-121`) are **unchanged** — the
  gutter lives inside the editor's existing `{x:1..w-2}` interior.

### FR-3.5 — Folding model & rendering *(AR-06)*
- A folded region collapses to its **header line**, drawn with a trailing `⋯` badge; the hidden rows
  are **removed from the row flow** (row iteration skips folded interiors, so scroll math and mouse
  mapping operate on visible rows).
- The gutter fold column shows `▾` on an expanded foldable header and `▸` on a collapsed one; other
  lines show nothing there.
- Fold state is per-editor and survives edits that don't invalidate the region.

### FR-3.6 — Fold interaction *(AR-06)*
- **Primary:** clicking a `▾`/`▸` marker in the gutter toggles that region; menu commands
  **Fold**, **Unfold**, **Fold All**, **Unfold All** operate at the caret / whole document.
- **Secondary (keyboard):** fold/unfold bindings are added by **extending the Ctrl-K block prefix
  table** (`keymap.ts` — free follow-up letters), reusing the existing prefix machinery; this is a
  deliberate new-feature extension of the WordStar block table (AR-12).

### FR-3.7 — Bracket matching *(AR-01, AR-09)*
When the caret is on or beside a bracket, its match is located (via the parse tree when a language is
active, else a scan) and both cells are painted with the transient `bracketMatch` role. No effect when
there is no match.

### FR-3.8 — Comment-toggle *(AR-01, AR-11)*
A **menu command** toggles line comments on the selected lines (or the caret line) using the active
`LanguageProvider`'s comment syntax (RD-02 FR-2.9); `Ctrl-/` is bound as a **best-effort** accelerator
where the terminal delivers it (never the sole path). Disabled/no-op when the language has no comment
syntax (JSON) or no language is active.

### FR-3.9 — Tab / Shift+Tab indent *(AR-06)*
- With a selection spanning ≥1 line: **Tab indents** every selected line by the indent unit,
  **Shift+Tab dedents**. With no multi-line selection: Tab inserts the indent unit at the caret
  (today's fall-through behaviour — `keymap.ts` leaves Tab unbound). This is additive.
- The **indent unit is configurable** (default = a tab character, honouring the existing 8-col tab
  model); a spaces option is available. Auto-indent (existing `toggleIndent`, `editor-actions.ts:168`)
  is unchanged.

### FR-3.10 — Large-file soft-cap & degrade *(AR-04, AR-10, AR-19)*
Above the soft-cap threshold (its **value** set by the RD-04 probe, AR-19), the editor **does not
build a `Tokenizer`/tree-`FoldProvider`**: syntax highlighting and tree-based folding are disabled and
a visible indicator notes the degraded state. The **zero-dep features stay on** — line numbers, the
gutter, and the indent-based default folder (FR-3.11). Crossing the threshold (e.g. via load) is
handled without a crash or a blocked frame.

### FR-3.11 — Indent-based default folder *(AR-06, AR-10)*
`@jsvision/editor` ships a **zero-dep `FoldProvider`** that derives fold ranges from leading-indent
structure, used when no `LanguageProvider` is active or above the soft cap — so the gutter always
offers basic folding without `@jsvision/lang`.

### FR-3.12 — Kitchen-sink stories *(AR-01; Kitchen-sink gate)*
Live stories in the kitchen-sink showcase for a **JSON** editor and a **TS/JS** editor, each showing
highlighting, the gutter, folding (gutter-click), and a bound-state hint; both pass the headless smoke
test.

## Acceptance criteria

- [ ] With `javascriptLanguage` wired, a TS buffer renders keyword/type/function/string/comment/number/punctuation in their roles; selection colour still overrides on selected cells; scrolling repaints correctly.
- [ ] With no `LanguageProvider`, the editor renders plain text **plus** line numbers and indent-based folding, and passes existing editor spec tests unchanged.
- [ ] The gutter width fits the max line number (grows at 1000/10000 lines); the current line's number uses `gutterActive`; a click at text column 0 lands on buffer column 0 (gutter offset correct); a click in the fold column toggles the fold, not the caret.
- [ ] Folding a JSON object collapses it to `{ … ⋯`, removes the interior rows from scrolling/among mouse targets, and the `▸`/`▾` marker reflects state; Fold All / Unfold All work from the menu.
- [ ] Bracket matching paints both cells with `bracketMatch` when the caret is beside a bracket; nothing when unmatched.
- [ ] Comment-toggle (menu) comments/uncomments the selected TS lines with `//`; it is a no-op for JSON; `Ctrl-/` triggers it where delivered.
- [ ] Tab indents a multi-line selection, Shift+Tab dedents; Tab with no selection inserts the indent unit; the unit is configurable.
- [ ] Above the soft cap, highlighting + tree-folding are off with an indicator, while line numbers + indent-folding remain; no frame is blocked crossing the threshold.
- [ ] The JSON and TS/JS kitchen-sink stories exist, are registered, and pass the smoke test; public symbols carry JSDoc + `@example`; `check:docs` passes.

## Out of scope
Multiple cursors (#104), word-wrap (#105) — v1 keeps single-caret + horizontal scroll (AR-08);
autocomplete (#106), diagnostics/LSP (#107). The seam types (RD-01) and Lezer engine (RD-02). The
`@jsvision/editor` extraction itself (#101).

## Traceability
AR-01, AR-02, AR-03, AR-04, AR-05, AR-06, AR-08, AR-09, AR-10, AR-11, AR-12, AR-19.
