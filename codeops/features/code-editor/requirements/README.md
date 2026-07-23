# Code Editor — Requirements

> **Project**: JSVision
> **Feature**: Terminal-native CodeEditor and CodeEditorWindow
> **Status**: Approved — RD-01 through RD-06
> **Created**: 2026-07-23
> **CodeOps Artifact Schema**: 1

---

## Overview

The Code Editor feature adds a modern source-code editor to JSVision without turning the framework
into an IDE. It provides an embeddable `CodeEditor` and a ready-made `CodeEditorWindow`, while host
applications retain responsibility for files, workspaces, multiple editor instances, language
servers, and cross-document effects.

The editor is terminal-native and browser/DOM-independent. Version 1 supports PostgreSQL SQL,
JavaScript, and TypeScript; local syntax and structural assistance; industry-standard LSP
integration; terminal-safe rendering of hostile content; bounded degraded operation; and a
standalone comprehensive kitchen-sink in `@jsvision/examples`.

The prior Code Editor draft is preserved under `codeops/_archive/code-editor/` as historical
evidence and is not authoritative for this requirement set.

## Scope

### Version 1

- Embeddable `CodeEditor` and ready-made `CodeEditorWindow`.
- One in-memory document per editor; hosts compose multiple editors for multiple files.
- Host-mediated open, save, save-as, dirty-close, external-change, navigation, and cross-document
  edit workflows.
- PostgreSQL SQL, JavaScript, TypeScript, and plain-text modes.
- Syntax highlighting, line numbers, status, folding, brackets, indentation, comments, and
  search/replace.
- Completion and safe snippets, caret hover, signature help, diagnostics, go-to navigation,
  document symbols, document/range formatting, and opt-in format-on-save.
- Caller-provided LSP session; optional separate runtime process adapter.
- Read-only mode, keyboard-complete operation, narrow/monochrome/ASCII degradation, Unicode and
  protocol-position correctness.
- Explicit document-size tiers, responsiveness budgets, hostile-terminal sanitation, bounded
  resource use, and failure isolation.
- A standalone Code Editor kitchen-sink plus a concise story in the repository-wide kitchen-sink.
- Application-derived syntax and editor theming with explicit editor/application overrides,
  contrast validation, capability downsampling, and independent editor palettes.

### Deferred

- Multiple carets/selections.
- Word wrapping.
- Workspace symbols.
- Rename.
- Code actions.
- Semantic tokens.

### Excluded

- Bash language support.
- Editor-owned files, workspaces, language-server processes, database connections, credentials, or
  cross-document mutation.
- Browser/DOM, Electron, VS Code extension, or graphical IDE runtime dependencies.

## Domain Glossary

| Term | Definition |
|------|------------|
| **CodeEditor** | Embeddable terminal-native component that edits one in-memory source document. |
| **CodeEditorWindow** | Ready-made JSVision window containing a configured CodeEditor and standard editor chrome. |
| **Document revision** | Monotonic identity for a particular document-text state; asynchronous results must match it before affecting the editor. |
| **LanguageAdapter** | Versioned, host-registered language contract whose local parser and LSP capabilities are independently optional. |
| **LSP session** | Caller-provided Language Server Protocol 3.18 JSON-RPC boundary; it may be shared by multiple editor instances. |
| **Runtime adapter** | Optional integration that owns language-server process spawning, transport, supervision, initialization, reconnect, and shutdown. |
| **Host effect** | Save, close, external-change, cross-document navigation/edit, or command request that the editor emits for its containing application to authorize and perform. |
| **Plain mode** | Fully editable state without an active parser or language-service capability. |
| **Degraded mode** | Visible state in which an optional parser or language service failed or exceeded a bound while core editing remains available. |
| **Visual column** | Terminal cell position after accounting for tabs, combining characters, and wide graphemes; distinct from document and protocol offsets. |
| **Safe Markdown** | Bounded terminal-only subset of LSP Markdown with no raw HTML, images, embedded resources, or executable behavior. |
| **Kitchen-sink** | Standalone examples application that interactively demonstrates every version 1 editor facet through deterministic fixtures and a simulated LSP session. |
| **CodeEditorTheme** | Dedicated resolved palette layered over the application Theme; it covers editor surfaces, syntax categories, decorations, diagnostics, and assistance UI. |

## Document Index

| Document | Title | Status | Depends On |
|----------|-------|--------|------------|
| [Ambiguity Register](00-ambiguity-register.md) | Original Zero-Ambiguity Gate and decision provenance | Resolved (24/24) | — |
| [Theme Decision Extension](01-theme-ambiguity-register.md) | Hybrid editor-theme model | Resolved (1/1) | Original register |
| [RD-01](RD-01-editor-surface-and-document-lifecycle.md) | Editor Surface and Document Lifecycle | Approved | — |
| [RD-02](RD-02-local-language-features.md) | Local Language Features | Approved | RD-01 |
| [RD-03](RD-03-language-server-intelligence.md) | Language Server Intelligence | Approved | RD-01, RD-02 |
| [RD-04](RD-04-quality-security-and-operability.md) | Quality, Security, and Operability | Approved | RD-01, RD-02, RD-03 |
| [RD-05](RD-05-code-editor-kitchen-sink.md) | Code Editor Kitchen-Sink | Approved | RD-01, RD-02, RD-03, RD-04 |
| [RD-06](RD-06-theme-and-syntax-presentation.md) | Theme and Syntax Presentation | Approved | RD-01, RD-02, RD-03, RD-04 |

## Dependency Graph

```text
RD-01 Editor surface and lifecycle
  └── RD-02 Local language features
        └── RD-03 Language-server intelligence
              └── RD-04 Quality, security, and operability
                    ├── RD-06 Theme and syntax presentation
                    └── RD-05 Standalone and repository kitchen-sinks
```

RD-04 constrains the implementation of RD-01 through RD-03 even though it is shown after them for
specification-first execution. RD-06 is implemented before RD-05 so the final showcase uses the
completed theme surface rather than demo-only styling.

## Suggested Implementation Order

| Phase | Requirements | Outcome |
|-------|--------------|---------|
| A — Architecture probes | RD-01–RD-04 constraints | Evidence-backed choices for text storage, rendering, parsers, LSP session, bounds, and dependencies |
| B — Document core | RD-01 | Embeddable/window surfaces, revisions, commands, host I/O, search, status, read-only |
| C — Local language support | RD-02 | Open adapters and launch-language parsing/presentation |
| D — Language intelligence | RD-03 | Revision-safe LSP lifecycle and version 1 intelligence |
| E — Quality closure | RD-04 | Performance, security, accessibility, failure, packaging, and full verification gates |
| F — Theme presentation | RD-06 | Application-derived and independent palettes, syntax roles, contrast and capability fallbacks |
| G — Showcase | RD-05 | Comprehensive standalone demo, global story, smoke and E2E evidence |

## Confirmed Architecture Boundaries

| Decision | Requirement |
|----------|-------------|
| Editor, not IDE | Host owns multiple files/editors, workspaces, and application chrome |
| One document per component | Multiple files are multiple CodeEditor instances |
| Host-owned I/O | Editor never reads or writes files directly |
| Open language integration | Hosts explicitly register versioned LanguageAdapters |
| Standard intelligence protocol | LSP 3.18 over a caller-provided, optionally shared session |
| Separate process concern | Optional runtime adapter owns server process and transport lifecycle |
| Host-authorized cross-file effects | Editor never silently opens or mutates another resource |
| Independent degradation | Parser/LSP failures never remove core editing, save, or close |
| Terminal security boundary | All source, host, adapter, and protocol presentation is untrusted |
| Hybrid editor theming | Dedicated CodeEditorTheme follows the application by default and accepts explicit overrides |
| Implementation remains open | CodeMirror/Lezer or other headless internals require planning evidence; no library is mandated here |

## Planning Entry

Use this complete six-document set as the source for one integrated Code Editor implementation
plan. Planning must begin with the required architecture and performance probes, preserve all
acceptance criteria as specification-test inputs, and finish with the standalone kitchen-sink
rather than planning each RD as an isolated feature.
