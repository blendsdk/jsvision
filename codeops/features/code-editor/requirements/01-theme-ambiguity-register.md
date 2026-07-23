# Code Editor Theme — Ambiguity Register Extension

> **Status**: ✅ GATE PASSED — 1/1 item resolved
> **Created**: 2026-07-23
> **Parent Register**: 00-ambiguity-register.md
> **CodeOps Artifact Schema**: 1

This extension records a requirement added after approval of the original 24-item discovery set.
It preserves the revisions of the approved original decisions while extending the same
Zero-Ambiguity Gate.

| ID | Category | Ambiguity | Viable options | Resolution | Status |
|----|----------|-----------|----------------|------------|--------|
| AR-25 | Product presentation | Relationship between application themes and editor syntax colors | Extend every global `Theme` with syntax roles / independent editor scheme / application-derived editor palette with explicit override | Hybrid: derive `CodeEditorTheme` from the active JSVision `Theme` by default; allow an explicit partial or complete editor-theme override per editor or application | ✅ Resolved |

## Decision Detail

### AR-25 — Hybrid CodeEditor theme model

- **Authority**: User
- **Decision**: The editor follows the active application theme by default through a derived,
  dedicated `CodeEditorTheme`. A host may provide a partial or complete editor-specific override,
  including an independent color scheme.
- **Rationale**: Default visual coherence must not prevent IDE-style source palettes or application
  customization. A dedicated layer avoids expanding the closed global `Theme` with every syntax
  and editor-decoration role.
- **Consequences**:
  - adapters emit stable semantic categories rather than terminal colors;
  - theme changes restyle existing presentation without reparsing or changing document state;
  - partial overrides use deterministic fallback chains;
  - terminal depth and monochrome behavior remain governed by JSVision capability handling; and
  - the standalone kitchen-sink demonstrates application-derived and independent editor schemes.
