# Task T-02: Code Editor viewport and mouse interaction

> **Type**: Task (lightweight) · **Feature**: code-editor · **CodeOps Artifact Schema**: 1
> **Progress**: 6/6 tasks (100%)
> **Last Updated**: 2026-07-24 20:18
> **Phase baseline tree**: 9286332c3acd46e6c843728775757bdd5fef6e23

## Objective

Make the terminal-native Code Editor behave like a modern editor when its viewport changes:
scrollbars must reflect visual content, manual and automatic scrolling must repaint correctly,
the caret must remain visible while editing or navigating, mouse gestures must place and extend
the selection, and Ctrl+/ must reach the editor through the real terminal decoder.

## Scope and delegated design decisions

- Keep the reusable `CodeEditor` responsible for viewport state, clamping, caret-follow behavior,
  wheel handling, and cell-to-document mapping. Keep `CodeEditorWindow` responsible only for
  laying out chrome and presenting scrollbar ranges.
- Follow the caret with the smallest necessary scroll adjustment after typing, editing, keyboard
  navigation, selection commands, completion acceptance, undo/redo, search navigation, mouse
  placement, and viewport resize. Manual wheel or scrollbar scrolling may temporarily move the
  caret off-screen until the next caret-changing action.
- Compute horizontal overflow in terminal visual columns, including tabs and wide characters,
  against the text width after any line-number gutter. Compute vertical overflow from logical
  lines. Clamp both axes whenever content or viewport dimensions change.
- Bind both scroll signals to editor repainting. Synchronize scrollbar ranges after edits,
  scrolling, line-number width changes, and resize without scanning the full document on every
  painted cell.
- Use the established JSVision interaction model: wheel steps three cells, mouse-down captures the
  pointer, drag extends the selection, dragging past an edge scrolls one cell per event, and
  mouse-up releases capture.
- A double-click selects the source-code run under the pointer. Identifier characters use Unicode
  letters/numbers plus `_` and `$`; punctuation selects its homogeneous run; whitespace places the
  caret without inventing a word selection.
- Decode the classic terminal byte `0x1f` as Ctrl+/ so the existing adapter-aware comment command
  works through the real event loop. Preserve the decoder's allowlist and malformed-input safety.
- Verify both reusable window resizing and the fixed-pane kitchen-sink terminal-resize path. The
  demo remains a tiled showcase; this task does not turn its panes into freely overlapping windows.
- Page navigation, minimaps, smooth/pixel scrolling, multi-selection, column selection, touch
  gestures, drag-and-drop, and new keyboard shortcuts remain out of scope.

## Specification cases

- **ST-01**: Increasing or decreasing a mounted editor window's rectangle re-fits the editor,
  both scrollbars, and status line to the new interior without stale or out-of-bounds cells.
- **ST-02**: Content taller or visually wider than the text viewport produces non-zero scrollbar
  ranges; editing or resizing updates those ranges and clamps stale offsets.
- **ST-03**: A scrollbar value change or wheel event changes the projected content and repaints
  the editor; horizontal and vertical directions affect only their matching axes.
- **ST-04**: Typing, Enter, arrows, word/document navigation, undo/redo, search, completion, and
  mouse placement minimally scroll the active caret back into the text viewport.
- **ST-05**: Single-click places the caret, captured drag selects across cells and lines, edge drag
  scrolls while extending, and release ends the gesture.
- **ST-06**: Double-click selects the complete identifier or punctuation run under the pointer,
  including Unicode identifiers and coordinates shifted by scrolling or a line-number gutter.
- **ST-07**: Raw input byte `0x1f` decodes to a Ctrl+/ key event and toggles comments through a
  mounted editor; unrelated C0 controls remain dropped.
- **ST-08**: Tabs, wide characters, hostile controls, narrow viewports, empty documents, very long
  lines, and large line counts remain bounded and never produce invalid offsets or terminal output.

## Auto-design record

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal viewport algorithms, event routing, terminal-byte mapping, testing
  strategy, and implementation sequencing within the user-approved interaction behavior.
- **Objective**: Restore correct, responsive, terminal-safe editor interaction without expanding
  the editor into an IDE or changing its single-selection product scope.
- **Decision**: Use an editor-owned viewport controller with window-owned passive chrome, visual
  column extents, minimal caret tracking, captured mouse gestures, and allowlisted `0x1f` decoding.
- **Evidence**: `CodeEditor` always supplies scroll offsets but does not observe them, its event
  handler ignores mouse and wheel events, `CodeEditorWindow` updates raw-length ranges only during
  layout, the existing UI Editor already proves the capture/wheel interaction model, and the core
  decoder currently drops `0x1f`.
- **Rejected alternatives**: Wrapping the editor in the generic `Scroller` would duplicate
  document-aware caret and selection logic; making the window own caret tracking would break the
  standalone editor; recomputing ranges per cell would threaten large-document responsiveness;
  enabling free-form demo panes would change the tiled showcase rather than fix resize behavior.
- **Strongest counterargument**: A dedicated viewport model adds state and synchronization paths.
  Keeping it editor-owned and exposing immutable metrics to passive chrome confines that
  complexity to the component that already owns caret and projection state.
- **Confidence**: High — the selected boundaries match existing JSVision editor, scrollbar,
  signal-binding, pointer-capture, and terminal-decoder patterns.
- **Hardening**: Forced reframing favored the smallest reusable boundary; a post-task independent
  correctness review and performance audit will challenge synchronization and large-document cost.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-viewport-mouse-2026-07-24`.
- **Reopen triggers**: Evidence that full-document visual extent scans violate the accepted
  document-size targets, terminal protocols that distinguish Ctrl+/ from Ctrl+_, or a future
  multi-selection contract.

## Tasks

- [x] T-02.1 `[spec-author]` Write immutable specification regressions for ST-01 through ST-08 in
  dedicated Code Editor, demo, and core decoder specification-test files.
  ✅ (completed: 2026-07-24 19:14; 9 new specification cases plus tiled resize coverage;
  package typechecks and diff checks passed)
- [x] T-02.2 Run the focused specification suites and record the expected red phase before changing
  implementation code.
  ✅ (completed: 2026-07-24 19:14; Code Editor 6 failed/2 passed, Core 1 failed, demo 18 passed)
- [x] T-02.3 Implement editor-owned viewport metrics, clamping, repaint bindings, caret-follow
  scrolling, and window range/resize synchronization; confirm the viewport specifications green.
  ✅ (completed: 2026-07-24 19:43; viewport specifications and the authoritative repository gate pass)
- [x] T-02.4 Implement wheel, click, captured drag, edge-autoscroll, double-click word selection,
  and allowlisted Ctrl+/ terminal decoding; confirm all interaction specifications green.
  ✅ (completed: 2026-07-24 19:43; interaction and raw-decoder specifications pass)
- [x] T-02.5 Add implementation edge coverage, strengthen the dedicated kitchen-sink resize and
  interaction scenarios, and refresh impacted plugin/documentation artifacts.
  ✅ (completed: 2026-07-24 19:43; implementation edges, showcase, docs, and plugin surfaces verified)
- [x] T-02.6 Run focused checks, `yarn plugin:check`, authoritative `yarn verify`, documentation and
  plan-reference self-checks, then complete the independent quality review and any accepted fixes.
  ✅ (completed: 2026-07-24 20:18; authoritative serial gate passed 34/34 tasks, plugin integrity
  passed, Code Editor passed 200/200 tests, and both independent review lenses closed without
  remaining Critical or Major findings)

**Verify**: `yarn verify`

## Quality review record

The delegated auto-design authority accepted every Critical/Major review finding for correction;
none were waived or deferred.

| Finding | Severity | Resolution |
|---------|----------|------------|
| RV-001 | Major | Unified projection, caret, mouse, and extent geometry around shared grapheme segmentation and display width; added em-dash, combining, and ZWJ regressions. |
| RV-002 | Major | Negative-x captured drag now bypasses the line-number gutter and maps to the newly exposed visual text edge. |
| PA-001 | Major | Added persistent per-line visual checkpoints, bounded visible-slice projection, arithmetic/local ASCII, tab, and independent-Unicode updates, and stable isolated performance gates. |
| PA-002 | Major | Complex-grapheme append optimization now proves the boundary with the complete prior final grapheme; unsafe ZWJ, RI, Prepend, and dependent-leading boundaries retain exact full measurement. |

Correctness re-review and performance closure validation report no remaining Critical or Major
findings. The Code Editor suite passes 200 of 200 tests, including one-million-cell ASCII/tab
fixtures, 500,000 wide characters, 500,000 combining-mark code units, and immutable reference
geometry comparisons through edit, undo, and redo.
