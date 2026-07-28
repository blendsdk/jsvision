# Requirements: Code Editor internationalization

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GitHub issue #184 and the sequencing decision recorded in AR-1

## Feature overview

Internationalize `@jsvision/code-editor` through the shared JSVision `I18n` service while
preserving existing English behavior, controller semantics, deterministic search, browser-safe
packaging, and exact caller/LSP content. The result must be an ordinary catalog consumer that
follows the injection, fallback, validation, export, documentation, and plugin conventions already
used by UI, Forms, Files, and Datagrid.

## Functional requirements

### Must have

- **FR-1 — Direct integration.** `@jsvision/code-editor` declares a direct runtime dependency on
  `@jsvision/i18n`. `CodeEditorOptions` and `CodeEditorWindowOptions` accept `i18n?: I18n`;
  `CodeEditor` exposes the resolved service, and the window forwards the exact resolved instance to
  its editor and chrome. Omission creates an isolated English Code Editor service. *(AR-4, AR-6)*
- **FR-2 — Catalog contract.** One canonical English catalog and complete `en`, `nl`, `de`, `fr`,
  `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv` catalogs use stable `code-editor.*` keys, strict key,
  message-kind, placeholder, safety, and accelerator parity, and explicit generated package
  subpaths. *(AR-9, AR-10, AR-15)*
- **FR-3 — Existing chrome.** The default window title, line/column labels, user-facing numeric
  formatting, diagnostic severity wrappers, degradation notices, and invisible-character warning
  labels resolve through the supplied service. Existing callers without configuration receive the
  historical English output. *(AR-3, AR-6)*
- **FR-4 — Search presentation.** Opening find or replace displays a bounded inline surface with
  localized field labels, match-count prose, case state, and action hints driven by existing search
  state. Search input, commands, matching, replacement, selection, and undo semantics remain
  unchanged. *(AR-2, AR-7)*
- **FR-5 — External content boundary.** Source text, query/replacement text, filenames, paths,
  language IDs, protocol IDs, command IDs, keybinding tokens, LSP completion/hover/signature/symbol
  content, and diagnostic detail remain untranslated. Terminal-safety normalization and limits
  continue to apply before any wrapper composition. *(AR-5, AR-11)*
- **FR-6 — View-boundary formatting.** Controller, document, search, degradation, and language
  detection state stay locale-neutral. Pure package-owned projectors accept `I18n` and map stable
  discriminants to messages. Existing exported English fields remain available for compatibility,
  while in-package visible paths use structured metadata and projectors. *(AR-3, AR-7)*
- **FR-7 — Display-cell correctness.** Assistance rows, translated diagnostic prefixes, search
  chrome, and status text measure and clip in terminal display cells without splitting wide glyphs
  or miscounting combining marks. Long overrides have deterministic bounded output. *(AR-8,
  AR-11)*
- **FR-8 — Package registration.** Locale generation, locale validation, literal ownership,
  translation-review loading, docs entry points, and relevant recipes recognize Code Editor from
  shared configuration rather than a handwritten parallel path. *(AR-9)*
- **FR-9 — Documentation and plugin.** Package and docs-site guidance shows application-owned
  injection, locale catalogs, overrides, and the editor-owned/external-content boundary. Canonical
  skill references and impact mapping cover Code Editor i18n; generated plugin output is
  synchronized. *(AR-9, AR-13)*
- **FR-10 — Lifecycle isolation.** Reconstructing an application with a new locale produces a new
  Code Editor service/view state with no retained search, assistance, modal, pending, or reactive
  state from the previous instance. No mutable process-global locale state is introduced.
  *(AR-3, AR-4)*

### Should have

- **FR-11 — Review readiness.** Every non-English Code Editor catalog has digest-bound review
  evidence, and review tooling expects the package once built. Evidence discloses whether its
  method is proficient-human or AI-assisted and never presents AI review as human proficiency.
  *(AR-12)*
- **FR-12 — Host accessibility formatters.** Pure degradation and invisible-warning projectors are
  exported so hosts can render the same localized accessible copy outside the built-in view without
  learning catalog keys. *(AR-3)*

## Technical requirements

### Compatibility

- Public additions are optional and source-compatible.
- `CodeEditorWindow.status` remains one-based numeric state.
- Existing overlay `items`, degradation `message`, and invisible warning `label` remain compatible
  English data for this release.
- Main-entry imports remain browser-safe and non-English catalogs remain opt-in subpaths.

### Security

- Catalog validation rejects terminal controls, unsafe Unicode, malformed placeholders, excessive
  content, and invalid accelerators.
- External content is never used as a catalog key or message template.
- Translation diagnostics remain bounded and contain no translated text, source, path, protocol
  detail, or sensitive content.
- No filesystem, network, process, credential, authentication, authorization, or persistence
  surface is added.

### Performance

- Drawing performs bounded work over visible rows and short catalog keys.
- Locale services and compiled messages use existing i18n caches; no per-cell service creation.
- Search matching and document projection retain their existing asymptotic behavior.

## Scope decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Delivery order | Code Editor i18n before the complete geometry sweep | AR-1 |
| Search UI | Add inline localized presentation backed by existing state | AR-2 |
| Locale ownership | Pure view-boundary projectors over structured state | AR-3 |
| Geometry boundary | Focused Code Editor safety now; cross-package certification later | AR-8 |
| QA harness | Owned by #185; no duplicate registry in this plan | AR-13 |

## Out of scope

- The #185 shared sizing APIs, complete dialog/dropdown/calendar/surface sweep, `demo:i18n`
  registry, Code Editor story registration, and combined ten-locale viewport matrix.
- Presenting AI-assisted review as proficient-human approval.
- Translating caller, source, path, filename, language/protocol, stable ID, persisted setting,
  telemetry, or keybinding identity data.
- Locale-sensitive source search or collation.
- Mutable global locale state.
- RTL/bidirectional layout, tracked by #30.
- A new translation abstraction or editor-specific change to the core i18n API.

## Acceptance criteria

1. `CodeEditor` and `CodeEditorWindow` accept and expose/forward the exact optional service, with
   isolated English fallback.
2. All ten explicit locale subpaths publish complete strictly valid `code-editor.*` catalogs.
3. Default title, status labels/numbers, search chrome, diagnostic severity, degradation, and
   invisible-warning wrappers localize through normal catalog precedence.
4. Application overrides win and invalid/missing entries fall back safely with bounded diagnostics.
5. External content remains normalized but otherwise untranslated.
6. Search matching, replacement, controller state, command IDs, and numeric status APIs are
   unchanged.
7. Code Editor assistance/search/status composition is display-cell correct for wide and combining
   glyphs and bounded under long overrides.
8. Browser main-entry and Node subpath isolation remain intact.
9. Locale/review/literal/docs/plugin tooling recognizes Code Editor without duplicated export
   generation.
10. Package documentation, docs site, canonical skill, generated plugin, package-local checks,
    `yarn plugin:check`, and `yarn verify` pass.
11. Digest-bound method-disclosed translation reviews pass; #185-owned QA integration remains an
    explicitly visible follow-up gate.
