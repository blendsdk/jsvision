# Terminal UI and Theme: Code Editor

> **Document**: 03-05-terminal-ui-and-theme.md
> **Parent**: [Index](00-index.md)

## Overview

`CodeEditor` projects document/language/service state into terminal cells. `CodeEditorWindow`
composes it with scrolling and status. A dedicated resolved theme follows the application by
default and can be overridden or independent (AR-P11–AR-P16).

## Component composition

The view owns focus, input routing, caret placement, viewport, popup anchors, invalidation, and
commands. It delegates all text changes to document transactions. `CodeEditorWindow` owns standard
scrollbars/status only; embedding `CodeEditor` directly exposes the same behavior and public state.

Input precedence is implemented as a deterministic command-routing table derived from RD-01:
dismissal/modal UI, completion, snippets, editor commands, then text input. Read-only is enforced
again by the document boundary.

## Rendering pipeline

1. Query logical lines for viewport plus bounded overscan.
2. Map syntax, diagnostics, selection, snippet, bracket, search, active-line, and invisible
   decorations through the RD-06 precedence.
3. Validate and clip every span/coordinate.
4. Resolve semantic roles against terminal capabilities.
5. Draw through JSVision's safe cell API; never serialize source or service strings directly.

Narrow, monochrome, ASCII, resize, grapheme, tab, and wide-cell handling use the approved fallback
sequence without hiding the editable area or caret (AR-P11, AR-P13, AR-P14).

## Theme contract

```ts
interface CodeEditorTheme {
  readonly contractVersion: 1;
  readonly surfaces: CodeEditorSurfaceRoles;
  readonly syntax: Readonly<Record<SyntaxCategory, CellStyle>>;
  readonly structure: CodeEditorStructureRoles;
  readonly diagnostics: CodeEditorDiagnosticRoles;
  readonly assistance: CodeEditorAssistanceRoles;
}
```

Resolution copies validated own data properties, rejects getters/prototypes/excess depth, derives a
complete base from application Theme, applies bounded overrides/presets, validates contrast, and
downsamples capabilities. A theme change invalidates presentation only—never text, history,
parser, LSP, or assistance state (AR-P12–AR-P14).

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Invalid theme override | Reject offending values and resolve documented safe fallback | AR-P12, AR-P13 |
| Bad span/geometry/popup size | Drop or clip inside viewport; never corrupt adjacent cells | AR-P11, AR-P13 |
| Popup renderer fails | Dismiss popup, restore editor focus, expose bounded status | AR-P07, AR-P14 |
| Terminal lacks color/Unicode/space | Apply deterministic capability/narrow fallback | AR-P12, AR-P14 |

## Testing requirements

- Golden frames for presentation precedence, themes, capabilities, narrow layouts, and Unicode.
- Keyboard-only journeys and focus restoration for every popup/chooser.
- Theme fuzz/contrast/immutability tests proving zero parser/LSP work on changes.
- Terminal serialization corpus proving no active untrusted controls.
