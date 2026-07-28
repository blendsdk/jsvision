# Catalog and injection: Code Editor internationalization

> **Document**: 03-01-catalog-and-injection.md
> **Parent**: [Index](00-index.md)

## Overview

This component makes Code Editor an ordinary explicit consumer of `@jsvision/i18n`. It owns the
canonical English messages, locale modules, public accelerator topology, isolated fallback
service, and exact `CodeEditor`/`CodeEditorWindow` injection contract required by FR-1 through
FR-3 and FR-10.

## Architecture

### Catalog modules

Create:

- `src/i18n/catalog.ts` — `CODE_EDITOR_ENGLISH_CATALOG`,
  `CODE_EDITOR_ACCELERATOR_MANIFEST`, and `createEnglishCodeEditorI18n()`.
- `src/i18n/locales.ts` — one typed message shape and ten official catalog constants.
- `src/i18n/presentation.ts` — pure package-owned translation/projector helpers specified in
  03-02.
- `src/locales/<locale>.ts` — generated one-export subpath modules.

The main package entry exports the accelerator manifest and public projector helpers but no catalog
object or eager all-locale registry. Each `@jsvision/code-editor/locales/<locale>` subpath exports
exactly one named catalog constant. *(AR-9, AR-10, AR-15)*

### Canonical key inventory

The English catalog owns at least these stable keys:

| Family | Keys |
|---|---|
| Window/status | `code-editor.window.title`, `code-editor.status.line`, `code-editor.status.column` |
| Search fields/state | `code-editor.search.find`, `code-editor.search.replace`, `code-editor.search.matches`, `code-editor.search.case-sensitive`, `code-editor.search.case-sensitive.on`, `code-editor.search.case-sensitive.off` |
| Search hints/actions | `code-editor.search.action.next`, `code-editor.search.action.previous`, `code-editor.search.action.replace`, `code-editor.search.action.replace-all`, `code-editor.search.action.close` |
| Diagnostics | `code-editor.diagnostic.severity.error`, `.warning`, `.information`, `.hint` |
| Degradation | `code-editor.degradation.feature-unavailable`, `code-editor.degradation.operation-pending` |
| Invisible text | `code-editor.invisible.warning` |

`code-editor.search.matches` is a structured cardinal plural controlled by `count` and includes a
`${count}` placeholder. `code-editor.invisible.warning` includes `${codePoint}`. The English values
preserve historical bytes where a historical value exists. *(AR-6, AR-10)*

No accelerator scope is declared unless implementation introduces `~X~` markup on co-visible
labels. Keyboard hints display stable key tokens separately from translated action captions and
therefore are not accelerator scopes. *(AR-10)*

## Public integration

### `CodeEditorOptions`

Add:

```ts
/** Translation service for editor-owned presentation; defaults to an isolated English service. */
readonly i18n?: I18n;
```

`CodeEditor` adds:

```ts
/** Exact translation service used for editor-owned presentation. */
public readonly i18n: I18n;
```

Standalone construction resolves `options.i18n ?? createEnglishCodeEditorI18n()` once. It never
reads ambient application state. *(AR-4)*

### `CodeEditorWindowOptions`

Add the same optional service. The constructor resolves a single instance:

```ts
const i18n = options.i18n ?? createEnglishCodeEditorI18n();
```

The window retains that instance, uses it for its default title and status renderer, and passes the
same object to `new CodeEditor({ ...options, i18n })`. An explicit caller title remains exact caller
content and is never translated. The `status` getter remains unchanged numeric state; only the
`Text` renderer translates labels and formats displayed numbers. *(AR-4, AR-5, AR-7)*

### Override and fallback behavior

Every translation call supplies the corresponding canonical English catalog message as
`defaultMessage`. A supplied application service resolves its normal catalog precedence, so an
application catalog layered after the official Code Editor catalog wins. Missing or invalid
translations use existing safe fallback/diagnostic behavior; Code Editor adds no catch-all,
overlay, or second translator. *(AR-6)*

## Package isolation

- Add direct `@jsvision/i18n` runtime dependency with the repository lockstep version.
- Browser entry modules import only browser-safe `@jsvision/i18n` symbols.
- Locale catalogs are reachable only through explicit `./locales/*` exports.
- `src/node.ts` and Node session adapters remain isolated behind `./node`.
- No locale registry, filesystem loader, dynamic locale import, process state, or environment
  detection is introduced. *(AR-15)*

## Error handling

| Error case | Strategy | AR Ref |
|---|---|---|
| No service | Fresh isolated English Code Editor service | AR-4, AR-6 |
| Missing/invalid key in supplied service | Canonical English `defaultMessage`; existing bounded diagnostic | AR-6 |
| Unsafe official catalog | Strict validation/build failure | AR-11 |
| Unsafe application override | Existing i18n rejection/fallback; never render terminal controls | AR-6, AR-11 |
| Node-only dependency leak | Browser-isolation specification fails | AR-15 |

## Testing requirements

- Exact service identity and isolated fallback.
- Caller title precedence and numeric status stability.
- Application override precedence and safe fallback diagnostics.
- Ten subpath exports, strict parity, plural/placeholder/terminal safety, and main-entry isolation.
- No eager catalog registry or Node import from the main entry.
