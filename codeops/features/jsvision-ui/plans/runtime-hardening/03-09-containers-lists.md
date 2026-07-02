# Containers & Lists Hardening: Runtime Hardening (RD-13)

> **Document**: 03-09-containers-lists.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-49, HR-50, HR-51, HR-53, HR-61, HR-62 (TV fidelity)
> **Files**: `packages/ui/src/scroll/{scroll-bar.ts,scroller.ts}`, `list/list-rows.ts`

> **TV-fidelity gate applies to every item** — BEFORE-decode/AFTER-diff task pairs in the execution
> plan; the citation index below carries the audit's cites, re-verified at BEFORE-decode time.

## TV decode (GATE 1) — citation index

| HR | Original behavior | Source cite |
|----|-------------------|-------------|
| HR-49 | track click: `default:` case jumps the thumb to the mouse position and follows the drag | `tscrlbar.cpp:181-208` |
| HR-50 | focused row keeps `getColor(4)`/selected color while the list is unfocused | `tlstview.cpp:86-130,208-211` |
| HR-51 | `<empty>` drawn at column 1 | `tlstview.cpp:147-148` |
| HR-53 | single-column list sets bar `pgStep = size.y - 1` | `tlstview.cpp:48-52` |
| HR-62 | click below the last row clamps to the last item | `tlstview.cpp:185-195` |

## Implementation Details

### HR-49 — Track click = jump-to-position + drag
**Defect** (`scroll-bar.ts:225-236`): a page-area click page-steps. **Fix**: a mouse-down on the
track jumps the thumb (value) to the clicked position and enters the existing thumb-drag capture
path so the pointer keeps driving it (`tscrlbar.cpp:181-208`). The **keyboard** page-step path
(PgUp/PgDn and wheel) is unchanged. The value↔position mapping reuses the bar's existing
proportional math in reverse.

### HR-50 — Unfocused list keeps the focused-row highlight
**Defect** (`list-rows.ts:175`): the focused-row highlight vanishes when focus leaves the list.
**Fix**: when the list is not focused, the focused row draws in the `listSelected` role (TV
`getColor(4)`), with `listFocused` reserved for the focused-list state — the existing
`listFocused > listSelected > listNormal` precedence gains the unfocused branch
(`tlstview.cpp:86-130,208-211`).

### HR-51 — `<empty>` at column 1
**Defect** (`list-rows.ts:159`): drawn at column 0. **Fix**: draw at column 1, matching every other
row's text inset (`tlstview.cpp:147-148`).

### HR-53 — Page step is `size.y - 1`
**Defect** (`list-rows.ts:154` passes `rows`). **Fix**: the owned bar's `pgStep` is `size.y - 1`
(`tlstview.cpp:48-52`), so a page keeps one row of context.

### HR-61 — Scroller corner cell reserved
**Defect** (`scroller.ts:135-137`): with both bars, the SE corner cell shows content. **Fix**: in
both-bars mode the 1×1 corner is excluded from the content viewport and painted in the bar
background role — content never renders there.

### HR-62 — Click below the last row clamps
**Defect** (`list-rows.ts:200` guards `newItem < length` and ignores the click). **Fix**: a click
in the blank space below the last row focuses/selects the **last** item (`tlstview.cpp:185-195`
clamp). Empty list stays a no-op.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Track click with a zero-range bar | value unchanged; no drag entered | RD HR-49 (pinned; degenerate range already guarded in the bar) |
| Click below rows of an empty list | no-op | RD HR-62 (pinned) |

## Testing Requirements

- Spec oracles ST-8.n–s ([07-testing-strategy.md](07-testing-strategy.md)); conflicting existing
  oracles corrected against the cited `.cpp` (fidelity exception, AC-8).
- GATE-2 AFTER-diff per component (`TScrollBar`, `TListViewer`, `TScroller` corner) recorded in
  code/commit.
- Impl tests: jump+drag across the full track incl. ends; highlight precedence matrix
  (focused/unfocused × selected/normal); corner cell across resize.
