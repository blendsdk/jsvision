# Code Editor internationalization implementation plan

> **Feature**: Explicit `@jsvision/i18n` integration and localized Code Editor presentation
> **Status**: Planning Complete
> **Created**: 2026-07-26
> **CodeOps Artifact Schema**: 1

## Overview

This plan implements the independently deliverable portion of GitHub issue #184 after the i18n and
Code Editor feature branches merged to `develop`. It adds one canonical Code Editor catalog,
official locale entry points, explicit service injection, localized editor-owned presentation, and
the repository tooling, documentation, and plugin support needed to treat Code Editor as a
first-class localized SDK package.

The controller and document model remain locale-neutral. Existing English fields and construction
stay compatible while view-boundary projectors render translated wrappers. A visible bounded
find/replace surface completes the presentation required by #184 without changing deterministic
literal search. The comprehensive geometry sweep, shared sizing primitives, `demo:i18n` harness,
Code Editor story registration, and combined viewport certification remain owned by the subsequent
#185 plan per AR-1, AR-8, and AR-13.

## Document index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Owning scope and acceptance criteria |
| 02 | [Current State](02-current-state.md) | Grounded implementation analysis |
| 03-01 | [Catalog and Injection](03-01-catalog-and-injection.md) | Catalog, service, export, and fallback design |
| 03-02 | [Presentation Boundary](03-02-presentation-boundary.md) | Structured wrappers, search chrome, and display width |
| 03-03 | [Tooling, Docs, and Plugin](03-03-tooling-docs-plugin.md) | Repository-wide package registration and support surfaces |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered task checklist |

## Quick reference

### Application-owned service

```ts
import { CodeEditorWindow, createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { createI18n, defineCatalog } from '@jsvision/i18n';

const applicationOverrides = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: { 'code-editor.window.title': 'Broneditor' },
});
const i18n = createI18n({ locale: 'nl', catalogs: [codeEditorNl, applicationOverrides] });
const controller = createCodeEditorController({
  document: createDocumentModel({ text: '', languageId: 'typescript' }),
});
const editorWindow = new CodeEditorWindow({ controller, i18n });
```

### Key decisions

| Decision | Outcome |
|---|---|
| Ownership | `CodeEditor`/`CodeEditorWindow` own `I18n`; controller semantics remain locale-neutral (AR-3, AR-4) |
| Compatibility | Additive metadata and pure projectors preserve existing English fields (AR-3, AR-7) |
| Search | Existing semantic state gains bounded localized inline presentation (AR-2) |
| Layout | Code Editor display-cell correctness now; complete cross-package sweep in #185 (AR-8) |
| Locale exports | Shared generator and checks become configuration-driven for five packages (AR-9) |
| Human review | Catalogs are review-ready; proficient approval is never fabricated (AR-12) |

## Related files

- `packages/code-editor/src/i18n/`
- `packages/code-editor/src/locales/`
- `packages/code-editor/src/ui/`
- `packages/code-editor/src/controller-overlay.ts`
- `packages/code-editor/src/degradation.ts`
- `packages/code-editor/src/languages/invisibles.ts`
- `packages/code-editor/package.json`
- `scripts/update-i18n-locales.mjs`
- `scripts/check-i18n-literals.mjs`
- `scripts/check-i18n-reviews.mjs`
- `tools/i18n-*.json`
- `packages/i18n/test/`
- `packages/docs-site/`
- `tools/jsvision-skill/`
- `tools/jsvision-plugin-impact.json`
